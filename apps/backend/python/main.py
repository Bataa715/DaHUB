# -*- coding: utf-8 -*-
"""
Excel Report Python Runner - FastAPI microservice
=================================================
NestJS backend энэ сервисийг дуудаж pandas-д суурилсан тайланг ажиллуулна.

АНХААРУУЛГА: Энэ сервис ДОТООД хэрэглээнд зориулагдсан бөгөөд
             гадаад интернетэд нээлттэй байж болохгүй.

Ажиллуулах:
    uvicorn main:app --host 127.0.0.1 --port 8001 --reload

Орчны хувьсагчид (.env-с уншина):
    CLICKHOUSE_HOST, CLICKHOUSE_PORT, CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE, PYTHON_SERVICE_PORT
"""

import _strptime  # Python 3.13 thread-safety: strptime-г урьдчилан ачаална
import io
import os
import secrets
import signal
import threading
from contextlib import asynccontextmanager
from typing import Any, Optional

import clickhouse_connect
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from loguru import logger
from pydantic import BaseModel

# .env файлаас орчны хувьсагчдыг уншина (NestJS-тэй нэг .env ашиглана)
_env_root = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
_env_backend = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=_env_root)
load_dotenv(dotenv_path=_env_backend, override=False)  # root .env байхгүй бол backend/.env-г уншина

# ── ClickHouse singleton холболт ──────────────────────────────────────────────

_ch_client: Any = None


def _get_ch_client() -> Any:
    """ClickHouse client-ийг нэг удаа үүсгэж, дараа нь дахин ашиглана."""
    global _ch_client
    if _ch_client is None:
        raw_host = os.environ.get("CLICKHOUSE_HOST", "localhost")
        # http:// эсвэл https:// угтвар байвал хасна
        host = (
            raw_host.replace("https://", "")
            .replace("http://", "")
            .split(":")[0]
            .strip()
        )
        _ch_client = clickhouse_connect.get_client(
            host=host,
            port=int(os.environ.get("CLICKHOUSE_PORT", "8123")),
            username=os.environ.get("CLICKHOUSE_USER", "default"),
            password=os.environ.get("CLICKHOUSE_PASSWORD", ""),
            database=os.environ.get("CLICKHOUSE_DATABASE", "audit_db"),
            compress=True,  # сүлжээний ачааллыг бууруулна
        )
    return _ch_client


def _ora_connect_one(sub_cfg: dict, label: str = "") -> Any:
    """
    Нэг Oracle connection үүсгэнэ.
    1. oracledb thin mode
    2. cx_Oracle fallback (хуучин сервер, DPY-3010 гарвал)
    """
    host = sub_cfg.get("host", "localhost")
    port = int(sub_cfg.get("port", 1521))
    svc = sub_cfg.get("serviceName") or sub_cfg.get("database", "")
    user = sub_cfg.get("user", "")
    password = sub_cfg.get("password", "")
    tag = f" [{label}]" if label else ""

    # cx_Oracle (startup дээр init_oracle_client() дуудагдсан тул Instant Client ачаалагдсан)
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
    """
    connectionType болон connectionConfig-оос DB холболт үүсгэнэ.
    Буцаах утга нь кодын дотор `conn` нэрээр ашиглагдана.
    """
    if not connection_type or connection_type == "clickhouse":
        return _get_ch_client()

    if not cfg:
        raise HTTPException(
            status_code=400,
            detail=f"'{connection_type}' холболтод connectionConfig шаардлагатай.",
        )

    if connection_type == "oracle":
        def _single_oracle(sub_cfg: dict, label: str = "") -> Any:
            return _ora_connect_one(sub_cfg, label)

        # Олон connection: бүх value нь dict бол нэрлэсэн холболтуудын dict буцаана
        # { "finacle": {...}, "erp": {...} }  →  conn["finacle"], conn["erp"]
        if cfg and all(isinstance(v, dict) for v in cfg.values()):
            return {name: _ora_connect_one(sub, name) for name, sub in cfg.items()}

        # Нэг connection (хуучин формат): conn нь шууд oracledb.Connection
        return _ora_connect_one(cfg)

    if connection_type == "clickhouse_oracle":
        # ClickHouse болон Oracle-г хослуулан нэгэн зэрэг холбоно.
        # cfg нь Oracle connection(s)-ийн тохиргоо байна.
        # Буцаах: { "ch": <ClickHouse client>, "ora": <oracle conn эсвэл dict> }
        if cfg and all(isinstance(v, dict) for v in cfg.values()):
            ora_conn = {name: _ora_connect_one(sub, name) for name, sub in cfg.items()}
        else:
            ora_conn = _ora_connect_one(cfg) if cfg else None

        return {"ch": _get_ch_client(), "ora": ora_conn}

    raise HTTPException(
        status_code=400,
        detail=f"Дэмжигдээгүй connectionType: '{connection_type}'. "
               "Зөвшөөрөгдсөн утгууд: clickhouse | oracle | clickhouse_oracle",
    )


# ── API Key Authentication ─────────────────────────────────────────────────────

_PYTHON_API_KEY = os.environ.get("PYTHON_API_KEY", "")


async def _verify_api_key(request: Request) -> None:
    """NestJS-ээс ирсэн API key шалгана."""
    if not _PYTHON_API_KEY:
        return  # key тохируулаагүй бол шалгахгүй (dev mode)
    key = request.headers.get("x-api-key", "")
    if not secrets.compare_digest(key, _PYTHON_API_KEY):
        logger.warning("Зөвшөөрөлгүй хандалт: буруу API key, IP={}", request.client.host if request.client else "unknown")
        raise HTTPException(status_code=401, detail="Зөвшөөрөлгүй хандалт.")


# ── Exec() timeout helper ─────────────────────────────────────────────────────

_EXEC_TIMEOUT_SEC = int(os.environ.get("PYTHON_EXEC_TIMEOUT", "30"))


class _ExecTimeoutError(Exception):
    pass


def _exec_with_timeout(code: str, namespace: dict, timeout: int = _EXEC_TIMEOUT_SEC) -> None:
    """
    exec()-г тусдаа thread дээр ажиллуулж, timeout хязгаарлана.
    """
    exc_info: list = [None]

    def _target():
        try:
            exec(code, namespace)  # noqa: S102
        except Exception as e:
            exc_info[0] = e

    thread = threading.Thread(target=_target, daemon=True)
    thread.start()
    thread.join(timeout=timeout)

    if thread.is_alive():
        logger.error("exec() timeout: {}с хүрлээ", timeout)
        raise _ExecTimeoutError(f"Кодын гүйцэтгэл {timeout} секундээс хэтэрсэн.")

    if exc_info[0] is not None:
        raise exc_info[0]


# ── Lifespan: startup дээр ClickHouse-г дулааруулна ──────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Oracle Instant Client (cx_Oracle) ────────────────────────────────────
    try:
        import cx_Oracle  # type: ignore[import]
        lib_dir = os.environ.get("ORACLE_CLIENT_LIB", r"D:\ORACLE\instantclient_21_13")
        cx_Oracle.init_oracle_client(lib_dir=lib_dir)
        logger.info("Oracle Instant Client ачааллаа ({})", lib_dir)
    except Exception as exc:
        logger.warning("Oracle Instant Client ачаалж чадсангүй (Oracle шаардлагагүй бол хэвийн): {}", exc)
    # ── ClickHouse ───────────────────────────────────────────────────────────
    try:
        _get_ch_client().ping()
        logger.info("ClickHouse холболт амжилттай")
    except Exception as exc:  # noqa: BLE001
        logger.warning("ClickHouse холболт алдаа (дараа дахин оролдоно): {}", exc)
    yield


app = FastAPI(
    title="Excel Report Python Runner",
    description="NestJS-ийн Excel тайлангийн pandas кодыг ажиллуулдаг дотоод FastAPI сервис.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.environ.get("PYTHON_ENV", "development") == "development" else None,
    redoc_url=None,
)

# ── CORS: зөвхөн дотоод сервисүүд зөвшөөрнө ──────────────────────────────────
_cors_origins = [
    o.strip()
    for o in os.environ.get("PYTHON_CORS_ORIGINS", "http://localhost:3001,http://127.0.0.1:3001").split(",")
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
    preview_limit: int = 50  # зөвхөн /preview endpoint ашиглана


class RunToolRequest(BaseModel):
    """Python API Tools ажиллуулах request."""
    code: str
    connection_type: str = "clickhouse"  # clickhouse | oracle | clickhouse_oracle
    connection_config: Optional[dict[str, Any]] = None  # host,port,user,password,database,dsn,...
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    filters: Optional[dict[str, Any]] = None
    output_format: str = "excel"  # excel | json | csv
    preview_limit: int = 50


# ── Код гүйцэтгэх helper ──────────────────────────────────────────────────────

def _check_code_safety(code: str) -> None:
    """
    Аюултай Python кодын загварыг хаана.
    Admin хэрэглэгч л бичдэг ч дотоод сүлжээнд хамгаалалт хэрэгтэй.
    """
    import re as _re

    BLOCKED = [
        "import subprocess",
        "from subprocess",
        "import socket",
        "from socket",
        "import shutil",
        "from shutil",
        "__import__",
        "importlib",
        "builtins",
        "__builtins__",
        "__dict__",
        "__class__",
        "__subclasses__",
        "__globals__",
        "__getattr__",
        "getattr(",
        "setattr(",
        "delattr(",
        "globals(",
        "locals(",
        "vars(",
        "dir(",
        "exec(",
        "eval(",
        "compile(",
        "os.system",
        "os.popen",
        "os.execv",
        "os.spawn",
        "os.environ",
        "os.path",
        "os.remove",
        "os.unlink",
        "os.rmdir",
        "os.listdir",
        "open(",
        "pickle",
        "marshal",
        "shelve",
        "yaml.load",
        "yaml.unsafe_load",
    ]
    code_lower = code.lower()
    for pattern in BLOCKED:
        if pattern.lower() in code_lower:
            raise HTTPException(
                status_code=400,
                detail=f"Аюулгүй байдлын хязгаарлалт: '{pattern}' ашиглах боломжгүй.",
            )

    # Regex-based checks to catch concatenation bypass attempts like 'ex'+'ec'
    # and import via __dict__, chr() construction, etc.
    BLOCKED_PATTERNS = [
        r"__\w+__",          # any dunder attribute access
        r"chr\s*\(",         # chr() can build arbitrary strings
        r"ord\s*\(",         # ord() helper for chr bypass
        r"\btype\s*\(",      # type() can create classes dynamically (word boundary to allow astype)
        r"breakpoint\s*\(",  # debugger access
    ]
    for pat in BLOCKED_PATTERNS:
        if _re.search(pat, code):
            raise HTTPException(
                status_code=400,
                detail=f"Аюулгүй байдлын хязгаарлалт: '{pat}' загвар ашиглах боломжгүй.",
            )

    # SQL mutation хориглох: зөвхөн SELECT зөвшөөрнө
    SQL_MUTATE_PATTERNS = [
        r"\bINSERT\s+INTO\b",
        r"\bUPDATE\s+\w",
        r"\bDELETE\s+FROM\b",
        r"\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|USER|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION)\b",
        r"\bTRUNCATE\s+",
        r"\bALTER\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|USER|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION)\b",
        r"\bCREATE\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|USER|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION)\b",
        r"\bGRANT\s+",
        r"\bREVOKE\s+",
        r"\bMERGE\s+INTO\b",
        r"\bEXECUTE\s+",
        r"\bCALL\s+",
    ]
    for pat in SQL_MUTATE_PATTERNS:
        if _re.search(pat, code, _re.IGNORECASE):
            raise HTTPException(
                status_code=400,
                detail=f"Зөвхөн SELECT query зөвшөөрөгдөнө. '{pat}' ашиглах боломжгүй.",
            )


# ── Restricted builtins for exec() sandbox ─────────────────────────────────────
import builtins as _builtins

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


def _execute_code(req: RunReportRequest) -> Any:
    """
    Загварын Python кодыг аюулгүй namespace-д ажиллуулна.

    Кодын доторх нэрс:
        conn        - clickhouse_connect клиент (conn.query_df(...) ашиглана)
        pd          - pandas
        np          - numpy
        start_date  - огноо мөр (жишээ: '2024-01-01')
        end_date    - огноо мөр
        filters     - dict (нэмэлт шүүлтүүрүүд)
        result      - КОД ЗААВАЛ ЭНД ДҮН ОНООХ ЁСТОЙ

    Хүлээгдэж буй result:
        pd.DataFrame       - нэг sheet
        [(нэр, df), ...]    - олон sheet
    """
    _check_code_safety(req.code)
    conn = _get_ch_client()
    namespace: dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        "conn": conn,
        "pd": pd,
        "np": np,
        "start_date": req.start_date or "",
        "end_date": req.end_date or req.start_date or "",
        "filters": req.filters or {},
        "result": None,
    }
    try:
        _exec_with_timeout(req.code, namespace)
    except _ExecTimeoutError as exc:
        raise HTTPException(status_code=408, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Report код алдаа: {}: {}", type(exc).__name__, exc)
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
                "Код доторхоо заавал `result = df` эсвэл "
                "`result = [('Sheet1', df1), ('Sheet2', df2)]` гэж бичнэ үү."
            ),
        )
    return result


def _execute_tool_code(req: RunToolRequest) -> Any:
    """
    Python API Tool-ийн кодыг ажиллуулна.
    conn нь connectionType-оос хамааран ClickHouse/Oracle/MSSQL/None байна.
    """
    _check_code_safety(req.code)
    conn = _make_connection(req.connection_type, req.connection_config)
    namespace: dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        "conn": conn,
        "pd": pd,
        "np": np,
        "start_date": req.start_date or "",
        "end_date": req.end_date or req.start_date or "",
        "filters": req.filters or {},
        "result": None,
    }
    try:
        _exec_with_timeout(req.code, namespace)
    except _ExecTimeoutError as exc:
        raise HTTPException(status_code=408, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Tool код алдаа: {}: {}", type(exc).__name__, exc)
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
                "`result = df` эсвэл `result = [('Sheet1', df1)]` гэж бичнэ үү."
            ),
        )
    return result


def _result_to_excel_bytes(result: Any) -> bytes:
    """result (DataFrame эсвэл жагсаалт) -> Excel bytes."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        if isinstance(result, pd.DataFrame):
            result.to_excel(writer, sheet_name="Sheet1", index=False)
        elif isinstance(result, list):
            if not result:
                raise HTTPException(status_code=400, detail="result жагсаалт хоосон байна.")
            for sheet_name, df in result:
                if not isinstance(df, pd.DataFrame):
                    raise HTTPException(
                        status_code=400,
                        detail=f"'{sheet_name}' sheet-ийн утга DataFrame биш байна.",
                    )
                df.to_excel(writer, sheet_name=str(sheet_name)[:31], index=False)
        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "result нь pd.DataFrame эсвэл [(sheet_name, df), ...] байх ёстой. "
                    f"Одоогийн төрөл: {type(result).__name__}"
                ),
            )
    output.seek(0)
    return output.read()


def _result_to_csv_bytes(result: Any) -> bytes:
    """result -> CSV bytes (UTF-8 BOM)."""
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


def _sanitize_df_for_json(df: pd.DataFrame) -> pd.DataFrame:
    """datetime/Timestamp баганыг string болгоно."""
    df = df.copy()
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.strftime("%Y-%m-%d %H:%M:%S").where(df[col].notna(), None)
    return df


def _df_to_preview(df: pd.DataFrame, limit: int) -> dict:
    sample = _sanitize_df_for_json(df.head(limit))
    clean = sample.astype(object).where(pd.notna(sample), None)
    return {
        "columns": list(sample.columns),
        "rows": clean.values.tolist(),
        "totalCount": len(df),
    }


# ── POST /run-report - Excel файл буцаана ─────────────────────────────────────

@app.post(
    "/run-report",
    summary="Pandas код ажиллуулж Excel буцаана",
    response_class=Response,
    dependencies=[Depends(_verify_api_key)],
)
def run_report(req: RunReportRequest) -> Response:
    result = _execute_code(req)
    excel_bytes = _result_to_excel_bytes(result)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ── POST /preview - эхний N мөрийг JSON-оор буцаана ──────────────────────────

@app.post(
    "/preview",
    summary="Pandas код ажиллуулж эхний N мөрийг JSON-оор буцаана",
    dependencies=[Depends(_verify_api_key)],
)
def preview_report(req: RunReportRequest) -> JSONResponse:
    result = _execute_code(req)
    limit = max(1, min(req.preview_limit, 500))

    if isinstance(result, pd.DataFrame):
        return JSONResponse(_df_to_preview(result, limit))
    elif isinstance(result, list) and result:
        sheet_name, df = result[0]
        return JSONResponse({**_df_to_preview(df, limit), "sheet": str(sheet_name)})
    else:
        raise HTTPException(status_code=400, detail="result нь DataFrame байх ёстой.")


# ── POST /run-tool - Python API Tool: outputFormat-оос хамааран буцаана ───────

@app.post(
    "/run-tool",
    summary="Python API Tool ажиллуулна (excel | json | csv буцааж болно)",
    dependencies=[Depends(_verify_api_key)],
)
def run_tool(req: RunToolRequest) -> Response:
    result = _execute_tool_code(req)
    fmt = (req.output_format or "excel").lower()

    if fmt == "excel":
        content = _result_to_excel_bytes(result)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    if fmt == "csv":
        content = _result_to_csv_bytes(result)
        return Response(content=content, media_type="text/csv; charset=utf-8")
    if fmt == "json":
        # JSON output: single DataFrame -> {columns, rows}; list -> {sheets: [{name, columns, rows}]}
        if isinstance(result, pd.DataFrame):
            result = _sanitize_df_for_json(result)
            clean = result.astype(object).where(pd.notna(result), None)
            return JSONResponse(
                {"columns": list(result.columns), "rows": clean.values.tolist()}
            )
        elif isinstance(result, list):
            sheets = []
            for name, df in result:
                df = _sanitize_df_for_json(df)
                clean = df.astype(object).where(pd.notna(df), None)
                sheets.append(
                    {"name": str(name), "columns": list(df.columns), "rows": clean.values.tolist()}
                )
            return JSONResponse({"sheets": sheets})
        else:
            raise HTTPException(status_code=400, detail="result нь DataFrame байх ёстой.")
    raise HTTPException(status_code=400, detail=f"Дэмжигдээгүй outputFormat: '{fmt}'. excel | json | csv")


# ── POST /preview-tool - Python API Tool preview (эхний N мөр JSON) ──────────

@app.post(
    "/preview-tool",
    summary="Python API Tool-ийн preview (эхний N мөр JSON)",
    dependencies=[Depends(_verify_api_key)],
)
def preview_tool(req: RunToolRequest) -> JSONResponse:
    result = _execute_tool_code(req)
    limit = max(1, min(req.preview_limit, 500))

    if isinstance(result, pd.DataFrame):
        return JSONResponse(_df_to_preview(result, limit))
    elif isinstance(result, list) and result:
        sheet_name, df = result[0]
        return JSONResponse({**_df_to_preview(df, limit), "sheet": str(sheet_name)})
    else:
        raise HTTPException(status_code=400, detail="result нь DataFrame байх ёстой.")


# ── GET /health - NestJS startup-д шалгана ────────────────────────────────────

@app.get("/health", summary="Сервис болон ClickHouse-ийн төлөв")
def health() -> dict:
    try:
        _get_ch_client().ping()
        ch_ok = True
    except Exception:  # noqa: BLE001
        ch_ok = False
    return {"status": "ok", "clickhouse": ch_ok}


# ── Шууд ажиллуулах ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("PYTHON_SERVICE_HOST", "127.0.0.1")
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
