"use client";

export function SummaryBlock({
  title,
  cols,
  children,
}: {
  title: string;
  cols: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
          <tr>
            {cols.map((c, i) => (
              <th
                key={c}
                className={`px-3 py-1.5 font-semibold ${i === 0 ? "text-left" : "text-right"}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function SRow({
  label,
  v,
  prev,
  bold,
}: {
  label: string;
  v: number;
  prev?: number;
  bold?: boolean;
}) {
  const diff = prev !== undefined ? v - prev : null;
  return (
    <tr
      className={`border-t border-border transition-colors ${bold ? "font-bold bg-muted/30" : "hover:bg-accent/30"}`}
    >
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{v}</td>
      {prev !== undefined && (
        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
          <span>{prev}</span>
          {diff !== null && diff !== 0 && (
            <span
              className={`ml-1.5 text-[11px] font-semibold ${diff > 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {diff > 0 ? `+${diff}` : diff}
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
