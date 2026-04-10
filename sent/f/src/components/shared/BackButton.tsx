"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface BackButtonProps {
  href?: string;
}

export default function BackButton({ href }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-24 z-40 w-fit mt-8 ml-4 md:ml-6"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="group flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 backdrop-blur-xl border border-border/50 shadow-lg hover:bg-primary hover:text-primary-foreground hover:border-primary/30 hover:shadow-primary/10 transition-all duration-300"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-300" />
        <span className="text-sm font-medium">Буцах</span>
      </Button>
    </motion.div>
  );
}
