import { redirect } from "next/navigation";

/** Legacy tools grid — sidebar is primary nav; redirect home. */
export default function ToolsPage() {
  redirect("/");
}
