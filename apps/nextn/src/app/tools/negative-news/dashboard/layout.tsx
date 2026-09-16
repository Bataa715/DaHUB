import { DashboardShell } from "@/components/shared/DashboardShell";

// Сөрөг мэдээний дашбоард — зүүн цэснээс бусад самбар руу шилжинэ.
// Бүртгэл оруулах хуудас (/tools/negative-news) нь хэрэгсэл тул shell-гүй.
export default function NegativeNewsDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
