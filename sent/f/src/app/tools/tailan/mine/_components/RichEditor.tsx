import React, { useRef, useState, useEffect } from "react";

// ─── Inline markdown renderer ─────────────────────────────────────────────────
export function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]*\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

// ─── Markdown-like content parser (supports tables, bullet/numbered lists) ────
export function parseContent(text: string, tc: { n: number }): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Pipe table
    if (line.trim().startsWith("|")) {
      const tLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tLines.push(lines[i]);
        i++;
      }
      const dataRows = tLines
        .filter((l) => !/^\s*\|[\s\-|]+\|\s*$/.test(l))
        .map((l) =>
          l
            .split("|")
            .filter(Boolean)
            .map((c) => c.trim()),
        );
      if (dataRows.length > 0) {
        tc.n++;
        const n = tc.n;
        nodes.push(
          <div key={`tbl-${i}`} style={{ marginBottom: "8pt" }}>
            <div
              style={{
                fontSize: "9pt",
                fontStyle: "italic",
                marginBottom: "2pt",
              }}
            >
              Хүснэгт {n}.
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "9.5pt",
              }}
            >
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr
                    key={ri}
                    style={
                      ri === 0 ? { background: "#1F3864", color: "#fff" } : {}
                    }
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{ border: "1px solid #888", padding: "3px 5px" }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }
    // Bullet list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul
          key={`ul-${i}`}
          style={{
            marginLeft: "20pt",
            marginBottom: "4pt",
            listStyleType: "disc",
          }}
        >
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: "2pt" }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} style={{ marginLeft: "20pt", marginBottom: "4pt" }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: "2pt" }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    // Normal paragraph
    nodes.push(
      <div
        key={i}
        style={{ textAlign: "justify" as const, marginBottom: "4pt" }}
      >
        {line ? renderInline(line) : "\u00A0"}
      </div>,
    );
    i++;
  }
  return <>{nodes}</>;
}

// ─── Table grid picker ────────────────────────────────────────────────────────
const GRID_ROWS = 8;
const GRID_COLS = 8;

function TableGridPicker({
  onPick,
}: {
  onPick: (rows: number, cols: number) => void;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  return (
    <div
      className="absolute z-50 top-full left-0 mt-1 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl"
      onMouseLeave={() => setHover(null)}
    >
      <div
        className="text-xs text-slate-400 mb-1.5 text-center"
        style={{ minWidth: 120 }}
      >
        {hover
          ? `${hover.r} мөр × ${hover.c} багана`
          : "Мөр × Багана сонгоно уу"}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 18px)`,
          gap: 2,
        }}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, idx) => {
          const r = Math.floor(idx / GRID_COLS) + 1;
          const c = (idx % GRID_COLS) + 1;
          const active = hover && r <= hover.r && c <= hover.c;
          return (
            <div
              key={idx}
              style={{ width: 18, height: 18, cursor: "pointer" }}
              className={`border rounded-sm transition ${active ? "bg-blue-500 border-blue-400" : "bg-slate-700 border-slate-500"}`}
              onMouseEnter={() => setHover({ r, c })}
              onMouseDown={(ev) => {
                ev.preventDefault();
                onPick(r, c);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Rich text toolbar + textarea ─────────────────────────────────────────────
export function RichToolbar({
  value,
  onChange,
  rows = 4,
  placeholder = "",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showGrid, setShowGrid] = useState(false);

  // Auto-resize: expand to full content height, no scroll
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  const apply = (before: string, after = "") => {
    const el = taRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = value.slice(s, e);
    const newVal = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(newVal);
    const cursor = s + before.length + sel.length + after.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertTable = (numRows: number, numCols: number) => {
    const header =
      "|" +
      Array.from({ length: numCols }, (_, i) => `Гарчиг ${i + 1}`).join("|") +
      "|";
    const separator =
      "|" + Array.from({ length: numCols }, () => "---").join("|") + "|";
    const dataRow =
      "|" + Array.from({ length: numCols }, () => "Утга").join("|") + "|";
    const dataRows = Array.from(
      { length: Math.max(1, numRows - 1) },
      () => dataRow,
    ).join("\n");
    const table = "\n" + header + "\n" + separator + "\n" + dataRows + "\n";
    apply(table);
    setShowGrid(false);
  };

  const btnCls =
    "px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition select-none";

  return (
    <div>
      <div className="flex gap-1 mb-1 flex-wrap items-center">
        <button
          type="button"
          className={btnCls}
          title="Тод"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("**", "**");
          }}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={btnCls}
          title="Цэглэсэн жагсаалт"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("\n- ");
          }}
        >
          •&nbsp;Жагсаалт
        </button>
        <button
          type="button"
          className={btnCls}
          title="Дугаарлалттай жагсаалт"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("\n1. ");
          }}
        >
          1.&nbsp;Дугаарлалт
        </button>
        <div className="relative">
          <button
            type="button"
            className={btnCls + (showGrid ? " bg-slate-600" : "")}
            title="Хүснэгт оруулах"
            onMouseDown={(ev) => {
              ev.preventDefault();
              setShowGrid((v) => !v);
            }}
          >
            ⊞&nbsp;Хүснэгт
          </button>
          {showGrid && (
            <>
              <div
                className="fixed inset-0 z-40"
                onMouseDown={() => setShowGrid(false)}
              />
              <TableGridPicker onPick={insertTable} />
            </>
          )}
        </div>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={className}
        style={{ overflow: "hidden", resize: "none" }}
      />
    </div>
  );
}
