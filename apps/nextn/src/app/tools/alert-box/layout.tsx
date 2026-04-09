import './alert-box.css';
import ABSidebar from './_components/ABSidebar';

export default function AlertBoxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ab-theme flex min-h-screen">
      <ABSidebar />
      <main className="flex-1 ml-[220px] min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
