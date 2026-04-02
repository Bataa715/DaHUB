"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { englishApi } from "@/lib/api";
import type { EnglishWord } from "@/lib/types";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  BookOpen,
  Layers,
  Target,
  PenLine,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  Eye,
  TrendingUp,
  Star,
  Brain,
  Search,
  Volume2,
  Save,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const PARTS = [
  "Нэр үг",
  "Үйл үг",
  "Тэмдэг нэр",
  "Дайвар үг",
  "Угтвар",
  "Холбоос",
  "Хэллэг",
  "Бусад",
];

const DIFF_LABEL = ["", "Амархан", "Дунд", "Хэцүү", "Маш хэцүү", "Тэмцэгч"];
const DIFF_COLOR = [
  "",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
];

// shuffle helper
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// mastery % helper
const mastery = (w: EnglishWord) =>
  w.totalReviews === 0
    ? 0
    : Math.round((w.correctReviews / w.totalReviews) * 100);

// ── Word Form Dialog ──────────────────────────────────────────────────────────

type WordFormData = {
  word: string;
  translation: string;
  definition: string;
  example: string;
  partOfSpeech: string;
  difficulty: number;
};

const EMPTY_FORM: WordFormData = {
  word: "",
  translation: "",
  definition: "",
  example: "",
  partOfSpeech: "",
  difficulty: 1,
};

function WordFormDialog({
  open,
  onClose,
  initial,
  onSave,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  initial?: EnglishWord | null;
  onSave: (data: WordFormData) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState<WordFormData>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              word: initial.word,
              translation: initial.translation,
              definition: initial.definition,
              example: initial.example,
              partOfSpeech: initial.partOfSpeech,
              difficulty: initial.difficulty,
            }
          : EMPTY_FORM,
      );
    }
  }, [open, initial]);

  const set = (k: keyof WordFormData, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {initial ? "Үг засах" : "Шинэ үг нэмэх"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Англи үг *</Label>
              <Input
                placeholder="e.g. integrity"
                value={form.word}
                onChange={(e) => set("word", e.target.value)}
                className="font-medium"
              />
            </div>
            <div className="space-y-1">
              <Label>Монгол орчуулга *</Label>
              <Input
                placeholder="e.g. бүрэн бүтэн байдал"
                value={form.translation}
                onChange={(e) => set("translation", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Тайлбар / Утга</Label>
            <Textarea
              placeholder="Товч тодорхойлолт..."
              rows={2}
              value={form.definition}
              onChange={(e) => set("definition", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Жишээ өгүүлбэр</Label>
            <Input
              placeholder="e.g. The auditor maintained her integrity."
              value={form.example}
              onChange={(e) => set("example", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Яриа хэлцийн анги</Label>
              <Select
                value={form.partOfSpeech}
                onValueChange={(v) => set("partOfSpeech", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Сонгох..." />
                </SelectTrigger>
                <SelectContent>
                  {PARTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Хэцүү байдал</Label>
              <Select
                value={String(form.difficulty)}
                onValueChange={(v) => set("difficulty", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFF_LABEL.slice(1).map((l, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {i + 1} — {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Цуцлах
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={loading || !form.word.trim() || !form.translation.trim()}
          >
            {loading ? "Хадгалж байна..." : "Хадгалах"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Flashcard Mode ────────────────────────────────────────────────────────────

function FlashcardMode({
  words,
  onSaveResults,
}: {
  words: EnglishWord[];
  onSaveResults: (results: Array<{ id: string; correct: boolean }>) => Promise<void>;
}) {
  const [deck, setDeck] = useState(() => shuffle(words));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [done, setDone] = useState<{ correct: number; wrong: number }>({
    correct: 0,
    wrong: 0,
  });
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const card = deck[idx];
  const total = deck.length;

  const goTo = useCallback(
    (newIdx: number) => {
      if (animating) return;
      if (newIdx < 0 || newIdx >= total) return;
      setAnimating(true);
      setFlipped(false);
      setTimeout(() => {
        setIdx(newIdx);
        setAnimating(false);
      }, 180);
    },
    [animating, total],
  );

  const handleSkip = useCallback(() => {
    if (idx + 1 >= total) {
      setFinished(true);
      return;
    }
    goTo(idx + 1);
  }, [idx, total, goTo]);

  const handleMark = useCallback(
    (correct: boolean) => {
      setResults((r) => [...r, { id: card.id, correct }]);
      setDone((d) => ({
        ...d,
        [correct ? "correct" : "wrong"]: d[correct ? "correct" : "wrong"] + 1,
      }));
      if (idx + 1 >= total) {
        setFinished(true);
        return;
      }
      goTo(idx + 1);
    },
    [card, idx, total, goTo],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (finished) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (idx > 0) goTo(idx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSkip();
      } else if (e.key === "Enter" && flipped) {
        e.preventDefault();
        handleMark(true);
      } else if (e.key === "Backspace" && flipped) {
        e.preventDefault();
        handleMark(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [finished, idx, flipped, goTo, handleSkip, handleMark]);

  const restart = () => {
    setDeck(shuffle(words));
    setIdx(0);
    setFlipped(false);
    setDone({ correct: 0, wrong: 0 });
    setFinished(false);
    setResults([]);
    setSaving(false);
    setSaved(false);
  };

  if (finished) {
    const pct = Math.round((done.correct / total) * 100);
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <div className="text-6xl">
          {pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"}
        </div>
        <h3 className="text-2xl font-bold">Дуусгалаа!</h3>
        <div className="flex gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-emerald-500">
              {done.correct}
            </div>
            <div className="text-sm text-muted-foreground">Зөв</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-rose-500">{done.wrong}</div>
            <div className="text-sm text-muted-foreground">Буруу</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-sky-500">{pct}%</div>
            <div className="text-sm text-muted-foreground">Оноо</div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={async () => {
              setSaving(true);
              await onSaveResults(results);
              setSaving(false);
              setSaved(true);
            }}
            disabled={saving || saved || results.length === 0}
            variant={saved ? "outline" : "default"}
            className="gap-2"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Хадгалагдлаа</>
            ) : saving ? (
              "Хадгалж байна..."
            ) : (
              <><Save className="w-4 h-4" /> Үр дүн хадгалах</>
            )}
          </Button>
          <Button onClick={restart} variant="outline" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Дахин тоглох
          </Button>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Progress */}
      <div className="w-full max-w-lg space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {idx + 1} / {total}
          </span>
          <span className="flex gap-3">
            <span className="text-emerald-500 font-medium">
              ✓ {done.correct}
            </span>
            <span className="text-rose-500 font-medium">✗ {done.wrong}</span>
          </span>
        </div>
        <Progress value={(idx / total) * 100} className="h-1.5" />
      </div>

      {/* Flip card */}
      <div
        className="w-full max-w-lg cursor-pointer select-none"
        style={{ perspective: "1200px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.45s cubic-bezier(.4,0,.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
            height: "280px",
          }}
        >
          {/* FRONT — English */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 flex flex-col justify-between shadow-2xl text-white"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-0 text-xs font-semibold">
                  EN
                </Badge>
                {card.partOfSpeech && (
                  <Badge className="bg-white/15 text-white/80 border-0 text-xs">
                    {card.partOfSpeech}
                  </Badge>
                )}
              </div>
              <Badge
                className={`${DIFF_COLOR[card.difficulty]} border-0 text-xs`}
              >
                {DIFF_LABEL[card.difficulty]}
              </Badge>
            </div>
            <div className="text-center space-y-2">
              <div className="text-5xl font-bold tracking-tight leading-tight">
                {card.word}
              </div>
              {card.example && (
                <div className="text-sm text-white/65 italic line-clamp-2 mt-3">
                  "{card.example}"
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-white/55 text-sm">
              <Eye className="w-4 h-4" />
              <span>Дарж монгол орчуулга харах</span>
            </div>
          </div>

          {/* BACK — Mongolian */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-8 flex flex-col justify-between shadow-2xl text-white"
          >
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-0 text-xs font-semibold">
                MN
              </Badge>
              <span className="text-sm text-white/65 font-medium">
                {card.word}
              </span>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold leading-snug">
                {card.translation}
              </div>
              {card.definition && (
                <div className="text-sm text-white/80 mt-1">
                  {card.definition}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-1 text-white/50 text-xs">
              {card.totalReviews > 0
                ? `${mastery(card)}% хянасан (${card.totalReviews} удаа)`
                : "Хяналгүй"}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation + Action row */}
      <div className="flex items-center gap-2 w-full max-w-lg">
        {/* ← Өмнөх */}
        <Button
          size="icon"
          variant="outline"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0 || animating}
          title="Өмнөх (←)"
          className="shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Center actions */}
        <div className="flex gap-2 flex-1">
          {flipped ? (
            <>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 gap-2 border-rose-300 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                onClick={() => handleMark(false)}
              >
                <X className="w-5 h-5" />
                Мэдэхгүй
              </Button>
              <Button
                size="lg"
                className="flex-1 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => handleMark(true)}
              >
                <Check className="w-5 h-5" />
                Мэдсэн
              </Button>
            </>
          ) : (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setFlipped(true)}
                className="flex-1 gap-2"
              >
                <Eye className="w-5 h-5" />
                Харах
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={handleSkip}
                disabled={animating}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                title="Алгасах (→)"
              >
                Алгасах
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* → Дараагийнх */}
        <Button
          size="icon"
          variant="outline"
          onClick={() => goTo(idx + 1)}
          disabled={idx + 1 >= total || animating}
          title="Дараагийнх (→)"
          className="shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground text-center leading-relaxed">
        <span>Space — эргүүлэх</span>
        <span className="mx-2 opacity-40">·</span>
        <span>← → — шилжих / алгасах</span>
        <span className="mx-2 opacity-40">·</span>
        <span>Эргүүлсний дараа Enter = Зөв, Backspace = Буруу</span>
      </div>
    </div>
  );
}

// ── Multiple Choice Mode ───────────────────────────────────────────────────────

function MultipleChoiceMode({
  words,
  onSaveResults,
}: {
  words: EnglishWord[];
  onSaveResults: (results: Array<{ id: string; correct: boolean }>) => Promise<void>;
}) {
  // deck & options must be in state so they don't reshuffle on each render
  const [deck] = useState(() => shuffle(words));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const card = deck[idx];
  const total = deck.length;

  // Build stable 4-option list per card — only changes when idx changes
  const options = useMemo(() => {
    if (!card) return [];
    const others = shuffle(deck.filter((_, i) => i !== idx)).slice(0, 3);
    return shuffle([card, ...others]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, deck]);

  const handle = useCallback(
    (i: number) => {
      if (selected !== null || !options[i]) return;
      setSelected(i);
      const correct = options[i].id === card.id;
      setResults((r) => [...r, { id: card.id, correct }]);
      setScore((s) => ({
        ...s,
        [correct ? "correct" : "wrong"]: s[correct ? "correct" : "wrong"] + 1,
      }));
      setTimeout(() => {
        if (idx + 1 >= total) {
          setFinished(true);
          return;
        }
        setSelected(null);
        setIdx((prev) => prev + 1);
      }, 900);
    },
    [selected, options, card, idx, total],
  );

  // Keyboard: 1-4 to pick option
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (finished || selected !== null) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) handle(n - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [finished, selected, handle]);

  const restart = () => {
    setIdx(0);
    setSelected(null);
    setScore({ correct: 0, wrong: 0 });
    setFinished(false);
    setResults([]);
    setSaving(false);
    setSaved(false);
  };

  if (finished) {
    const pct = Math.round((score.correct / total) * 100);
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <div className="text-6xl">
          {pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "💪"}
        </div>
        <h3 className="text-2xl font-bold">Дуусгалаа!</h3>
        <div className="flex gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-emerald-500">
              {score.correct}
            </div>
            <div className="text-sm text-muted-foreground">Зөв</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-rose-500">
              {score.wrong}
            </div>
            <div className="text-sm text-muted-foreground">Буруу</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-sky-500">{pct}%</div>
            <div className="text-sm text-muted-foreground">Оноо</div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={async () => {
              setSaving(true);
              await onSaveResults(results);
              setSaving(false);
              setSaved(true);
            }}
            disabled={saving || saved || results.length === 0}
            variant={saved ? "outline" : "default"}
            className="gap-2"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Хадгалагдлаа</>
            ) : saving ? (
              "Хадгалж байна..."
            ) : (
              <><Save className="w-4 h-4" /> Үр дүн хадгалах</>
            )}
          </Button>
          <Button onClick={restart} variant="outline" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Дахин тоглох
          </Button>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      {/* Progress */}
      <div className="w-full space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {idx + 1} / {total}
          </span>
          <span className="flex gap-3">
            <span className="text-emerald-500 font-medium">
              ✓ {score.correct}
            </span>
            <span className="text-rose-500 font-medium">✗ {score.wrong}</span>
          </span>
        </div>
        <Progress value={(idx / total) * 100} className="h-1.5" />
      </div>

      {/* Question card */}
      <Card className="w-full border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
        <CardContent className="pt-8 pb-6 text-center space-y-2">
          {card.partOfSpeech && (
            <Badge variant="outline" className="text-xs">
              {card.partOfSpeech}
            </Badge>
          )}
          <div className="text-4xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
            {card.word}
          </div>
          {card.example && (
            <div className="text-sm text-muted-foreground italic">
              "{card.example}"
            </div>
          )}
          <div className="text-sm font-medium text-muted-foreground pt-1">
            Монгол орчуулгыг сонгоно уу
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3 w-full">
        {options.map((opt, i) => {
          const isCorrect = opt.id === card.id;
          const isSelected = selected === i;
          const revealed = selected !== null;
          let cls =
            "w-full text-left px-5 py-4 rounded-xl border-2 font-medium transition-all ";
          if (!revealed) {
            cls +=
              "border-border hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer";
          } else if (isCorrect) {
            cls +=
              "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
          } else if (isSelected) {
            cls +=
              "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300";
          } else {
            cls += "border-border opacity-50";
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => handle(i)}
              disabled={revealed}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span>{opt.translation}</span>
                {revealed && isCorrect && (
                  <Check className="w-5 h-5 ml-auto text-emerald-500" />
                )}
                {revealed && isSelected && !isCorrect && (
                  <X className="w-5 h-5 ml-auto text-rose-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Гарын тоогоор 1–4 дарж сонгох боломжтой
      </div>
    </div>
  );
}

function TypeAnswerMode({
  words,
  onSaveResults,
}: {
  words: EnglishWord[];
  onSaveResults: (results: Array<{ id: string; correct: boolean }>) => Promise<void>;
}) {
  const [deck] = useState(() => shuffle(words));
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [finished, setFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<Array<{ id: string; correct: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const card = deck[idx];
  const total = deck.length;

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  const check = () => {
    if (!input.trim() || result) return;
    const ans = normalize(input);
    const correct = normalize(card.translation);
    // Accept if input is substring of answer or answer starts with input (for long translations)
    const isCorrect =
      ans === correct ||
      correct.startsWith(ans) ||
      correct.includes(ans) ||
      ans.includes(correct.split(" ")[0]);
    setResult(isCorrect ? "correct" : "wrong");
    setResults((r) => [...r, { id: card.id, correct: isCorrect }]);
    setScore((s) => ({
      ...s,
      [isCorrect ? "correct" : "wrong"]: s[isCorrect ? "correct" : "wrong"] + 1,
    }));
  };

  const next = () => {
    if (idx + 1 >= total) {
      setFinished(true);
      return;
    }
    setInput("");
    setResult(null);
    setShowHint(false);
    setIdx((i) => i + 1);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const restart = () => {
    setIdx(0);
    setInput("");
    setResult(null);
    setScore({ correct: 0, wrong: 0 });
    setFinished(false);
    setShowHint(false);
    setResults([]);
    setSaving(false);
    setSaved(false);
  };

  if (finished) {
    const pct = Math.round((score.correct / total) * 100);
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <div className="text-6xl">
          {pct >= 80 ? "🎓" : pct >= 50 ? "👍" : "💪"}
        </div>
        <h3 className="text-2xl font-bold">Дуусгалаа!</h3>
        <div className="flex gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-emerald-500">
              {score.correct}
            </div>
            <div className="text-sm text-muted-foreground">Зөв</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-rose-500">
              {score.wrong}
            </div>
            <div className="text-sm text-muted-foreground">Буруу</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-sky-500">{pct}%</div>
            <div className="text-sm text-muted-foreground">Оноо</div>
          </div>
        </div>
        <Button onClick={restart} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Дахин тоглох
        </Button>
      </div>
    );
  }

  if (!card) return null;

  const hintText =
    card.translation.slice(0, Math.ceil(card.translation.length / 3)) + "...";

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="w-full space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {idx + 1} / {total}
          </span>
          <span className="flex gap-3">
            <span className="text-emerald-500 font-medium">
              ✓ {score.correct}
            </span>
            <span className="text-rose-500 font-medium">✗ {score.wrong}</span>
          </span>
        </div>
        <Progress value={(idx / total) * 100} className="h-1.5" />
      </div>

      {/* Word card */}
      <Card className="w-full border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/40">
        <CardContent className="pt-8 pb-6 text-center space-y-2">
          {card.partOfSpeech && (
            <Badge variant="outline" className="text-xs">
              {card.partOfSpeech}
            </Badge>
          )}
          <div className="text-4xl font-bold text-violet-700 dark:text-violet-300 tracking-tight">
            {card.word}
          </div>
          {card.definition && (
            <div className="text-sm text-muted-foreground">
              {card.definition}
            </div>
          )}
          {card.example && (
            <div className="text-sm text-muted-foreground italic">
              "{card.example}"
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input */}
      <div className="w-full space-y-3">
        <div className="relative">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") result ? next() : check();
            }}
            placeholder="Монгол орчуулга бичнэ үү..."
            disabled={!!result}
            className={`text-base pr-10 ${
              result === "correct"
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                : result === "wrong"
                  ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
                  : ""
            }`}
          />
          {result === "correct" && (
            <Check className="absolute right-3 top-3 w-5 h-5 text-emerald-500" />
          )}
          {result === "wrong" && (
            <X className="absolute right-3 top-3 w-5 h-5 text-rose-500" />
          )}
        </div>

        {result === "wrong" && (
          <div className="text-sm text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/30 rounded-lg px-4 py-2">
            Зөв хариулт: <span className="font-bold">{card.translation}</span>
          </div>
        )}
        {result === "correct" && (
          <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-4 py-2">
            ✓ Зөв байна!
          </div>
        )}

        {!result && showHint && (
          <div className="text-sm text-muted-foreground bg-muted rounded-lg px-4 py-2">
            Санаануулга: <span className="font-medium">{hintText}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 w-full">
        {!result && !showHint && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHint(true)}
            className="gap-1"
          >
            <Eye className="w-4 h-4" />
            Санааны тусламж
          </Button>
        )}
        {!result ? (
          <Button
            onClick={check}
            className="flex-1 gap-2"
            disabled={!input.trim()}
          >
            <Check className="w-4 h-4" />
            Шалгах
          </Button>
        ) : (
          <Button onClick={next} className="flex-1 gap-2">
            Дараагийнх <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        Enter дарж шалгах / дараагийнх руу шилжих
      </div>
    </div>
  );
}

// ── Word Table ────────────────────────────────────────────────────────────────

function WordTable({
  words,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: {
  words: EnglishWord[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (w: EnglishWord) => void;
  onDelete: (w: EnglishWord) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "word" | "mastery">(
    "createdAt",
  );

  const filtered = words
    .filter(
      (w) =>
        !search ||
        w.word.toLowerCase().includes(search.toLowerCase()) ||
        w.translation.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "word") return a.word.localeCompare(b.word);
      if (sortBy === "mastery") return mastery(b) - mastery(a);
      return 0; // createdAt: already sorted by backend
    });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Хайх..."
            className="pl-9"
          />
        </div>
        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as typeof sortBy)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Нэмсэн огноогоор</SelectItem>
            <SelectItem value="word">Үсгийн дарааллаар</SelectItem>
            <SelectItem value="mastery">Цээжилснээр</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onAdd} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Үг нэмэх
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold w-36">
                  Англи үг
                </th>
                <th className="text-left px-4 py-3 font-semibold w-36">
                  Орчуулга
                </th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                  Тайлбар
                </th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell w-28">
                  Яриа хэлц
                </th>
                <th className="text-left px-4 py-3 font-semibold w-28">
                  Төрөл
                </th>
                <th className="text-left px-4 py-3 font-semibold w-24 hidden sm:table-cell">
                  Цээжилсэн
                </th>
                <th className="text-right px-4 py-3 font-semibold w-20">
                  Үйлдэл
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {search
                      ? "Хайлтад тохирох үг олдсонгүй"
                      : "Үг байхгүй байна. Шинэ үг нэмнэ үү."}
                  </td>
                </tr>
              ) : (
                filtered.map((w) => {
                  const pct = mastery(w);
                  return (
                    <tr
                      key={w.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-indigo-700 dark:text-indigo-300">
                        {w.word}
                      </td>
                      <td className="px-4 py-3 font-medium">{w.translation}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                        {w.definition || "—"}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {w.partOfSpeech ? (
                          <Badge variant="outline" className="text-xs">
                            {w.partOfSpeech}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`${DIFF_COLOR[w.difficulty]} border-0 text-xs`}
                        >
                          {DIFF_LABEL[w.difficulty]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {w.totalReviews === 0 ? (
                          <span className="text-muted-foreground text-xs">
                            Шалгаагүй
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span
                                className={
                                  pct >= 80
                                    ? "text-emerald-500 font-medium"
                                    : pct >= 50
                                      ? "text-amber-500"
                                      : "text-rose-500"
                                }
                              >
                                {pct}%
                              </span>
                              <span className="text-muted-foreground">
                                {w.totalReviews}х
                              </span>
                            </div>
                            <Progress value={pct} className="h-1" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 hover:text-indigo-600"
                            onClick={() => onEdit(w)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 hover:text-rose-600"
                            onClick={() => onDelete(w)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="text-xs text-muted-foreground text-right">
          {filtered.length} үг харуулж байна
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EnglishVocabularyPage() {
  const { toast } = useToast();
  const [words, setWords] = useState<EnglishWord[]>([]);
  const [stats, setStats] = useState({ total: 0, reviewed: 0, mastered: 0 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EnglishWord | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EnglishWord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [tab, setTab] = useState("table");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, st] = await Promise.all([
        englishApi.getWords(),
        englishApi.getStats(),
      ]);
      setWords(ws);
      setStats(st);
    } catch {
      toast({
        title: "Алдаа",
        description: "Үгсийг ачаалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (data: WordFormData) => {
    setFormSaving(true);
    try {
      if (editTarget) {
        await englishApi.updateWord(editTarget.id, data);
        toast({
          title: "Хадгалагдлаа",
          description: `"${data.word}" үг шинэчлэгдлээ`,
        });
      } else {
        await englishApi.createWord(data);
        toast({
          title: "Нэмэгдлээ",
          description: `"${data.word}" үг нэмэгдлээ`,
        });
      }
      setFormOpen(false);
      setEditTarget(null);
      await load();
    } catch {
      toast({
        title: "Алдаа",
        description: "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      await englishApi.deleteWord(deleteConfirm.id);
      toast({
        title: "Устгагдлаа",
        description: `"${deleteConfirm.word}" үг устгагдлаа`,
      });
      setDeleteConfirm(null);
      await load();
    } catch {
      toast({
        title: "Алдаа",
        description: "Устгахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveResults = async (
    results: Array<{ id: string; correct: boolean }>,
  ) => {
    try {
      await Promise.all(
        results.map((r) => englishApi.recordReview(r.id, r.correct)),
      );
      toast({
        title: "Хадгалагдлаа",
        description: `${results.filter((r) => r.correct).length} үгийн үр дүн бүртгэгдлээ`,
      });
      await load();
    } catch {
      toast({
        title: "Алдаа",
        description: "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const studyWords = words.filter((w) => w.word && w.translation);
  const studyReady = studyWords.length >= 4;

  return (
    <>
      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="Англи үг цээжлэх"
        subtitle="Флэшкарт, олон сонголт, бичих гэсэн 3 аргаар тогтоох"
      />
      <div className="max-w-5xl mx-auto space-y-6 px-4 pb-10">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon: <Star className="w-5 h-5 text-amber-500" />,
            label: "Нийт үг",
            value: stats.total,
            color: "text-amber-500",
          },
          {
            icon: <Brain className="w-5 h-5 text-sky-500" />,
            label: "Давтсан",
            value: stats.reviewed,
            color: "text-sky-500",
          },
          {
            icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
            label: "Эзэмшсэн",
            value: stats.mastered,
            color: "text-emerald-500",
          },
        ].map((s) => (
          <Card
            key={s.label}
            className="border-0 shadow-md bg-card/80 backdrop-blur"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">{s.icon}</div>
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full md:w-auto md:inline-flex gap-0">
          <TabsTrigger value="table" className="gap-1.5 text-sm">
            <BookOpen className="w-4 h-4 hidden sm:block" />
            Үгийн сан
          </TabsTrigger>
          <TabsTrigger value="flashcard" className="gap-1.5 text-sm">
            <Layers className="w-4 h-4 hidden sm:block" />
            Флэшкарт
          </TabsTrigger>
          <TabsTrigger value="choice" className="gap-1.5 text-sm">
            <Target className="w-4 h-4 hidden sm:block" />
            Сонголт
          </TabsTrigger>
          <TabsTrigger value="type" className="gap-1.5 text-sm">
            <PenLine className="w-4 h-4 hidden sm:block" />
            Бичих
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <WordTable
            words={words}
            loading={loading}
            onAdd={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            onEdit={(w) => {
              setEditTarget(w);
              setFormOpen(true);
            }}
            onDelete={(w) => setDeleteConfirm(w)}
          />
        </TabsContent>

        <TabsContent value="flashcard" className="mt-4">
          {studyReady ? (
            <FlashcardMode
              key={tab + words.length}
              words={studyWords}
              onSaveResults={handleSaveResults}
            />
          ) : (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-4 py-3">
              Флэшкарт эхлүүлэхийн тулд хамгийн багадаа 4 үг нэмнэ үү.
            </div>
          )}
        </TabsContent>

        <TabsContent value="choice" className="mt-4">
          {studyReady ? (
            <MultipleChoiceMode
              key={tab + words.length}
              words={studyWords}
              onSaveResults={handleSaveResults}
            />
          ) : (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-4 py-3">
              Сонголтын дасгал эхлүүлэхийн тулд хамгийн багадаа 4 үг нэмнэ үү.
            </div>
          )}
        </TabsContent>

        <TabsContent value="type" className="mt-4">
          {studyReady ? (
            <TypeAnswerMode
              key={tab + words.length}
              words={studyWords}
              onSaveResults={handleSaveResults}
            />
          ) : (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-4 py-3">
              Бичих дасгал эхлүүлэхийн тулд хамгийн багадаа 4 үг нэмнэ үү.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Word form dialog ── */}
      <WordFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        initial={editTarget}
        onSave={handleSave}
        loading={formSaving}
      />

      {/* ── Delete confirm dialog ── */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(v) => !v && setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Үг устгах уу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              "{deleteConfirm?.word}"
            </span>{" "}
            үгийг устгавал буцаах боломжгүй.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleteLoading}
            >
              Цуцлах
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Устгаж байна..." : "Устгах"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </>
  );
}
