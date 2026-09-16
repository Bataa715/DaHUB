import { redirect } from "next/navigation";

/** Админ нүүр — sidebar-ийн эхний цэс (Хэрэгсэл) рүү шууд орно. */
export default function AdminPage() {
  redirect("/admin/tools");
}
