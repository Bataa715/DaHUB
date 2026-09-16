import { DashboardShell } from "@/components/shared/DashboardShell";

// Зардлын хяналт нь дашбоард — зүүн талын цэснээс бусад самбар руу нэг даралтаар шилжинэ.
export default function ExpenseAuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
