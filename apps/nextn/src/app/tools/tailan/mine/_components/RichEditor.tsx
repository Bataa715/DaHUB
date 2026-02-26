import React, { useRef } from "react";

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
export function parseContent(
  text: string,
  tc: { n: number },
): React.ReactNode {
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

  const btnCls =
    "px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition select-none";

  return (
    <div>
      <div className="flex gap-1 mb-1 flex-wrap">
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
          •
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
          1.
        </button>
        <button
          type="button"
          className={btnCls}
          title="Хүснэгт оруулах"
          onMouseDown={(ev) => {
            ev.preventDefault();
            apply("\n|Гарчиг 1|Гарчиг 2|\n|---|---|\n|Утга|Утга|\n");
          }}
        >
          ⊞
        </button>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}
