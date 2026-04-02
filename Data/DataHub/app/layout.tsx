import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Golomt DataDoc',
  description: 'Golomt Bank Internal Data Documentation Hub',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className="dark">
      <body>
        <div className="flex h-screen overflow-hidden bg-[#020617]">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-[#020617]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
