"use client";

import { useId, type ReactNode } from "react";

export type HomeArtVariant = "news" | "dashboard" | "tools" | "risk";

const PALETTE: Record<HomeArtVariant, { base: string; glow: string; deep: string }> = {
  news: { base: "#2563eb", glow: "#93c5fd", deep: "#0b1a4a" },
  dashboard: { base: "#7c3aed", glow: "#c4b5fd", deep: "#1e0f4a" },
  tools: { base: "#0d9488", glow: "#5eead4", deep: "#06302f" },
  risk: { base: "#e11d48", glow: "#fda4af", deep: "#3f0a1c" },
};

/** Шалны түвшин — объектууд үүн дээр зогсож, доош нь тусгал буусан харагдана. */
const FLOOR = 250;
const GLASS_STROKE = "rgba(255,255,255,0.6)";

const pt = (cx: number, cy: number, r: number, a: number) =>
  `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;

/** Шүдтэй араа + голын нүх (evenodd). Тооцоо тогтмол тул SSR/hydration зөрөхгүй. */
function gearPath(cx: number, cy: number, rOuter: number, rInner: number, teeth: number, rHole: number) {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push(
      pt(cx, cy, rInner, a),
      pt(cx, cy, rOuter, a + step * 0.12),
      pt(cx, cy, rOuter, a + step * 0.42),
      pt(cx, cy, rInner, a + step * 0.54),
    );
  }
  const hole = `M${cx + rHole} ${cy} A${rHole} ${rHole} 0 1 0 ${cx - rHole} ${cy} A${rHole} ${rHole} 0 1 0 ${cx + rHole} ${cy} Z`;
  return `M${pts.join(" L")} Z ${hole}`;
}

const SHIELD =
  "M200 52 L278 82 L278 150 C278 200 246 232 200 250 C154 232 122 200 122 150 L122 82 Z";

/**
 * Нүүр хуудасны 4 үндсэн картын зураг — харанхуй тайз, прожекторын туяа, гэрэлтсэн
 * шал дээр зогсох шилэн объект (Голомтын "G" тэмдэгтэй). Гадны зураг/сервис
 * ашиглахгүй, бүгд inline SVG.
 */
export function HomeCardArt({
  variant,
  className,
}: {
  variant: HomeArtVariant;
  className?: string;
}) {
  // useId нь ":" агуулдаг — url(#...) дотор эвдэрдэг тул цэвэрлэнэ.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${name}-${uid}`;
  const ref = (name: string) => `url(#${id(name)})`;
  const p = PALETTE[variant];

  const mark = (x: number, y: number, size: number, opacity = 0.92) => (
    <image
      href="/golomt-mark.svg"
      x={x}
      y={y}
      width={size}
      height={size}
      filter={ref("mark")}
      opacity={opacity}
    />
  );

  let scene: ReactNode;
  if (variant === "news") {
    scene = (
      <g>
        <rect
          x="104"
          y="98"
          width="100"
          height="146"
          rx="6"
          fill={ref("glass")}
          stroke={GLASS_STROKE}
          strokeWidth="1"
          opacity="0.55"
          transform="rotate(-9 154 244)"
        />
        <polygon points="262,66 276,74 276,254 262,248" fill={ref("side")} stroke="rgba(255,255,255,0.35)" />
        <rect x="138" y="66" width="124" height="182" rx="6" fill={ref("glass")} stroke={GLASS_STROKE} strokeWidth="1.2" />
        <line x1="144" y1="70" x2="256" y2="70" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.5" />
        {mark(182, 84, 36)}
        <rect x="156" y="134" width="88" height="7" rx="3.5" fill="#fff" fillOpacity="0.8" />
        <rect x="156" y="148" width="62" height="7" rx="3.5" fill="#fff" fillOpacity="0.55" />
        {[170, 182, 194, 206].map((y, i) => (
          <rect key={y} x="156" y={y} width={[88, 80, 88, 54][i]} height="4" rx="2" fill="#fff" fillOpacity="0.32" />
        ))}
        <rect x="156" y="220" width="42" height="16" rx="3" fill={p.glow} fillOpacity="0.4" />
      </g>
    );
  } else if (variant === "dashboard") {
    const bars = [
      { x: 112, h: 70 },
      { x: 156, h: 112 },
      { x: 200, h: 92 },
      { x: 244, h: 152 },
    ];
    const base = 248;
    scene = (
      <g>
        {bars.map(({ x, h }) => (
          <g key={x}>
            <polygon
              points={`${x + 32},${base - h} ${x + 42},${base - h - 6} ${x + 42},${base - 6} ${x + 32},${base}`}
              fill={ref("side")}
              stroke="rgba(255,255,255,0.3)"
            />
            <polygon
              points={`${x},${base - h} ${x + 10},${base - h - 6} ${x + 42},${base - h - 6} ${x + 32},${base - h}`}
              fill="#fff"
              fillOpacity="0.35"
            />
            <rect x={x} y={base - h} width="32" height={h} fill={ref("glass")} stroke={GLASS_STROKE} strokeWidth="1.1" />
          </g>
        ))}
        <polyline
          points="128,160 172,120 216,138 260,78"
          fill="none"
          stroke={p.glow}
          strokeWidth="7"
          strokeLinejoin="round"
          opacity="0.55"
          filter={ref("soft")}
        />
        <polyline points="128,160 172,120 216,138 260,78" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        {[
          [128, 160],
          [172, 120],
          [216, 138],
          [260, 78],
        ].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r="4.5" fill="#fff" />
        ))}
        <circle cx="130" cy="84" r="27" fill={ref("orb")} stroke="rgba(255,255,255,0.55)" />
        {mark(114, 68, 32)}
      </g>
    );
  } else if (variant === "tools") {
    const big = gearPath(214, 160, 86, 70, 12, 32);
    const small = gearPath(130, 208, 42, 33, 9, 13);
    scene = (
      <g>
        <path d={big} transform="translate(8 6)" fill={ref("side")} fillRule="evenodd" />
        <path d={big} fill={ref("glass")} fillRule="evenodd" stroke={GLASS_STROKE} strokeWidth="1.2" />
        <circle cx="214" cy="160" r="50" fill="none" stroke="#fff" strokeOpacity="0.3" />
        {mark(192, 138, 44)}
        <path d={small} transform="translate(6 4)" fill={ref("side")} fillRule="evenodd" />
        <path d={small} fill={ref("glass")} fillRule="evenodd" stroke={GLASS_STROKE} strokeWidth="1.1" />
      </g>
    );
  } else {
    scene = (
      <g>
        <path d={SHIELD} transform="translate(9 6)" fill={ref("side")} />
        <path d={SHIELD} fill={ref("glass")} stroke={GLASS_STROKE} strokeWidth="1.3" />
        <path
          d={SHIELD}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.4"
          transform="translate(200 150) scale(0.78) translate(-200 -150)"
        />
        <path d="M134 90 L200 65" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" />
        {mark(174, 118, 52)}
      </g>
    );
  }

  const floorEdge = `M-10 ${FLOOR + 34} L200 ${FLOOR} L410 ${FLOOR + 34}`;

  return (
    <svg
      viewBox="0 0 400 520"
      preserveAspectRatio="xMidYMin slice"
      className={className}
      aria-hidden
    >
      <defs>
        <radialGradient id={id("bg")} cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor={p.base} stopOpacity="0.6" />
          <stop offset="45%" stopColor={p.deep} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#05060d" />
        </radialGradient>
        <linearGradient id={id("beam")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.glow} stopOpacity="0.55" />
          <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="45%" stopColor={p.glow} stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.24" />
        </linearGradient>
        <linearGradient id={id("side")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={p.base} stopOpacity="0.6" />
          <stop offset="100%" stopColor={p.deep} stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id={id("orb")} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="35%" stopColor={p.glow} stopOpacity="0.75" />
          <stop offset="100%" stopColor={p.base} stopOpacity="0.95" />
        </radialGradient>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id={id("soft")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* SVG тэмдгийг (currentColor → хар) цагаан болгоно, alpha хэвээр */}
        <filter id={id("mark")}>
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
        </filter>
        <mask id={id("reflect")}>
          <rect x="0" y={FLOOR} width="400" height="130" fill={ref("fade")} />
        </mask>
      </defs>

      <rect width="400" height="520" fill={ref("bg")} />
      <polygon
        points={`168,0 232,0 336,${FLOOR} 64,${FLOOR}`}
        fill={ref("beam")}
        filter={ref("blur")}
        opacity="0.75"
      />
      <ellipse cx="200" cy={FLOOR} rx="150" ry="16" fill={p.glow} opacity="0.35" filter={ref("blur")} />
      <path d={floorEdge} fill="none" stroke={p.glow} strokeWidth="7" opacity="0.55" filter={ref("soft")} />
      <path d={floorEdge} fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.8" />

      <g mask={ref("reflect")}>
        <g transform={`translate(0 ${FLOOR * 2}) scale(1 -1)`}>{scene}</g>
      </g>
      {scene}
    </svg>
  );
}
