"use client";

import Image from "next/image";

const Footer = () => {
  return (
    <footer className="border-t min-h-[72px]">
      <div className="container flex items-center justify-center gap-4 py-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
          <Image
            src="/golomt.jpg"
            alt="Golomt"
            width={24}
            height={24}
            className="rounded"
          />
          <span className="text-xs text-muted-foreground">
            Голомт Банк • DaHUB • 2026
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
