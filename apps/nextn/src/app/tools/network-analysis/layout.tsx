import { DashboardShell } from "@/components/shared/DashboardShell";

// Сүлжээний шинжилгээний хоёр дашбоард — зүүн цэснээс бусад самбар руу шилжинэ.
export default function NetworkAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
