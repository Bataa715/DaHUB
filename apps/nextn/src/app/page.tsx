"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Lazy load heavy components for better performance
const Hero = dynamic(() => import("./_components/hero-simple"), {
  loading: () => <div className="w-full flex-1" />,
});

export default function HomePage() {
  return (
    <div className="relative flex flex-col flex-1">
      {/* Hero with reserved space to prevent CLS */}
      <div className="flex flex-col flex-1">
        <Suspense
          fallback={<div className="w-full flex-1 bg-background" />}
        >
          <Hero />
        </Suspense>
      </div>
    </div>
  );
}
