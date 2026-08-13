"use client";

/**
 * App Router-ийн global error boundary. Root layout хүртэл унасан ноцтой алдааг
 * барьж, өөрийн <html>/<body>-той бүрэн хуудас рендерлэнэ. Үүнийг нэмснээр Next
 * нь build үед хуучин pages-router `_error`/`_document` (<Html> ашигладаг) руу
 * fallback хийхээ болино — энэ нь `next build`-ийн "/404 <Html>" prerender
 * алдааг арилгадаг.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="mn">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif",
          background: "#0d1017",
          color: "#e7ecf3",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
            Алдаа гарлаа
          </h1>
          <p style={{ color: "#a9b4c4", marginTop: "0.5rem" }}>
            Түр зуурын алдаа гарлаа. Дахин оролдоно уу.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#2f6db0",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Дахин ачаалах
          </button>
        </div>
      </body>
    </html>
  );
}
