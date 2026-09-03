"use client";

/**
 * [AUDIT] Tool хуудасны route-level error boundary — нэг tool унахад бүх UI
 * (sidebar, nav) биш зөвхөн тухайн хуудасны хэсэг fallback болно.
 */
export default function ToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center space-y-3 max-w-md">
        <h2 className="text-lg font-semibold text-foreground">
          Алдаа гарлаа
        </h2>
        <p className="text-sm text-muted-foreground">
          Энэ хэрэгслийг ачаалахад түр зуурын алдаа гарлаа. Дахин оролдоно уу.
        </p>
        {error?.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Дахин ачаалах
        </button>
      </div>
    </div>
  );
}
