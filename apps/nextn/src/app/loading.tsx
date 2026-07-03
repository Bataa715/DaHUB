/**
 * Глобал route loading UI — хуудасны chunk ачаалагдах хооронд
 * шууд харагдах тул шилжилт гацаагүй, зөөлөн мэдрэгдэнэ.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
        role="status"
        aria-label="Ачааллаж байна"
      />
    </div>
  );
}
