"use client";

import Image from "next/image";

const Footer = () => {
  return (
    <footer className="py-3 flex items-center justify-center border-t border-border/30">
      <div className="flex items-center gap-2">
        <Image
          src="/golomt.jpg"
          alt="Golomt"
          width={18}
          height={18}
          className="rounded opacity-70"
        />
        <span className="text-xs text-muted-foreground/60">Голомт Банк</span>
      </div>
    </footer>
  );
};

export default Footer;
