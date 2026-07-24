import "./alert-box.css";
import AlertBoxShell from "./_components/AlertBoxShell";

export default function AlertBoxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AlertBoxShell>{children}</AlertBoxShell>;
}
