import { redirect } from "next/navigation";

/** Хэсгийн үндсэн зам — эхний дашбоард руу. */
export default function NetworkAnalysisHome() {
  redirect("/tools/network-analysis/config-changes");
}
