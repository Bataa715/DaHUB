import "./alert-box.css";
import { DashboardShell } from "@/components/shared/DashboardShell";
import AlertBoxShell from "./_components/AlertBoxShell";

export default function AlertBoxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      <AlertBoxShell>{children}</AlertBoxShell>
    </DashboardShell>
  );
}
