"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";
import { GolomtMark } from "@/components/GolomtMark";

/**
 * Нэвтрэх хуудсуудын (хэрэглэгч / админ) бүтэн дэлгэцийн хоёр хуваалт:
 *  - Зүүн: банкны өнгөт самбар — зураг дээр хөх/индиго градиент, тэмдэг.
 *    Текст байхгүй (минимал).
 *  - Баруун: форм. Жижиг дэлгэцэнд зүүн самбар нуугдана.
 */
export function AuthSplitShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh max-h-dvh overflow-hidden bg-background lg:grid-cols-[minmax(0,7fr)_minmax(28rem,5fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0b1a4a] text-white lg:flex lg:flex-col">
        <Image
          src="/Login.jpg"
          alt=""
          fill
          priority
          quality={90}
          sizes="(min-width:1024px) 60vw, 0px"
          className="object-cover opacity-45"
        />
        {/* Банкны өнгөт давхарга — хар/цагаан биш, хөхөөс индиго руу */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-blue-600/70 via-indigo-700/70 to-violet-900/80 mix-blend-multiply"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-cyan-400/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/25 blur-3xl"
        />

        <div className="relative flex h-full items-center justify-center p-16">
          <motion.span
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="grid h-44 w-44 place-items-center rounded-[2.5rem] bg-white/10 ring-1 ring-white/25 backdrop-blur-md"
          >
            <GolomtMark className="h-24 w-24 text-white" />
          </motion.span>
        </div>
      </aside>

      <div className="relative flex min-h-0 justify-center overflow-y-auto px-6 py-10 sm:px-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="my-auto w-full max-w-[26rem]"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
