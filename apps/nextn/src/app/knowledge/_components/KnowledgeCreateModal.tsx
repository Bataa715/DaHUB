"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Loader2, PenLine, Upload, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { KNOWLEDGE_MAX_IMAGES } from "@/lib/knowledge-image";
import {
  POST_CATEGORIES,
  categoryLabel,
  type KnowledgeCreateForm,
} from "../_lib/knowledge-utils";

export function KnowledgeCreateModal({
  form,
  setForm,
  loading,
  onUpload,
  onRemoveImage,
  onSubmit,
  onClose,
}: {
  form: KnowledgeCreateForm;
  setForm: Dispatch<SetStateAction<KnowledgeCreateForm>>;
  loading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (idx: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 landscape:p-2 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl sm:max-w-3xl md:w-[92vw] md:max-w-6xl md:h-[88vh] landscape:max-w-[94vw] landscape:h-[92vh] landscape:max-h-[92vh] max-h-[95vh] rounded-2xl overflow-hidden bg-card border border-border shadow-premium-xl ring-hairline flex flex-col"
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-border flex-shrink-0">
          <h2 className="text-foreground font-bold text-base flex items-center gap-2">
            <PenLine className="w-4 h-4 text-violet-500" />
            {t("knowledgeShare")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full px-5 sm:px-6 py-4 sm:py-5 grid grid-cols-1 md:grid-cols-[minmax(0,340px)_1fr] landscape:grid-cols-[minmax(0,320px)_1fr] gap-4 sm:gap-5 overflow-y-auto md:overflow-hidden landscape:overflow-hidden">
            <div className="space-y-4 md:overflow-y-auto landscape:overflow-y-auto md:pr-1">
              <div>
                <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                  {t("knowledgeTitleLabel")}
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  placeholder={t("knowledgeTitlePlaceholder")}
                />
              </div>
              <div>
                <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                  {t("knowledgeCategory")}
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full rounded-xl px-3 py-2 text-sm text-foreground bg-muted border border-input focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                >
                  {POST_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {categoryLabel(c.key, t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-foreground/70 text-xs font-semibold block mb-1.5">
                  {t("knowledgePageImageLabel")}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({form.imageUrls.length}/{KNOWLEDGE_MAX_IMAGES})
                  </span>
                </label>
                {form.imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {form.imageUrls.map((src, idx) => (
                      <div
                        key={`${idx}-${src.slice(0, 24)}`}
                        className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveImage(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/85 text-foreground flex items-center justify-center hover:bg-background"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {form.imageUrls.length < KNOWLEDGE_MAX_IMAGES && (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-xl cursor-pointer border-2 border-dashed border-border hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs text-center px-2">
                      {t("knowledgePageImageUploadHint")}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      className="hidden"
                      onChange={onUpload}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex flex-col min-h-[min(50vh,420px)] md:min-h-0 md:h-full landscape:min-h-0 landscape:h-full">
              <label className="text-foreground/70 text-xs font-semibold block mb-1.5 flex-shrink-0">
                {t("raCsvExportContentLabel")}
              </label>
              <textarea
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                className="flex-1 min-h-[min(50vh,420px)] md:min-h-0 w-full rounded-xl px-3 py-3 text-sm sm:text-base leading-relaxed text-foreground bg-muted border border-input placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                placeholder={t("knowledgePageContentPlaceholder")}
              />
            </div>
          </div>
        </div>
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 flex justify-end gap-2 border-t border-border bg-muted/30 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !form.title.trim() || !form.content.trim()}
            className="px-4 py-2 rounded-xl bg-violet-600 dark:bg-violet-500/20 text-white dark:text-violet-300 dark:border dark:border-violet-400/30 text-xs font-semibold hover:bg-violet-700 dark:hover:bg-violet-500/35 transition-colors disabled:opacity-40 flex items-center gap-2 shadow-sm"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("knowledgePageShareBtn")}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
