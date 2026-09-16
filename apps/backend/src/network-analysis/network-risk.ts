/**
 * Сүлжээний шинжилгээний эрсдэлийн логик — цэвэр функцүүд.
 *
 * Эх сурвалж: өмнөх "Network Security RPA" систем (Django) — `risk_analyzer.py`,
 * `xdr_classifier.py`. Аудиторт ойлгомжтой байх үүднээс ML биш, тогтмол
 * дүрмийн хүснэгт ашиглана: ижил оролт → үргэлж ижил үр дүн.
 *
 * ⚠️ Дүрэм өөрчилбөл `network-risk.spec.ts`-ийг шинэчилнэ.
 */

export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

// ── Palo Alto тохиргооны өөрчлөлт ──────────────────────────────────────────

type RuleSet = { level: RiskLevel; score: number; rules: [string, RegExp][] };

/** Дээрээс доош шалгана — эхний таарсан дүрэм шийднэ. */
const CONFIG_RULESETS: RuleSet[] = [
  {
    level: "Critical",
    score: 90,
    rules: [
      // Удирдлага, админ
      [
        "ping_untrusted",
        /(management|interface).*ping.*enable|ping.*untrusted/i,
      ],
      ["ssh_untrusted", /(management|interface).*ssh.*enable|ssh.*untrusted/i],
      [
        "https_untrusted",
        /(management|interface).*(https?|web).*enable|https?.*untrusted/i,
      ],
      ["shared_admin", /admin.*shared|shared.*account|account.*share/i],
      [
        "excessive_privilege",
        /superuser|admin.*role|excessive.*privilege|root.*access/i,
      ],
      // Аюулгүй байдал, бодлого
      ["any_any_allow", /any.*any.*allow|unrestricted.*allow|permit.*all/i],
      [
        "disabled_security",
        /security.*disable|av.*disable|ips.*disable|threat.*disable|profile.*disable/i,
      ],
      ["no_inspection", /no.*inspection|bypass.*check|skip.*scan/i],
    ],
  },
  {
    level: "High",
    score: 70,
    rules: [
      ["snmp_v1_v2", /snmp.*v[12]|snmp.*community|snmpv1|snmpv2/i],
      ["snmp_set", /snmp.*set.*enable|snmp.*write/i],
      ["no_mfa", /no.*mfa|mfa.*disable|multi.?factor.*disable/i],
      [
        "logging_disabled",
        /logging.*disable|audit.*disable|log.*disable|syslog.*disable/i,
      ],
      ["no_appid", /app.?id.*disable|application.*id.*disable|no.*app.?id/i],
      ["overbroad_nat", /nat.*0\.0\.0\.0|nat.*any|nat.*broadcast/i],
      ["dnat_sensitive", /destination.*nat.*(server|database|email|ftp)/i],
      ["decryption_disabled", /decryption.*disable|ssl.*disable|tls.*disable/i],
      ["zone_collapse", /zone.*collapse|zone.*merge|zone.*flat/i],
    ],
  },
  {
    level: "Medium",
    score: 50,
    rules: [
      ["response_pages", /response.*page.*enable|error.*page.*public/i],
      ["ha_misconfigured", /ha.*misconfigur|ha.*unsync|failover.*issue/i],
    ],
  },
];

export interface ConfigRiskInput {
  path?: string;
  cmd?: string;
  detail?: string;
  beforeValue?: string;
  afterValue?: string;
}

export interface ConfigRiskResult {
  level: RiskLevel;
  score: number;
  /** Таарсан дүрмийн нэр — энгийн өөрчлөлт бол `null` */
  rule: string | null;
}

export function analyzeConfigRisk(input: ConfigRiskInput): ConfigRiskResult {
  const text = [
    input.path,
    input.cmd,
    input.detail,
    input.beforeValue,
    input.afterValue,
  ]
    .map((v) => v ?? "")
    .join(" ")
    .toLowerCase();

  for (const set of CONFIG_RULESETS) {
    for (const [name, re] of set.rules) {
      if (re.test(text))
        return { level: set.level, score: set.score, rule: name };
    }
  }
  // Энгийн, өдөр тутмын тохиргоо
  return { level: "Low", score: 20, rule: null };
}

/**
 * Palo Alto логийн `detail` XML-ээс өмнөх/дараах утгыг гаргана.
 * `<before><![CDATA[...]]></before>` / `<after><![CDATA[...]]></after>`.
 */
export function parseDetailXml(detail: string | null | undefined): {
  before: string;
  after: string;
} {
  const src = detail ?? "";
  const pick = (tag: string) => {
    const open = `<${tag}><![CDATA[`;
    const close = `]]></${tag}>`;
    const start = src.indexOf(open);
    if (start === -1) return "";
    const end = src.indexOf(close, start + open.length);
    return end === -1 ? "" : src.slice(start + open.length, end);
  };
  return { before: pick("before"), after: pick("after") };
}

// ── Microsoft Defender XDR мэдэгдэл ────────────────────────────────────────

export const XDR_RISK_LEVELS: readonly RiskLevel[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

export const XDR_STATUSES = [
  "New",
  "In Progress",
  "Resolved",
  "Dismissed",
  "Escalated",
] as const;
export type XdrStatus = (typeof XDR_STATUSES)[number];

interface CatalogEntry {
  actionKeyword: string;
  category: string;
  privileged: boolean;
  baseRisk: string;
}

/** Үйлдлийн түлхүүр үгийн каталог — аудиторт тайлбарлахад хялбар тогтмол хүснэгт. */
export const XDR_CATALOG: readonly CatalogEntry[] = [
  {
    actionKeyword: "live response",
    category: "Response Action",
    privileged: true,
    baseRisk: "High",
  },
  {
    actionKeyword: "collect file",
    category: "Response Action",
    privileged: true,
    baseRisk: "Medium",
  },
  {
    actionKeyword: "isolate device",
    category: "Response Action",
    privileged: true,
    baseRisk: "Medium-High",
  },
  {
    actionKeyword: "release device",
    category: "Response Action",
    privileged: true,
    baseRisk: "Medium",
  },
  {
    actionKeyword: "antivirus scan",
    category: "Response Action",
    privileged: false,
    baseRisk: "Low",
  },
  {
    actionKeyword: "malware detected",
    category: "Detection",
    privileged: false,
    baseRisk: "Medium",
  },
  {
    actionKeyword: "incident created",
    category: "Incident Lifecycle",
    privileged: false,
    baseRisk: "Low",
  },
  {
    actionKeyword: "policy changed",
    category: "Config Change",
    privileged: true,
    baseRisk: "High",
  },
  {
    actionKeyword: "exclusion added",
    category: "Config Change",
    privileged: true,
    baseRisk: "High",
  },
  {
    actionKeyword: "device not reporting",
    category: "Operational",
    privileged: false,
    baseRisk: "Medium",
  },
];

// Урт түлхүүр үгийг түрүүлж шалгана — богино үг урт хэллэгийг дарахгүй.
const CATALOG_BY_LENGTH = [...XDR_CATALOG].sort(
  (a, b) => b.actionKeyword.length - a.actionKeyword.length,
);

function riskToIndex(name: string): number {
  const map: Record<string, number> = {
    low: 0,
    medium: 1,
    "medium-high": 2,
    "med-high": 2,
    high: 2,
    critical: 3,
  };
  return map[(name || "medium").toLowerCase()] ?? 1;
}

export function normalizeXdrText(raw: string | null | undefined): string {
  return (raw ?? "").toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

export function statusIndicatesCompleted(
  status: string | null | undefined,
): boolean {
  const v = (status ?? "").toLowerCase();
  return [
    "completed",
    "resolved",
    "succeeded",
    "success",
    "finished",
    "done",
  ].some((t) => v.includes(t));
}

/** Мэдэгдэл дэх чөлөөт статусыг зөвшөөрөгдсөн 5 утгын аль нэг рүү буулгана. */
export function normalizeXdrStatus(raw: string | null | undefined): XdrStatus {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.includes("progress")) return "In Progress";
  if (
    ["resolve", "closed", "complete", "success", "done"].some((t) =>
      v.includes(t),
    )
  )
    return "Resolved";
  if (v.includes("escalat")) return "Escalated";
  if (v.includes("dismiss")) return "Dismissed";
  return "New";
}

export interface XdrClassification {
  actionKeyword: string;
  category: string;
  baseRisk: RiskLevel;
  riskLevel: RiskLevel;
  privilegedAction: boolean;
  requiresReview: boolean;
  /** Шалтгаан бүр — аудитор яагаад энэ эрсдэл гарсныг харна */
  adjustments: string[];
}

export function classifyXdr(input: {
  text: string;
  sourceStatus: string;
  /** Нэг төхөөрөмж дээр өөр мэдэгдэл бүртгэгдсэн эсэх */
  deviceRepeated: boolean;
}): XdrClassification {
  const normalized = normalizeXdrText(input.text);
  const entry = CATALOG_BY_LENGTH.find((e) =>
    normalized.includes(e.actionKeyword),
  );

  const unknown = !entry;
  const baseIdx = riskToIndex(entry?.baseRisk ?? "Medium");
  const category = entry?.category ?? "Unknown";
  const privileged = entry?.privileged ?? false;

  const adjustments: string[] = [];
  if (privileged) adjustments.push("privileged");
  if (statusIndicatesCompleted(input.sourceStatus))
    adjustments.push("completed");
  if (category.toLowerCase().includes("response"))
    adjustments.push("response_action");
  // Танигдаагүй мэдэгдлийг зориуд дор хаяж дунд эрсдэлтэй гэж үзнэ
  if (unknown) adjustments.push("unknown_action");
  if (input.deviceRepeated) adjustments.push("repeated_device");

  const finalIdx = Math.min(
    baseIdx + adjustments.length,
    XDR_RISK_LEVELS.length - 1,
  );

  return {
    actionKeyword: entry?.actionKeyword ?? "unknown",
    category,
    baseRisk: XDR_RISK_LEVELS[Math.min(baseIdx, XDR_RISK_LEVELS.length - 1)],
    riskLevel: XDR_RISK_LEVELS[finalIdx],
    privilegedAction: privileged,
    requiresReview: finalIdx >= 2 || unknown || privileged,
    adjustments,
  };
}
