"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Copy,
  Check,
  Download,
  Loader2,
  ArrowLeft,
  X,
  FileSearch,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PdfToTextPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (f: File) => {
      if (!f.type.includes("pdf") && !f.name.endsWith(".pdf")) {
        toast({
          title: "Буруу файл",
          description: "Зөвхөн PDF файл оруулна уу",
          variant: "destructive",
        });
        return;
      }

      if (fileUrl) URL.revokeObjectURL(fileUrl);
      const url = URL.createObjectURL(f);

      setFile(f);
      setFileUrl(url);
      setExtractedText("");
      setPageCount(0);
      setCurrentPage(0);
      setError(null);
      setLoading(true);

      try {
        // Dynamic import to ensure client-side only
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        }).promise;

        const numPages: number = pdf.numPages;
        setPageCount(numPages);

        let fullText = "";

        for (let p = 1; p <= numPages; p++) {
          setCurrentPage(p);
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();

          // Group text items by rounded y-coordinate to reconstruct lines
          const lineMap = new Map<number, { x: number; text: string }[]>();

          for (const item of content.items) {
            if (!("str" in item) || !item.str) continue;
            const transform = (item as any).transform;
            // transform[5] = y, transform[4] = x
            const y = Math.round(transform[5]);
            const x = transform[4] as number;
            if (!lineMap.has(y)) lineMap.set(y, []);
            lineMap.get(y)!.push({ x, text: item.str });
          }

          // Sort lines top-to-bottom (y descending in PDF coords)
          const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

          const pageLines = sortedYs
            .map((y) => {
              // Sort items on the same line left-to-right
              const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
              return items
                .map((i) => i.text)
                .join(" ")
                .trim();
            })
            .filter((l) => l.length > 0);

          if (pageLines.length > 0) {
            fullText += `──── Хуудас ${p} / ${numPages} ────\n`;
            fullText += pageLines.join("\n");
            fullText += "\n\n";
          }
        }

        setExtractedText(fullText.trim() || "(Текст олдсонгүй)");
        setCurrentPage(0);
      } catch (err) {
        console.error(err);
        setError("PDF файл уншихад алдаа гарлаа. Файл гэмтсэн байж болзошгүй.");
        setExtractedText("");
      } finally {
        setLoading(false);
      }
    },
    [fileUrl, toast],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleCopy = useCallback(async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      toast({ title: "Хуулагдлаа", description: "Текст хуулбарлагдлаа" });
    } catch {
      toast({
        title: "Алдаа",
        description: "Хуулах боломжгүй байна",
        variant: "destructive",
      });
    }
  }, [extractedText, toast]);

  const handleDownload = useCallback(() => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name.replace(/\.pdf$/i, "") ?? "output") + ".txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [extractedText, file]);

  const handleClear = useCallback(() => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl(null);
    setExtractedText("");
    setPageCount(0);
    setCurrentPage(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [fileUrl]);

  const charCount = extractedText
    .replace(/──── Хуудас.*────\n/g, "")
    .trim().length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Буцах
          </Link>
          <span className="text-border">/</span>
          <FileSearch className="w-4 h-4 text-pink-400" />
          <span className="font-semibold text-foreground">PDF → Текст</span>

          {/* Stats */}
          <div className="flex items-center gap-2 ml-2">
            {pageCount > 0 && (
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {pageCount} хуудас
              </span>
            )}
            {charCount > 0 && (
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {charCount.toLocaleString()} тэмдэгт
              </span>
            )}
          </div>

          {/* Loading progress */}
          {loading && currentPage > 0 && pageCount > 0 && (
            <span className="ml-auto text-xs text-pink-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {currentPage} / {pageCount} хуудас уншиж байна...
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          {!file ? (
            /* ── Drop Zone ── */
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center"
              style={{ minHeight: "calc(100vh - 8rem)" }}
            >
              <div
                className={`
                  relative w-full max-w-md border-2 border-dashed rounded-2xl p-14
                  flex flex-col items-center gap-5 cursor-pointer select-none
                  transition-all duration-200
                  ${
                    dragging
                      ? "border-pink-400 bg-pink-500/10 scale-[1.02]"
                      : "border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50"
                  }
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <motion.div
                  animate={{ scale: dragging ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-600 shadow-xl shadow-pink-500/30"
                >
                  <Upload className="w-9 h-9 text-white" />
                </motion.div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-slate-200">
                    PDF файл оруулна уу
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Энд чирж хаях эсвэл дарж сонгох
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    .pdf формат дэмжигдэнэ
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFile(f);
                  }}
                />
              </div>
            </motion.div>
          ) : (
            /* ── Two-column layout ── */
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              style={{ height: "calc(100vh - 8rem)" }}
            >
              {/* ── LEFT: PDF Preview ── */}
              <div className="flex flex-col gap-2 min-h-0">
                {/* File info bar */}
                <div className="flex items-center justify-between flex-shrink-0 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span
                      className="text-sm font-medium text-slate-300 truncate"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-600 flex-shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 h-7 px-2 flex-shrink-0 ml-2"
                    onClick={handleClear}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Хаах
                  </Button>
                </div>

                {/* PDF iframe */}
                <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900 min-h-0">
                  <iframe
                    src={fileUrl!}
                    className="w-full h-full"
                    title="PDF Preview"
                    style={{ minHeight: "300px" }}
                  />
                </div>
              </div>

              {/* ── RIGHT: Extracted Text ── */}
              <div className="flex flex-col gap-2 min-h-0">
                {/* Toolbar */}
                <div className="flex items-center justify-between flex-shrink-0 px-1">
                  <span className="text-sm font-medium text-slate-300">
                    Гаргаж авсан текст
                  </span>
                  <div className="flex items-center gap-2">
                    {extractedText && !loading && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-xs border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-300"
                          onClick={handleDownload}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          .txt татах
                        </Button>
                        <Button
                          size="sm"
                          className={`h-7 px-3 text-xs transition-all duration-300 ${
                            copied
                              ? "bg-green-600 hover:bg-green-600 text-white"
                              : "bg-pink-600 hover:bg-pink-700 text-white"
                          }`}
                          onClick={handleCopy}
                        >
                          {copied ? (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Хуулагдлаа
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              Хуулах
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Text panel */}
                <div className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/60 min-h-0 relative overflow-hidden">
                  {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full border-4 border-slate-700" />
                        <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-300 font-medium">
                          Текст гаргаж авч байна...
                        </p>
                        {currentPage > 0 && pageCount > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            {currentPage} / {pageCount} хуудас
                          </p>
                        )}
                      </div>
                      {pageCount > 0 && (
                        <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-pink-500 rounded-full"
                            animate={{
                              width: `${(currentPage / pageCount) * 100}%`,
                            }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                    </div>
                  ) : error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                      <AlertCircle className="w-10 h-10 text-red-400" />
                      <p className="text-sm text-red-400 text-center">
                        {error}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-700 text-slate-300 hover:bg-slate-800"
                        onClick={handleClear}
                      >
                        Дахин оролдох
                      </Button>
                    </div>
                  ) : extractedText ? (
                    <div className="absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 hover:scrollbar-thumb-slate-500">
                      <pre className="p-4 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {extractedText}
                      </pre>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-slate-600 text-sm">Текст олдсонгүй</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
