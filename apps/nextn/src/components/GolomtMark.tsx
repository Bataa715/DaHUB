import { cn } from "@/lib/utils";

// SVG-г mask болгож currentColor-оор будна — бараан/цайвар дэвсгэр дээр ижил тод.
const MASK_STYLE = {
  WebkitMaskImage: "url(/golomt-mark.svg)",
  maskImage: "url(/golomt-mark.svg)",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
} as const;

/** Голомт банкны "G" тэмдэг (logomark). Өнгийг `text-*` классаар өгнө. */
export function GolomtMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block bg-current", className)}
      style={MASK_STYLE}
    />
  );
}
