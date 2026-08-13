import { Skeleton } from "@/components/ui/skeleton";

/**
 * ReportSkeleton — эрсдэлийн тайлан ачаалагдах хооронд харуулах контент хэлбэртэй
 * placeholder. Спиннер + "уншиж байна" текстийн оронд хүснэгтийн хэлбэрийг өгснөөр
 * хүлээлт богино, зөөлөн санагдана.
 */
export default function ReportSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {/* Дүгнэлтийн блокууд */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-4 space-y-3"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>

      {/* Хүснэгт */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-0"
            style={{ opacity: 1 - i * (0.5 / rows) }}
          >
            <Skeleton className="h-4 w-9 rounded-full" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-12 rounded-md ml-auto" />
            <Skeleton className="h-5 w-12 rounded-md" />
            <Skeleton className="h-5 w-12 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
