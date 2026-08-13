"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { KnowledgeCoverImage } from "./KnowledgeCoverImage";

type CatStyle = { bg: string; text: string; ring: string };

export type KnowledgeBookNews = {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
  authorId: string;
  authorName?: string;
  views: number;
  createdAt: string;
};

type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type Props = {
  news: KnowledgeBookNews;
  hasImage: boolean;
  imageUrls: string[];
  cat: CatStyle;
  authorLabel: string;
  authorGradient: string;
  authorInitials: string;
  formattedDate: string;
  readTime: number;
  minReadLabel: string;
  justNowLabel: string;
  backLabel: string;
  closeLabel: string;
  commentsLabel: string;
  commentPlaceholder: string;
  commentEmpty: string;
  sanitizedHtml: string;
  reactions: { counts: Record<string, number>; myReaction: string | null } | null;
  comments: Comment[];
  commentText: string;
  commentPosting: boolean;
  commentInputRef: RefObject<HTMLInputElement | null>;
  canDelete: boolean;
  currentUserId?: string;
  getAvatarColor: (name: string) => string;
  getInitials: (name: string) => string;
  formatRelative: (d: string, justNow: string) => string;
  onClose: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onCommentChange: (v: string) => void;
  onAddComment: () => void;
  onDeleteComment: (id: string) => void;
};

function splitHtmlPages(html: string, targetChars = 900): string[] {
  const parts = html
    .split(/(?<=<\/(?:p|h[1-6]|li|blockquote|ul|ol|pre|table|div)>)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [html || "<p></p>"];

  const pages: string[] = [];
  let buf = "";
  for (const part of parts) {
    if (buf && buf.length + part.length > targetChars) {
      pages.push(buf);
      buf = part;
    } else {
      buf += part;
    }
  }
  if (buf) pages.push(buf);
  return pages.length ? pages : [html];
}

const proseClass = `prose prose-stone dark:prose-invert prose-sm sm:prose-base max-w-none leading-[1.8]
  text-stone-800 dark:text-stone-200
  prose-headings:font-bold prose-headings:tracking-tight
  prose-a:text-violet-700 dark:prose-a:text-violet-300 prose-a:no-underline
  prose-img:rounded-lg prose-img:mx-auto
  prose-pre:bg-stone-900 prose-pre:text-stone-100`;

export function KnowledgeBookReader({
  news,
  hasImage,
  imageUrls,
  cat,
  authorLabel,
  authorGradient,
  authorInitials,
  formattedDate,
  readTime,
  minReadLabel,
  justNowLabel,
  backLabel,
  closeLabel,
  commentsLabel,
  commentPlaceholder,
  commentEmpty,
  sanitizedHtml,
  reactions,
  comments,
  commentText,
  commentPosting,
  commentInputRef,
  canDelete,
  currentUserId,
  getAvatarColor,
  getInitials,
  formatRelative,
  onClose,
  onDelete,
  onReact,
  onCommentChange,
  onAddComment,
  onDeleteComment,
}: Props) {
  const gallery = imageUrls.length
    ? imageUrls
    : news.imageUrl
      ? [news.imageUrl]
      : [];
  const [coverIndex, setCoverIndex] = useState(0);

  useEffect(() => {
    setCoverIndex(0);
  }, [news.id]);
  const contentPages = useMemo(
    () => splitHtmlPages(sanitizedHtml),
    [sanitizedHtml],
  );

  // spreadIndex: 0 = cover|page1, then pairs of content, last may include comments
  const spreads = useMemo(() => {
    const list: Array<
      | { type: "cover"; rightHtml: string }
      | { type: "content"; leftHtml: string; rightHtml: string }
      | { type: "end"; leftHtml?: string }
    > = [];

    if (contentPages.length === 0) {
      list.push({ type: "cover", rightHtml: "" });
    } else {
      list.push({ type: "cover", rightHtml: contentPages[0] ?? "" });
      for (let i = 1; i < contentPages.length; i += 2) {
        list.push({
          type: "content",
          leftHtml: contentPages[i] ?? "",
          rightHtml: contentPages[i + 1] ?? "",
        });
      }
    }
    list.push({ type: "end" });
    return list;
  }, [contentPages]);

  const [spreadIndex, setSpreadIndex] = useState(0);
  const [flipDir, setFlipDir] = useState<1 | -1>(1);

  useEffect(() => {
    setSpreadIndex(0);
  }, [news.id]);

  const go = (dir: 1 | -1) => {
    setFlipDir(dir);
    setSpreadIndex((i) => Math.min(spreads.length - 1, Math.max(0, i + dir)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spreads.length]);

  const spread = spreads[spreadIndex] ?? spreads[0];
  const canPrev = spreadIndex > 0;
  const canNext = spreadIndex < spreads.length - 1;

  return (
    <motion.div
      key="detail"
      role="dialog"
      aria-modal="true"
      aria-label={news.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex flex-col bg-[#ebe6dc] dark:bg-[#0e1014]"
    >
      {/* Top chrome */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 h-12 sm:h-14 z-20">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-medium tracking-wide uppercase">
            {backLabel}
          </span>
        </button>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-stone-500 hidden sm:block" />
          <p className="truncate text-sm font-semibold text-stone-700 dark:text-stone-200 max-w-xl">
            {news.title}
          </p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label={closeLabel}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Open book stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-3 sm:px-8 pb-6 pt-1">
        <div className="relative w-full max-w-6xl h-full max-h-[min(860px,calc(100vh-5.5rem))]">
          {/* Book cover shell */}
          <div
            className="absolute inset-0 rounded-[18px] bg-[#2a241c] dark:bg-[#1a1510] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]"
            style={{
              transform: "perspective(1400px) rotateX(2deg)",
              transformOrigin: "center bottom",
            }}
          />
          {/* Page stack edges */}
          <div className="absolute left-[10px] right-[10px] bottom-[6px] h-[10px] rounded-b-[10px] bg-gradient-to-b from-[#d8d0c4] to-[#c4b9a8] dark:from-[#3a342c] dark:to-[#2a241c]" />
          <div className="absolute left-[14px] right-[14px] bottom-[12px] h-[6px] bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#b9ae9c_2px,#b9ae9c_3px)] dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#4a4034_2px,#4a4034_3px)] opacity-70" />

          {/* Inner pages */}
          <div className="absolute inset-[10px] sm:inset-[14px] bottom-[18px] flex overflow-hidden rounded-[10px] bg-[#faf7f0] dark:bg-[#1c1e24] shadow-inner">
            {/* Spine gutter */}
            <div
              className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 z-10 hidden md:block"
              style={{
                background:
                  "linear-gradient(90deg, rgba(0,0,0,0.10), rgba(0,0,0,0.02) 40%, rgba(0,0,0,0.02) 60%, rgba(0,0,0,0.10))",
              }}
            />
            <div className="pointer-events-none absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-stone-300/70 dark:bg-white/10 z-10 hidden md:block" />

            <AnimatePresence mode="wait" custom={flipDir}>
              <motion.div
                key={spreadIndex}
                custom={flipDir}
                initial={{ opacity: 0, x: flipDir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: flipDir * -28 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex w-full h-full flex-col md:flex-row"
              >
                {/* LEFT PAGE */}
                <div className="relative flex-1 min-w-0 min-h-0 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 border-b md:border-b-0 md:border-r border-stone-200/80 dark:border-white/5">
                  {spread?.type === "cover" ? (
                    <div className="h-full flex flex-col gap-4">
                      <div className="relative overflow-hidden rounded-lg aspect-[4/3] sm:aspect-[5/4] bg-gradient-to-br from-stone-200 to-stone-100 dark:from-stone-800 dark:to-stone-900 ring-1 ring-stone-300/40 dark:ring-white/10">
                        {(hasImage || gallery.length > 0) &&
                        gallery[coverIndex] ? (
                          <>
                            <KnowledgeCoverImage
                              path={gallery[coverIndex]}
                              alt={news.title}
                              fill
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                            {gallery.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCoverIndex(
                                      (i) =>
                                        (i - 1 + gallery.length) %
                                        gallery.length,
                                    )
                                  }
                                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCoverIndex(
                                      (i) => (i + 1) % gallery.length,
                                    )
                                  }
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                                  {gallery.map((_, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => setCoverIndex(i)}
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        i === coverIndex
                                          ? "bg-white"
                                          : "bg-white/40"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        ) : null}
                      </div>
                      <span
                        className={`self-start text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full ring-1 ${cat.bg} ${cat.text} ${cat.ring}`}
                      >
                        {news.category}
                      </span>
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-black leading-tight text-stone-900 dark:text-stone-50">
                        {news.title}
                      </h1>
                      <div className="flex items-center gap-2.5 pt-1">
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${authorGradient} flex items-center justify-center text-white text-xs font-bold`}
                        >
                          {authorInitials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
                            {authorLabel}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {formattedDate}
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-3 text-[11px] text-stone-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {news.views}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {readTime} {minReadLabel}
                          </span>
                        </div>
                      </div>
                      {/* Mobile: show first content page under cover */}
                      {spread.rightHtml ? (
                        <div
                          className={`md:hidden mt-2 pt-4 border-t border-stone-200 dark:border-white/10 ${proseClass}`}
                          dangerouslySetInnerHTML={{ __html: spread.rightHtml }}
                        />
                      ) : null}
                    </div>
                  ) : spread?.type === "content" ? (
                    <div className="space-y-4">
                      <div
                        className={proseClass}
                        dangerouslySetInnerHTML={{ __html: spread.leftHtml }}
                      />
                      {spread.rightHtml ? (
                        <div
                          className={`md:hidden pt-4 border-t border-stone-200 dark:border-white/10 ${proseClass}`}
                          dangerouslySetInnerHTML={{ __html: spread.rightHtml }}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <MessageCircle className="w-4 h-4 text-stone-500" />
                        <span className="text-stone-700 dark:text-stone-200 text-sm font-semibold">
                          {comments.length > 0
                            ? `${comments.length} ${commentsLabel}`
                            : commentsLabel}
                        </span>
                      </div>
                      <div className="flex gap-2 mb-4">
                        <input
                          ref={commentInputRef}
                          value={commentText}
                          onChange={(e) => onCommentChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              onAddComment();
                            }
                          }}
                          placeholder={commentPlaceholder}
                          maxLength={1000}
                          className="flex-1 rounded-xl px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-white/80 dark:bg-white/5 border border-stone-300/80 dark:border-white/10 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                        <button
                          type="button"
                          onClick={onAddComment}
                          disabled={commentPosting || !commentText.trim()}
                          className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors disabled:opacity-40"
                        >
                          {commentPosting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                        {comments.length === 0 ? (
                          <p className="text-stone-500 text-sm text-center py-6">
                            {commentEmpty}
                          </p>
                        ) : (
                          comments.map((c) => {
                            const grad = getAvatarColor(c.authorName);
                            return (
                              <div key={c.id} className="flex gap-2.5 group">
                                <div
                                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
                                >
                                  {getInitials(c.authorName)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-100">
                                      {c.authorName}
                                    </span>
                                    <span className="text-[10px] text-stone-400">
                                      {formatRelative(c.createdAt, justNowLabel)}
                                    </span>
                                    {currentUserId === c.authorId && (
                                      <button
                                        type="button"
                                        onClick={() => onDeleteComment(c.id)}
                                        className="opacity-0 group-hover:opacity-100 ml-auto text-stone-400 hover:text-red-500"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                                    {c.content}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT PAGE */}
                <div className="relative flex-1 min-w-0 min-h-0 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 hidden md:block">
                  {spread?.type === "cover" || spread?.type === "content" ? (
                    <div
                      className={proseClass}
                      dangerouslySetInnerHTML={{
                        __html:
                          spread.type === "cover"
                            ? spread.rightHtml
                            : spread.rightHtml,
                      }}
                    />
                  ) : (
                    <div className="h-full flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400 mb-4">
                          Reactions
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {["👍", "❤️", "😮", "💡", "🔥"].map((emoji) => {
                            const count = reactions?.counts[emoji] ?? 0;
                            const active = reactions?.myReaction === emoji;
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onReact(emoji)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border font-medium ${
                                  active
                                    ? "bg-violet-100 dark:bg-violet-500/25 border-violet-400 text-violet-700 dark:text-violet-300"
                                    : "bg-white/70 dark:bg-white/5 border-stone-300/70 dark:border-white/10 text-stone-600 dark:text-stone-300"
                                }`}
                              >
                                <span>{emoji}</span>
                                {count > 0 && (
                                  <span className="text-xs font-semibold">
                                    {count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-center text-stone-400 text-xs tracking-widest uppercase pb-2">
                        — {spreadIndex + 1} / {spreads.length} —
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Page turn controls */}
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => go(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 sm:-translate-x-3 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-stone-200 disabled:opacity-30 disabled:pointer-events-none hover:scale-105 transition-transform"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => go(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 sm:translate-x-3 z-20 w-10 h-10 rounded-full bg-white/90 dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-stone-200 disabled:opacity-30 disabled:pointer-events-none hover:scale-105 transition-transform"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile reactions + page indicator (right page hidden on small screens) */}
      <div className="md:hidden flex-shrink-0 px-4 pb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {["👍", "❤️", "😮", "💡", "🔥"].map((emoji) => {
            const active = reactions?.myReaction === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className={`px-2.5 py-1 rounded-full text-sm border ${
                  active
                    ? "bg-violet-100 border-violet-400"
                    : "bg-white/70 border-stone-300"
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-stone-500 tabular-nums shrink-0">
          {spreadIndex + 1}/{spreads.length}
        </span>
      </div>
    </motion.div>
  );
}
