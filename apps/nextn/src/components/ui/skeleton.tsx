import { cn } from "@/lib/utils";

/**
 * Skeleton — контентын хэлбэртэй ачааллын placeholder. "Уншиж байна" гэсэн
 * бухимдуулам текст харуулахын оронд контент өөрөө орж ирж байгаа мэт мэдрүүлж,
 * хүлээлтийг богино санагдуулна. Зөвхөн opacity-г pulse хийдэг тул хямд.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}
