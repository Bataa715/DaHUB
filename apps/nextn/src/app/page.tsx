"use client";

import HomeHero from "./_components/HomeHero";
import HomeEthics from "./_components/HomeEthics";

export default function HomePage() {
  return (
    <div className="min-h-full bg-background">
      <HomeHero />
      <HomeEthics />
    </div>
  );
}
