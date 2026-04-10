"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Lazy load heavy components for better performance
const Hero = dynamic(() => import("./_components/hero-simple"), {
  loading: () => <div className="w-full min-h-[calc(100vh-120px)]" />,
});

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero with reserved space to prevent CLS */}
      <div className="min-h-[80vh]">
        <Suspense
          fallback={<div className="w-full min-h-[80vh] bg-background" />}
        >
          <Hero />
        </Suspense>
      </div>
    </div>
  );
}
