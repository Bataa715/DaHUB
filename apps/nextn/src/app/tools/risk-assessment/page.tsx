import { redirect } from "next/navigation";

/** Салбарын эрсдэлийн үнэлгээний хаб /risk-assessment/salbar руу шилжсэн — хуучин холбоосыг дамжуулна. */
export default function RiskAssessmentLegacyPage() {
  redirect("/risk-assessment/salbar");
}
