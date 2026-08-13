import { redirect } from "next/navigation";

// [PERF] server-side redirect — no client JS bundle needed just to bounce.
export default function AdminPage() {
  redirect("/admin/tools");
}
