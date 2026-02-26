"use client";

import { motion } from "framer-motion";
import { ArrowRight, UserPlus, KeyRound } from "lucide-react";
import Image from "next/image";
import { PARTICLE_POSITIONS } from "./login.types";

interface FlowSelectorProps {
  onSelect: (flow: "register" | "login") => void;
}

export function FlowSelector({ onSelect }: FlowSelectorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/20 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-600/20 to-transparent rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        {PARTICLE_POSITIONS.map((pos, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{
              duration: 3 + (i % 5),
              repeat: Infinity,
              delay: (i % 10) * 0.2,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-4xl px-6"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-6 overflow-hidden bg-white shadow-2xl shadow-blue-500/20"
          >
            <Image
              src="/golomt.jpg"
              alt="Golomt Logo"
              width={96}
              height={96}
              className="object-contain"
            />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              DaHUB
            </span>
          </motion.h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Register Card */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, type: "spring" }}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect("register")}
            className="group cursor-pointer"
          >
            <div className="relative p-1 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 shadow-2xl shadow-blue-500/20">
              <div className="bg-slate-900/90 backdrop-blur-xl rounded-[22px] p-8 h-full">
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                  >
                    <UserPlus className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
                    Бүртгүүлэх
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Шинээр бүртгүүлэх ба нэвтрэх ID үүсгэх
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-blue-400 group-hover:gap-4 transition-all">
                    <span className="text-sm font-medium">Эхлэх</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, type: "spring" }}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect("login")}
            className="group cursor-pointer"
          >
            <div className="relative p-1 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 shadow-2xl shadow-purple-500/20">
              <div className="bg-slate-900/90 backdrop-blur-xl rounded-[22px] p-8 h-full">
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                  >
                    <KeyRound className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">
                    Нэвтрэх
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Бүртгэлтэй бол ID-ээрээ нэвтрэх
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-purple-400 group-hover:gap-4 transition-all">
                    <span className="text-sm font-medium">Үргэлжлүүлэх</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
