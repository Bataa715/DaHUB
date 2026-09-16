import { DashboardShell } from "@/components/shared/DashboardShell";

// Өгөгдлийн сангийн өөрчлөлтийн дашбоард — зүүн цэснээс бусад самбар руу шилжинэ.
// Оруулах/хянах хуудас (/tools/db-changes) нь хэрэгсэл тул shell-гүй.
export default function DbChangesDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
