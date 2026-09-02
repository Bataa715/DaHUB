import { redirect } from "next/navigation";

/** Хуучин nested URL — deploy дээр 404 гардаг байсан тул query view руу шилжүүлнэ. */
export default function RelatedPartyTransactionsRedirect() {
  redirect("/tools/monitoring-box?tool=related-party");
}
