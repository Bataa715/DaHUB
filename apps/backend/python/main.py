# -*- coding: utf-8 -*-
"""
Excel Report Python Runner — FastAPI microservice
=================================================
Олон concurrent хэрэглэгчдэд тогтвортой ажиллахаар оптимизаци хийсэн хувилбар.

Гол сайжруулалт:
  * Result cache (input hash-ээр)        — preview хийсний дараа excel/csv татах
                                            үед дахин экзекут хийхгүй.
  * Inflight dedup lock                  — ижил параметртэй request олон ирвэл
                                            нэг л экзекут болж бусад нь хүлээнэ.
  * Concurrency semaphore                — нэг дор N exec()-аас илүү ажиллахгүй.
  * Disconnect-safe                      — клиент refresh хийж салсан ч
                                            таамаглалт thread үргэлжилж дуусаад
                                            cache-д орно. Дараа татах үед
                                            кэшээс шууд өгнө.
  * Async handler-ууд                    — exec() blocking үйлдлийг threadpool-д
                                            шилжүүлж event loop хариулсан хэвээр.
  * Streaming downloads                  — Том файлыг chunk-аар стрим хийнэ.

Ажиллуулах:
    uvicorn main:app --host 127.0.0.1 --port 8001 --workers 2

Орчны хувьсагч:
    PYTHON_MAX_CONCURRENT     = 6      # exec()-ийн max concurrent
    PYTHON_CACHE_TTL_SEC      = 900    # кэшийн TTL (15 минут)
    PYTHON_CACHE_MAX_ENTRIES  = 32     # max кэш entry
    PYTHON_DEDUP_WAIT_SEC     = 1800   # ижил inflight хүлээх max хугацаа
    PYTHON_EXEC_TIMEOUT       = 1800   # нэг exec()-ийн max хугацаа (0 = unlimited)
"""

import _strptime  # noqa: F401  Python 3.13 thread-safety
import ast
import builtins as _builtins
import datetime
import gc
import hashlib
import io
import json
import os
import re
import secrets
import threading
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Callable, Optional

import clickhouse_connect
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from loguru import logger
from pydantic import BaseModel

_APP_START = time.monotonic()

# .env (NestJS-тэй ижил)
_env_root = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
_env_backend = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=_env_root)
load_dotenv(dotenv_path=_env_backend, override=False)


# ── Tunables ──────────────────────────────────────────────────────────────────

_MAX_CONCURRENT = int(os.environ.get("PYTHON_MAX_CONCURRENT", "6"))
_CACHE_TTL_SEC = int(os.environ.get("PYTHON_CACHE_TTL_SEC", "900"))
_CACHE_MAX_ENTRIES = int(os.environ.get("PYTHON_CACHE_MAX_ENTRIES", "32"))
# 0 = no timeout (том тайлангийн хувьд хязгааргүй оркив)
_DEDUP_WAIT_SEC = int(os.environ.get("PYTHON_DEDUP_WAIT_SEC", "0"))
_EXEC_TIMEOUT_SEC = int(os.environ.get("PYTHON_EXEC_TIMEOUT", "0"))
_PYTHON_API_KEY = os.environ.get("PYTHON_API_KEY", "")


# ── ClickHouse client (per-thread) ────────────────────────────────────────────
# clickhouse_connect.Client нь session-тэй: нэг client дээр хоёр thread зэрэг
# query явуулбал "concurrent queries within the same session" алдаа гарна.
# Тиймээс thread бүрд тусдаа client үүсгэнэ.

_ch_local = threading.local()
_ch_clients: list = []  # бүх thread-ийн client-уудыг shutdown-д хаах
_ch_clients_lock = threading.Lock()


def _new_ch_client() -> Any:
    raw_host = os.environ.get("CLICKHOUSE_HOST", "localhost")
    host = (
        raw_host.replace("https://", "")
        .replace("http://", "")
        .split(":")[0]
        .strip()
    )
    # Port: CLICKHOUSE_PORT > CLICKHOUSE_HOST URL-ээс salgah > 8123
    port_env = os.environ.get("CLICKHOUSE_PORT")
    if port_env:
        port = int(port_env)
    else:
        m = re.search(r":(\d+)(?:/|$)", raw_host)
        port = int(m.group(1)) if m else 8123
    return clickhouse_connect.get_client(
        host=host,
        port=port,
        username=os.environ.get("CLICKHOUSE_USER", "default"),
        password=os.environ.get("CLICKHOUSE_PASSWORD", ""),
        database=os.environ.get("CLICKHOUSE_DATABASE", "audit_db"),
        compress=True,
        connect_timeout=10,
        send_receive_timeout=600,
        # readonly=2 (not 1): both block INSERT/UPDATE/DELETE/DDL at the
        # ClickHouse engine level, but readonly=1 also blocks ANY query-level
        # settings change — clickhouse-connect routinely needs to set those
        # internally, so readonly=1 broke ordinary complex SELECT queries
        # (report scripts that used to work started failing with
        # "Cannot modify ... setting in readonly mode"). readonly=2 keeps the
        # same write protection without that side effect.
        settings={"readonly": 2},
    )


def _get_ch_client() -> Any:
    """Thread-local ClickHouse client. Thread бүрд тусдаа session."""
    client = getattr(_ch_local, "client", None)
    if client is not None:
        try:
            client.ping()
            return client
        except Exception:
            logger.warning("ClickHouse ping амжилтгүй — thread-local client-ыг дахин үүсгэнэ")
            try:
                client.close()
            except Exception:
                pass
            _ch_local.client = None

    new_client = _new_ch_client()
    _ch_local.client = new_client
    with _ch_clients_lock:
        _ch_clients.append(new_client)
    return new_client


# ── Oracle helpers ────────────────────────────────────────────────────────────

def _ora_connect_one(sub_cfg: dict, label: str = "") -> Any:
    host = sub_cfg.get("host", "localhost")
    port = int(sub_cfg.get("port", 1521))
    svc = sub_cfg.get("serviceName") or sub_cfg.get("database", "")
    user = sub_cfg.get("user", "")
    password = sub_cfg.get("password", "")
    tag = f" [{label}]" if label else ""

    try:
        import cx_Oracle  # type: ignore[import]
        dsn = sub_cfg.get("dsn") or cx_Oracle.makedsn(host, port, service_name=svc)
        conn = cx_Oracle.connect(user=user, password=password, dsn=dsn)
        logger.info("Oracle{} холбогдлоо ({}/{})", tag, host, svc)
        return conn
    except ImportError:
        raise HTTPException(
            status_code=502,
            detail=f"Oracle{tag}: cx_Oracle суулгаагүй байна. pip install cx_Oracle",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Oracle{tag} холболт амжилтгүй ({host}/{svc}): {exc}",
        )


def _make_connection(connection_type: str, cfg: dict | None) -> Any:
    if not connection_type or connection_type == "clickhouse":
        return _get_ch_client()
    if not cfg:
        raise HTTPException(
            status_code=400,
            detail=f"'{connection_type}' холболтод connectionConfig шаардлагатай.",
        )
    if connection_type == "oracle":
        if cfg and all(isinstance(v, dict) for v in cfg.values()):
            return {name: _ora_connect_one(sub, name) for name, sub in cfg.items()}
        return _ora_connect_one(cfg)
    if connection_type == "clickhouse_oracle":
        if cfg and all(isinstance(v, dict) for v in cfg.values()):
            ora_conn = {name: _ora_connect_one(sub, name) for name, sub in cfg.items()}
        else:
            ora_conn = _ora_connect_one(cfg) if cfg else None
        return {"ch": _get_ch_client(), "ora": ora_conn}
    raise HTTPException(
        status_code=400,
        detail=(
            f"Дэмжигдээгүй connectionType: '{connection_type}'. "
            "Зөвшөөрөгдсөн утгууд: clickhouse | oracle | clickhouse_oracle"
        ),
    )


# ── API Key ──────────────────────────────────────────────────────────────────

async def _verify_api_key(request: Request) -> None:
    if not _PYTHON_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Сервис тохируулагдаагүй: PYTHON_API_KEY олдсонгүй.",
        )
    key = request.headers.get("x-api-key", "")
    if not secrets.compare_digest(key, _PYTHON_API_KEY):
        ip = request.client.host if request.client else "unknown"
        logger.warning("Зөвшөөрөлгүй хандалт: буруу API key, IP={}", ip)
        raise HTTPException(status_code=401, detail="Зөвшөөрөлгүй хандалт.")


# ── exec() timeout helper ─────────────────────────────────────────────────────

class _ExecTimeoutError(Exception):
    pass


def _exec_with_timeout(code: str, namespace: dict, timeout: int = _EXEC_TIMEOUT_SEC) -> None:
    exc_info: list = [None]

    def _target():
        try:
            exec(code, namespace)  # noqa: S102
        except Exception as e:
            exc_info[0] = e

    thread = threading.Thread(target=_target, daemon=True, name="exec-runner")
    thread.start()
    # timeout=0 → хязгааргүй (том тайлан асуудалгүй ажиллана)
    thread.join(timeout=timeout if timeout and timeout > 0 else None)

    if thread.is_alive():
        logger.error("exec() timeout: {}с хүрлээ", timeout)
        raise _ExecTimeoutError(f"Кодын гүйцэтгэл {timeout} секундээс хэтэрсэн.")

    if exc_info[0] is not None:
        raise exc_info[0]


# ── Result cache (TTL + LRU + dedup) ──────────────────────────────────────────

@dataclass
class _CacheEntry:
    result: Any
    created_at: float
    last_used: float


@dataclass
class _Inflight:
    event: threading.Event = field(default_factory=threading.Event)
    result: Any = None
    error: Optional[BaseException] = None
    started_at: float = field(default_factory=time.monotonic)


class _ResultCache:
    """Thread-safe TTL+LRU cache with per-key inflight deduplication."""

    def __init__(self, max_entries: int, ttl_seconds: int) -> None:
        self.max_entries = max_entries
        self.ttl = ttl_seconds
        self._entries: dict[str, _CacheEntry] = {}
        self._inflight: dict[str, _Inflight] = {}
        self._lock = threading.RLock()
        self._sem = threading.BoundedSemaphore(_MAX_CONCURRENT)

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            self._evict_expired_locked()
            entry = self._entries.get(key)
            if entry is None:
                return None
            entry.last_used = time.monotonic()
            return entry.result

    def compute(self, key: str, runner: Callable[[], Any]) -> Any:
        """Cache-аас унш. Байхгүй бол нэг л thread-д runner ажиллуулна. Бусад
        thread үр дүнг хүлээнэ. Inflight нь client disconnect хийсэн ч ажиллаж
        дуусаад кэшэд орно."""
        cached = self.get(key)
        if cached is not None:
            return cached

        owner = False
        with self._lock:
            inflight = self._inflight.get(key)
            if inflight is None:
                inflight = _Inflight()
                self._inflight[key] = inflight
                owner = True

        if not owner:
            # Inflight үр дүн хүлээх. _DEDUP_WAIT_SEC=0 → хязгааргүй хүлэнэ.
            ok = inflight.event.wait(
                timeout=_DEDUP_WAIT_SEC if _DEDUP_WAIT_SEC > 0 else None
            )
            if not ok:
                raise HTTPException(
                    status_code=504,
                    detail="Урьд ажиллаж буй ижил хүсэлт хугацаандаа дуусаагүй.",
                )
            if inflight.error is not None:
                raise inflight.error
            return inflight.result

        try:
            with self._sem:
                result = runner()
            self._put(key, result)
            inflight.result = result
            return result
        except BaseException as exc:
            inflight.error = exc
            raise
        finally:
            inflight.event.set()
            with self._lock:
                self._inflight.pop(key, None)

    def invalidate(self, key: str) -> bool:
        with self._lock:
            return self._entries.pop(key, None) is not None

    def _put(self, key: str, result: Any) -> None:
        with self._lock:
            self._entries[key] = _CacheEntry(
                result=result,
                created_at=time.monotonic(),
                last_used=time.monotonic(),
            )
            self._evict_expired_locked()
            self._evict_lru_locked()

    def _evict_expired_locked(self) -> None:
        now = time.monotonic()
        expired = [k for k, e in self._entries.items() if now - e.created_at > self.ttl]
        for k in expired:
            self._entries.pop(k, None)

    def _evict_lru_locked(self) -> None:
        if len(self._entries) <= self.max_entries:
            return
        sorted_keys = sorted(self._entries.items(), key=lambda kv: kv[1].last_used)
        for k, _ in sorted_keys[: len(self._entries) - self.max_entries]:
            self._entries.pop(k, None)

    def stats(self) -> dict:
        with self._lock:
            return {
                "entries": len(self._entries),
                "inflight": len(self._inflight),
                "max_entries": self.max_entries,
                "ttl_sec": self.ttl,
                "max_concurrent": _MAX_CONCURRENT,
            }


_CACHE = _ResultCache(_CACHE_MAX_ENTRIES, _CACHE_TTL_SEC)


def _make_cache_key(payload: dict[str, Any]) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:32]


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        import cx_Oracle  # type: ignore[import]
        lib_dir = os.environ.get("ORACLE_CLIENT_LIB", r"D:\ORACLE\instantclient_21_13")
        cx_Oracle.init_oracle_client(lib_dir=lib_dir)
        logger.info("Oracle Instant Client ачааллаа ({})", lib_dir)
    except Exception as exc:
        logger.warning("Oracle Instant Client ачаалж чадсангүй: {}", exc)

    try:
        _get_ch_client().ping()
        logger.info("ClickHouse холболт амжилттай")
    except Exception as exc:
        logger.warning("ClickHouse холболт алдаа: {}", exc)

    logger.info(
        "Config: max_concurrent={} cache_ttl={}s cache_max={} dedup_wait={}s exec_timeout={}s",
        _MAX_CONCURRENT, _CACHE_TTL_SEC, _CACHE_MAX_ENTRIES, _DEDUP_WAIT_SEC, _EXEC_TIMEOUT_SEC,
    )

    yield

    with _ch_clients_lock:
        for c in _ch_clients:
            try:
                c.close()
            except Exception:
                pass
        _ch_clients.clear()
    logger.info("Бүх ClickHouse client хаагдлаа")


app = FastAPI(
    title="Excel Report Python Runner",
    description="NestJS-ийн pandas-д суурилсан тайлангуудыг ажиллуулах дотоод FastAPI сервис.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.environ.get("PYTHON_ENV", "development") == "development" else None,
    redoc_url=None,
)

_cors_origins = [
    o.strip()
    for o in os.environ.get(
        "PYTHON_CORS_ORIGINS", "http://localhost:3001,http://127.0.0.1:3001"
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["x-api-key", "content-type"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RunReportRequest(BaseModel):
    code: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    filters: Optional[dict[str, Any]] = None
    preview_limit: int = 50


class RunToolRequest(BaseModel):
    code: str
    connection_type: str = "clickhouse"
    connection_config: Optional[dict[str, Any]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    filters: Optional[dict[str, Any]] = None
    output_format: str = "excel"
    preview_limit: int = 50


# ── Code safety ───────────────────────────────────────────────────────────────

_BLOCKED_STRINGS = [
    # Process / OS execution
    "import subprocess", "from subprocess",
    "import socket", "from socket",
    "import shutil", "from shutil",
    "import sys", "from sys",
    # Network / HTTP — prevent SSRF and data exfiltration
    "import requests", "from requests",
    "import httpx", "from httpx",
    "import urllib", "from urllib",
    "import http.client", "import httplib",
    "import ftplib", "import smtplib",
    "import telnetlib", "import paramiko",
    # Dynamic import / introspection
    "__import__", "importlib", "builtins", "__builtins__",
    "__dict__", "__class__", "__subclasses__", "__globals__", "__getattr__",
    "getattr(", "setattr(", "delattr(",
    "globals(", "locals(", "vars(", "dir(",
    "exec(", "eval(", "compile(",
    # File system
    "os.system", "os.popen", "os.execv", "os.spawn", "os.environ",
    "os.path", "os.remove", "os.unlink", "os.rmdir", "os.listdir",
    "import pathlib", "from pathlib",
    "open(", "pickle", "marshal", "shelve",
    "yaml.load", "yaml.unsafe_load",
    # Pandas file I/O — exec 코드에서 파일/네트워크 읽기 금지
    "pd.read_csv", "pd.read_table", "pd.read_excel", "pd.read_json",
    "pd.read_html", "pd.read_clipboard", "pd.read_parquet",
    "pd.read_feather", "pd.read_orc", "pd.read_hdf",
    "pd.read_stata", "pd.read_sas", "pd.read_spss",
    "pd.read_pickle", "pd.read_gbq", "pd.read_sql_table",
    # DataFrame write methods — no file output from exec
    ".to_csv(", ".to_excel(", ".to_pickle(", ".to_hdf(",
    ".to_parquet(", ".to_feather(", ".to_orc(",
    # NumPy file I/O
    "np.load(", "np.save(", "np.savetxt(", "np.loadtxt(",
    "np.fromfile(", "np.memmap(",
    # Thread/process execution — spawned threads bypass exec timeout
    "ThreadPoolExecutor", "import threading", "import multiprocessing",
    "import concurrent",
]

_BLOCKED_PATTERNS = [
    re.compile(r"__\w+__"),
    re.compile(r"chr\s*\("),
    re.compile(r"ord\s*\("),
    re.compile(r"\btype\s*\("),
    re.compile(r"breakpoint\s*\("),
]

_SQL_MUTATE_PATTERNS = [
    re.compile(r"\bINSERT\s+INTO\b", re.IGNORECASE),
    re.compile(r"\bUPDATE\s+\w", re.IGNORECASE),
    re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE),
    re.compile(r"\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|USER|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION)\b", re.IGNORECASE),
    re.compile(r"\bTRUNCATE\s+", re.IGNORECASE),
    re.compile(r"\bALTER\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|USER|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION)\b", re.IGNORECASE),
    re.compile(r"\bCREATE\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|USER|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION)\b", re.IGNORECASE),
    re.compile(r"\bGRANT\s+", re.IGNORECASE),
    re.compile(r"\bREVOKE\s+", re.IGNORECASE),
    re.compile(r"\bMERGE\s+INTO\b", re.IGNORECASE),
    re.compile(r"\bEXECUTE\s+", re.IGNORECASE),
    re.compile(r"\bCALL\s+", re.IGNORECASE),
]


def _check_code_safety(code: str) -> None:
    code_lower = code.lower()
    for pattern in _BLOCKED_STRINGS:
        if pattern.lower() in code_lower:
            raise HTTPException(
                status_code=400,
                detail=f"Аюулгүй байдлын хязгаарлалт: '{pattern}' ашиглах боломжгүй.",
            )
    for pat in _BLOCKED_PATTERNS:
        if pat.search(code):
            raise HTTPException(
                status_code=400,
                detail=f"Аюулгүй байдлын хязгаарлалт: '{pat.pattern}' загвар ашиглах боломжгүй.",
            )
    for pat in _SQL_MUTATE_PATTERNS:
        if pat.search(code):
            raise HTTPException(
                status_code=400,
                detail=f"Зөвхөн SELECT query зөвшөөрөгдөнө. '{pat.pattern}' ашиглах боломжгүй.",
            )

    # AST-based defence-in-depth: reject any access to dunder attributes,
    # `import` / `from import` statements, lambda + obfuscation tricks that the
    # string blocklist may miss (e.g. `getattr(o, '__cl' + 'ass__')`).
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        raise HTTPException(status_code=400, detail=f"Python syntax алдаа: {exc}")

    forbidden_names = {
        "eval", "exec", "compile", "__import__", "globals", "locals",
        "vars", "getattr", "setattr", "delattr", "open", "input",
        "breakpoint", "help", "memoryview", "object", "type", "super",
    }
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise HTTPException(
                status_code=400,
                detail="Аюулгүй байдлын хязгаарлалт: import зөвшөөрөгдөхгүй.",
            )
        if isinstance(node, ast.Attribute) and node.attr.startswith("__") and node.attr.endswith("__"):
            raise HTTPException(
                status_code=400,
                detail=f"Аюулгүй байдлын хязгаарлалт: dunder attribute '{node.attr}' ашиглах боломжгүй.",
            )
        if isinstance(node, ast.Name) and node.id in forbidden_names:
            raise HTTPException(
                status_code=400,
                detail=f"Аюулгүй байдлын хязгаарлалт: '{node.id}' нэрийг ашиглах боломжгүй.",
            )
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in forbidden_names:
            raise HTTPException(
                status_code=400,
                detail=f"Аюулгүй байдлын хязгаарлалт: '{node.func.id}()' дуудах боломжгүй.",
            )


# ── Restricted builtins ──────────────────────────────────────────────────────

_SAFE_BUILTINS = {
    name: getattr(_builtins, name)
    for name in (
        "abs", "all", "any", "bool", "dict", "enumerate", "filter", "float",
        "format", "frozenset", "hasattr", "hash", "id", "int", "isinstance",
        "issubclass", "iter", "len", "list", "map", "max", "min", "next",
        "print", "range", "repr", "reversed", "round", "set", "slice",
        "sorted", "str", "sum", "tuple", "zip", "True", "False", "None",
        "ValueError", "TypeError", "KeyError", "IndexError", "Exception",
    )
    if hasattr(_builtins, name)
}


# ── Exec helpers ──────────────────────────────────────────────────────────────

def _build_namespace(conn: Any, start_date: str, end_date: str, filters: dict) -> dict[str, Any]:
    return {
        "__builtins__": _SAFE_BUILTINS,
        "conn": conn,
        "pd": pd,
        "np": np,
        "start_date": start_date or "",
        "end_date": end_date or start_date or "",
        "filters": filters or {},
        "result": None,
    }


def _run_exec(code: str, namespace: dict, label: str = "код") -> Any:
    try:
        _exec_with_timeout(code, namespace)
    except _ExecTimeoutError as exc:
        raise HTTPException(status_code=408, detail=str(exc))
    except MemoryError:
        gc.collect()
        logger.error("{} OOM: санах ой дүүрсэн", label)
        raise HTTPException(status_code=503, detail="Санах ой дүүрсэн (OOM). Хугацааг богиносгоно уу.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("{} алдаа: {}: {}", label, type(exc).__name__, exc)
        raise HTTPException(
            status_code=400,
            detail=f"Python код алдаа: {type(exc).__name__}: {exc}",
        )

    result = namespace.get("result")
    if result is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Python код 'result' утга өгсөнгүй.\n"
                "`result = df` эсвэл `result = [('Sheet1', df1), ('Sheet2', df2)]` гэж бичнэ үү."
            ),
        )
    return _sanitize_result(result)


def _execute_report_uncached(req: RunReportRequest) -> Any:
    _check_code_safety(req.code)
    conn = _get_ch_client()
    ns = _build_namespace(conn, req.start_date, req.end_date, req.filters or {})
    return _run_exec(req.code, ns, label="Тайлан")


def _execute_tool_uncached(req: RunToolRequest) -> Any:
    _check_code_safety(req.code)
    conn = _make_connection(req.connection_type, req.connection_config)
    ns = _build_namespace(conn, req.start_date, req.end_date, req.filters or {})
    return _run_exec(req.code, ns, label="Tool")


def _tool_cache_key(req: RunToolRequest) -> str:
    return _make_cache_key(
        {
            "kind": "tool",
            "code": req.code,
            "ct": req.connection_type,
            "cc": req.connection_config or {},
            "sd": req.start_date,
            "ed": req.end_date,
            "f": req.filters or {},
        }
    )


def _report_cache_key(req: RunReportRequest) -> str:
    return _make_cache_key(
        {
            "kind": "report",
            "code": req.code,
            "sd": req.start_date,
            "ed": req.end_date,
            "f": req.filters or {},
        }
    )


# ── DataFrame sanitization ───────────────────────────────────────────────────

def _deep_sanitize_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            try:
                if df[col].dt.tz is not None:
                    df[col] = df[col].dt.tz_convert(None)
            except Exception:
                pass
        elif pd.api.types.is_numeric_dtype(df[col]):
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df[col] = df[col].replace([np.inf, -np.inf], np.nan)
        elif df[col].dtype == object:
            def _fix(v):
                if v is None:
                    return None
                if isinstance(v, Decimal):
                    return float(v)
                if isinstance(v, pd.Timestamp):
                    return v.isoformat()
                if isinstance(v, datetime.datetime):
                    return v.isoformat()
                if isinstance(v, datetime.date):
                    return v.isoformat()
                return v
            df[col] = df[col].map(_fix)
    return df


def _sanitize_result(result: Any) -> Any:
    if isinstance(result, pd.DataFrame):
        return _deep_sanitize_df(result)
    if isinstance(result, list):
        return [
            (name, _deep_sanitize_df(df) if isinstance(df, pd.DataFrame) else df)
            for name, df in result
        ]
    return result


# ── Output formatters ─────────────────────────────────────────────────────────

def _result_to_excel_bytes(result: Any) -> bytes:
    if isinstance(result, list) and not result:
        raise HTTPException(status_code=400, detail="result жагсаалт хоосон байна.")
    if not isinstance(result, (pd.DataFrame, list)):
        raise HTTPException(
            status_code=400,
            detail=(
                "result нь pd.DataFrame эсвэл [(sheet_name, df), ...] байх ёстой. "
                f"Одоогийн төрөл: {type(result).__name__}"
            ),
        )

    output = io.BytesIO()
    # constant_memory=True: маш том DataFrame-д санах ойгоор хэмнэлттэй
    with pd.ExcelWriter(
        output,
        engine="xlsxwriter",
        engine_kwargs={"options": {"constant_memory": True}},
    ) as writer:
        if isinstance(result, pd.DataFrame):
            result.to_excel(writer, sheet_name="Sheet1", index=False)
        else:
            for sheet_name, df in result:
                if not isinstance(df, pd.DataFrame):
                    raise HTTPException(
                        status_code=400,
                        detail=f"'{sheet_name}' sheet-ийн утга DataFrame биш байна.",
                    )
                df.to_excel(writer, sheet_name=str(sheet_name)[:31], index=False)
    output.seek(0)
    return output.read()


def _result_to_csv_bytes(result: Any) -> bytes:
    if isinstance(result, pd.DataFrame):
        df = result
    elif isinstance(result, list) and result:
        _, df = result[0]
    else:
        raise HTTPException(status_code=400, detail="result нь DataFrame байх ёстой.")
    output = io.BytesIO()
    output.write(b"\xef\xbb\xbf")  # UTF-8 BOM
    output.write(df.to_csv(index=False).encode("utf-8"))
    output.seek(0)
    return output.read()


def _result_to_json_payload(result: Any) -> Any:
    if isinstance(result, pd.DataFrame):
        rows = json.loads(
            result.to_json(orient="records", date_format="iso",
                           default_handler=str, force_ascii=False)
        )
        return {"columns": list(result.columns), "rows": rows}
    if isinstance(result, list):
        sheets = []
        for name, df in result:
            rows = json.loads(
                df.to_json(orient="records", date_format="iso",
                           default_handler=str, force_ascii=False)
            )
            sheets.append({"name": str(name), "columns": list(df.columns), "rows": rows})
        return {"sheets": sheets}
    raise HTTPException(status_code=400, detail="result нь DataFrame байх ёстой.")


def _df_to_preview(df: pd.DataFrame, limit: int) -> dict:
    sample = df.head(limit)
    rows = json.loads(
        sample.to_json(
            orient="records",
            date_format="iso",
            default_handler=str,
            force_ascii=False,
        )
    )
    return {
        "columns": list(sample.columns),
        "rows": [[row.get(col) for col in sample.columns] for row in rows],
        "totalCount": len(df),
    }


def _result_preview_payload(result: Any, limit: int) -> dict:
    if isinstance(result, pd.DataFrame):
        return _df_to_preview(result, limit)
    if isinstance(result, list) and result:
        sheet_name, df = result[0]
        return {**_df_to_preview(df, limit), "sheet": str(sheet_name)}
    raise HTTPException(status_code=400, detail="result нь DataFrame байх ёстой.")


def _stream_bytes(payload: bytes, chunk_size: int = 64 * 1024):
    pos = 0
    n = len(payload)
    while pos < n:
        yield payload[pos : pos + chunk_size]
        pos += chunk_size


# ── Async wrappers ────────────────────────────────────────────────────────────

async def _compute_tool_async(req: RunToolRequest) -> tuple[str, Any]:
    key = _tool_cache_key(req)
    result = await run_in_threadpool(
        _CACHE.compute, key, lambda: _execute_tool_uncached(req)
    )
    return key, result


async def _compute_report_async(req: RunReportRequest) -> tuple[str, Any]:
    key = _report_cache_key(req)
    result = await run_in_threadpool(
        _CACHE.compute, key, lambda: _execute_report_uncached(req)
    )
    return key, result


# ── POST /run-report ──────────────────────────────────────────────────────────

@app.post(
    "/run-report",
    summary="Pandas код ажиллуулж Excel буцаана",
    response_class=Response,
    dependencies=[Depends(_verify_api_key)],
)
async def run_report(req: RunReportRequest) -> Response:
    key, result = await _compute_report_async(req)
    body = await run_in_threadpool(_result_to_excel_bytes, result)
    return StreamingResponse(
        _stream_bytes(body),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"X-Cache-Key": key, "Content-Length": str(len(body))},
    )


# ── POST /preview ─────────────────────────────────────────────────────────────

@app.post(
    "/preview",
    summary="Pandas код ажиллуулж эхний N мөрийг JSON-оор буцаана",
    dependencies=[Depends(_verify_api_key)],
)
async def preview_report(req: RunReportRequest) -> JSONResponse:
    key, result = await _compute_report_async(req)
    limit = max(1, min(req.preview_limit, 500))
    payload = await run_in_threadpool(_result_preview_payload, result, limit)
    payload["cacheKey"] = key
    return JSONResponse(payload)


# ── POST /run-tool ────────────────────────────────────────────────────────────

@app.post(
    "/run-tool",
    summary="Python API Tool ажиллуулна (excel | json | csv)",
    dependencies=[Depends(_verify_api_key)],
)
async def run_tool(req: RunToolRequest) -> Response:
    key, result = await _compute_tool_async(req)
    fmt = (req.output_format or "excel").lower()

    if fmt == "excel":
        body = await run_in_threadpool(_result_to_excel_bytes, result)
        return StreamingResponse(
            _stream_bytes(body),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"X-Cache-Key": key, "Content-Length": str(len(body))},
        )
    if fmt == "csv":
        body = await run_in_threadpool(_result_to_csv_bytes, result)
        return StreamingResponse(
            _stream_bytes(body),
            media_type="text/csv; charset=utf-8",
            headers={"X-Cache-Key": key, "Content-Length": str(len(body))},
        )
    if fmt == "json":
        payload = await run_in_threadpool(_result_to_json_payload, result)
        if isinstance(payload, dict):
            payload["cacheKey"] = key
        return JSONResponse(payload)
    raise HTTPException(
        status_code=400,
        detail=f"Дэмжигдээгүй outputFormat: '{fmt}'. Зөвшөөрөгдсөн: excel | json | csv",
    )


# ── POST /preview-tool ────────────────────────────────────────────────────────

@app.post(
    "/preview-tool",
    summary="Python API Tool-ийн preview (эхний N мөр JSON, кэшэд хадгална)",
    dependencies=[Depends(_verify_api_key)],
)
async def preview_tool(req: RunToolRequest) -> JSONResponse:
    key, result = await _compute_tool_async(req)
    limit = max(1, min(req.preview_limit, 500))
    payload = await run_in_threadpool(_result_preview_payload, result, limit)
    payload["cacheKey"] = key
    return JSONResponse(payload)


# ── GET /download/{key} ───────────────────────────────────────────────────────

@app.get(
    "/download/{cache_key}",
    summary="Кэшээс шууд татах (preview хийсний дараа excel/csv/json татна)",
    dependencies=[Depends(_verify_api_key)],
)
async def download_cached(cache_key: str, format: str = "excel") -> Response:
    result = _CACHE.get(cache_key)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Кэш олдсонгүй эсвэл хугацаа нь дууссан. Preview-г дахин хийнэ үү.",
        )
    fmt = (format or "excel").lower()
    if fmt == "excel":
        body = await run_in_threadpool(_result_to_excel_bytes, result)
        return StreamingResponse(
            _stream_bytes(body),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"X-Cache-Key": cache_key, "Content-Length": str(len(body))},
        )
    if fmt == "csv":
        body = await run_in_threadpool(_result_to_csv_bytes, result)
        return StreamingResponse(
            _stream_bytes(body),
            media_type="text/csv; charset=utf-8",
            headers={"X-Cache-Key": cache_key, "Content-Length": str(len(body))},
        )
    if fmt == "json":
        payload = await run_in_threadpool(_result_to_json_payload, result)
        return JSONResponse(payload)
    raise HTTPException(
        status_code=400,
        detail=f"Дэмжигдээгүй format: '{fmt}'. Зөвшөөрөгдсөн: excel | csv | json",
    )


# ── POST /validate-code ───────────────────────────────

class ValidateCodeRequest(BaseModel):
    code: str


@app.post(
    "/validate-code",
    summary="Кодыг ажиллуулахгүйгээр syntax + аюулгүй байдлын шалгалт хийнэ",
    dependencies=[Depends(_verify_api_key)],
)
def validate_code(req: ValidateCodeRequest) -> JSONResponse:
    """Editor-ийн шууд feedback — syntax алдааны мөрийн дугаарыг буцаана."""
    code = req.code or ""
    if not code.strip():
        return JSONResponse({"ok": False, "error": "Код хоосон байна", "line": None})
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        return JSONResponse(
            {
                "ok": False,
                "error": f"Syntax алдаа: {exc.msg}",
                "line": exc.lineno,
                "col": exc.offset,
            }
        )
    try:
        _check_code_safety(code)
    except HTTPException as exc:
        return JSONResponse({"ok": False, "error": str(exc.detail), "line": None})
    has_result = any(
        isinstance(node, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == "result" for t in node.targets)
        for node in ast.walk(tree)
    )
    return JSONResponse(
        {
            "ok": True,
            "warning": None
            if has_result
            else "`result = ...` оноолт олдсонгүй — код ажиллахад алдаа өгнө.",
        }
    )


# ── GET /health ───────────────────────────────────────────────────────────────

@app.get("/health", summary="Сервис болон ClickHouse-ийн төлөв")
def health() -> dict:
    ch_ok = False
    ch_latency_ms: Optional[int] = None
    try:
        t0 = time.monotonic()
        _get_ch_client().ping()
        ch_latency_ms = round((time.monotonic() - t0) * 1000)
        ch_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "clickhouse": ch_ok,
        "ch_latency_ms": ch_latency_ms,
        "uptime_sec": round(time.monotonic() - _APP_START),
        "cache": _CACHE.stats(),
    }


# ── Шууд ажиллуулах ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("PYTHON_SERVICE_HOST", "0.0.0.0")
    port = int(os.environ.get("PYTHON_SERVICE_PORT", "8001"))
    is_dev = os.environ.get("PYTHON_ENV", "development") == "development"
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=is_dev,
        workers=1 if is_dev else int(os.environ.get("PYTHON_WORKERS", "2")),
        access_log=is_dev,
    )
