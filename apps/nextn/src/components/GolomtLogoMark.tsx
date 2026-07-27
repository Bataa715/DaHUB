/**
 * Голомт Банкны албан ёсны лого (буга хээ + G тэмдэг + "ГОЛОМТ БАНК" бичиг +
 * уриа) — жинхэнэ зургаас гаргаж авсан цул alpha-mask бөгөөд вебийн фонтоор
 * бичиг дахин үүсгэхгүй, харин эх зургийг өөрийг нь ашигладаг тул харагдах
 * байдал 100% жинхэнэ логотой ижил. CSS mask-image ашигладаг тул SVG-ийн
 * fill-rule-той холбоотой браузер хоорондын зөрүү гарахгүй, currentColor-оор
 * дамжуулан dark/light темийг автоматаар дагана.
 */
export function GolomtLogoMark({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "currentColor",
        aspectRatio: "2366 / 687",
        WebkitMaskImage: "url(/golomt-logo-mask.png)",
        maskImage: "url(/golomt-logo-mask.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      aria-hidden="true"
    />
  );
}
