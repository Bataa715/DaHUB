"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Trash2,
  ListTodo,
  Plus,
  Calendar,
  Flag,
  CheckCircle2,
  Target,
  Zap,
  Lock,
  SlidersHorizontal,
  Sparkles,
  Check,
} from "lucide-react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Todo {
  id: string;
  task: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  category?: string;
  createdAt: string;
}

const priorityConfig = {
  high: {
    label: "Чухал",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    bar: "bg-red-500",
  },
  medium: {
    label: "Дунд",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    bar: "bg-amber-500",
  },
  low: {
    label: "Энгийн",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    bar: "bg-primary",
  },
};

const categories = [
  { value: "work", label: "Ажил", emoji: "💼" },
  { value: "personal", label: "Хувийн", emoji: "🏠" },
  { value: "health", label: "Эрүүл мэнд", emoji: "💪" },
  { value: "study", label: "Суралцах", emoji: "📚" },
  { value: "other", label: "Бусад", emoji: "📌" },
];

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
  exit: { opacity: 0, x: -40, scale: 0.95, transition: { duration: 0.18 } },
};

// Circular progress ring
const ProgressRing = ({ pct }: { pct: number }) => {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0">
      <svg width="72" height="72" className="-rotate-90" viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="5"
        />
        <motion.circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold leading-none">{pct}%</span>
        <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
          гүйцэтгэл
        </span>
      </div>
    </div>
  );
};

// Todo Item
const TodoItem = ({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
}) => {
  const priority = priorityConfig[todo.priority] || priorityConfig.low;
  const category = categories.find((c) => c.value === todo.category);
  const isOverdue =
    todo.dueDate && new Date(todo.dueDate) < new Date() && !todo.completed;

  return (
    <motion.div
      layout
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "group relative flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200",
        todo.completed
          ? "bg-muted/20 border-border/20 opacity-60"
          : cn(
              "bg-card/70 backdrop-blur-sm hover:bg-card/90 border-border/40",
              isOverdue && "border-red-500/40 bg-red-500/5",
            ),
      )}
    >
      {/* Priority left bar */}
      <div
        className={cn(
          "absolute left-0 top-3 bottom-3 w-[3px] rounded-full",
          priority.bar,
        )}
      />

      {/* Toggle */}
      <button
        onClick={onToggle}
        className={cn(
          "mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
          todo.completed
            ? "bg-primary border-primary"
            : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10",
        )}
      >
        {todo.completed && (
          <Check className="h-3 w-3 text-primary-foreground" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            todo.completed && "line-through text-muted-foreground",
          )}
        >
          {todo.task}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {category && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {category.emoji} {category.label}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
              priority.bg,
              priority.color,
            )}
          >
            <Flag className="h-3 w-3" />
            {priority.label}
          </span>
          {todo.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                isOverdue && !todo.completed
                  ? "bg-red-500/10 text-red-500"
                  : "bg-muted/60 text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" />
              {new Date(todo.dueDate).toLocaleDateString("mn-MN", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </motion.div>
  );
};

export default function TodoPage() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();

  // Quick-add state
  const [quickTask, setQuickTask] = useState("");
  const [quickPriority, setQuickPriority] = useState<"high" | "medium" | "low">(
    "medium",
  );

  // Dialog form state
  const [newTask, setNewTask] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");

  // Check permission
  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }
      if (user.isAdmin) {
        setHasAccess(true);
        return;
      }
      try {
        const freshUserData = await usersApi.getOne(user.id);
        setHasAccess(freshUserData.allowedTools?.includes("todo") || false);
      } catch {
        setHasAccess(false);
      }
    };
    checkPermission();
  }, [user]);

  const STORAGE_KEY = "todos_data";

  const loadTodosFromStorage = (): Todo[] => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveTodosToStorage = (t: Todo[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    } catch {}
  };

  useEffect(() => {
    setTodos(loadTodosFromStorage());
    setLoading(false);
  }, []);

  const addTodo = (
    task: string,
    p: "high" | "medium" | "low",
    dd?: string,
    cat?: string,
  ) => {
    if (!task.trim()) return;
    const newTodo: Todo = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      task,
      completed: false,
      priority: p,
      dueDate: dd || undefined,
      category: cat || undefined,
      createdAt: new Date().toISOString(),
    };
    const updated = [newTodo, ...todos];
    setTodos(updated);
    saveTodosToStorage(updated);
    toast({ title: "Нэмэгдлээ!" });
  };

  const handleQuickAdd = (e: FormEvent) => {
    e.preventDefault();
    addTodo(quickTask, quickPriority);
    setQuickTask("");
    setQuickPriority("medium");
  };

  const handleDialogAdd = (e: FormEvent) => {
    e.preventDefault();
    addTodo(newTask, priority, dueDate || undefined, category || undefined);
    setNewTask("");
    setPriority("medium");
    setDueDate("");
    setCategory("");
    setDialogOpen(false);
  };

  const toggleTodo = (id: string) => {
    const updated = todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t,
    );
    setTodos(updated);
    saveTodosToStorage(updated);
  };

  const deleteTodo = (id: string) => {
    const updated = todos.filter((t) => t.id !== id);
    setTodos(updated);
    saveTodosToStorage(updated);
  };

  const filteredTodos = todos.filter((t) => {
    const statusOk =
      filter === "all" || (filter === "active" ? !t.completed : t.completed);
    const catOk = categoryFilter === "all" || t.category === categoryFilter;
    return statusOk && catOk;
  });

  const completedCount = todos.filter((t) => t.completed).length;
  const activeCount = todos.filter((t) => !t.completed).length;
  const highCount = todos.filter(
    (t) => t.priority === "high" && !t.completed,
  ).length;
  const completionRate =
    todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  // Permission check — loading
  if (hasAccess === null || loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const headerIcon = (
    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
      <ListTodo className="w-3.5 h-3.5 text-primary-foreground" />
    </div>
  );

  if (!hasAccess) {
    return (
      <div className="min-h-screen">
        <ToolPageHeader
          icon={headerIcon}
          title="Хийх зүйлс"
          subtitle="Өдрийн ажлаа төлөвлөж, бүтээмжээ нэмэгдүүлээрэй"
        />
        <div className="flex flex-col justify-center items-center p-4 pt-16">
          <div className="text-center max-w-md">
            <div className="p-6 rounded-full bg-muted/40 inline-block mb-6">
              <Lock className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Эрх хязгаарлагдсан</h2>
            <p className="text-muted-foreground">
              Та энэ хэрэгслийг ашиглах эрхгүй байна. Админтай холбогдоно уу.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToolPageHeader
        icon={headerIcon}
        title="Хийх зүйлс"
        subtitle="Өдрийн ажлаа төлөвлөж, бүтээмжээ нэмэгдүүлээрэй"
        rightContent={
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs h-8 px-3"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Дэлгэрэнгүй
          </Button>
        }
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-5 bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl px-5 py-4"
        >
          <ProgressRing pct={completionRate} />
          <div className="h-12 w-px bg-border/40 shrink-0" />
          <div className="grid grid-cols-3 gap-4 flex-1">
            {[
              {
                label: "Нийт",
                value: todos.length,
                icon: Target,
                cls: "text-muted-foreground",
              },
              {
                label: "Идэвхтэй",
                value: activeCount,
                icon: Zap,
                cls: "text-amber-500",
              },
              {
                label: "Дууссан",
                value: completedCount,
                icon: CheckCircle2,
                cls: "text-primary",
              },
            ].map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4 shrink-0", cls)} />
                <div>
                  <div className="text-xl font-bold leading-none">{value}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* High priority alert */}
        <AnimatePresence>
          {highCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm"
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span>
                <b>{highCount}</b> чухал ажил хийгдэж дуусаагүй байна
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick add */}
        <motion.form
          onSubmit={handleQuickAdd}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-3"
        >
          <div className="flex items-center gap-2 flex-1 bg-background/60 rounded-xl border border-border/40 px-3">
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              placeholder="Шинэ ажил нэмэх… (Enter)"
              className="flex-1 bg-transparent text-sm py-2.5 outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <Select
            value={quickPriority}
            onValueChange={(v) =>
              setQuickPriority(v as "high" | "medium" | "low")
            }
          >
            <SelectTrigger className="w-28 bg-background/60 border-border/40 rounded-xl text-xs h-10 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">
                <span className="text-red-500 text-xs">● Чухал</span>
              </SelectItem>
              <SelectItem value="medium">
                <span className="text-amber-500 text-xs">● Дунд</span>
              </SelectItem>
              <SelectItem value="low">
                <span className="text-primary text-xs">● Энгийн</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            size="icon"
            disabled={!quickTask.trim()}
            className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </motion.form>

        {/* Filter pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center gap-2"
        >
          {(
            [
              { key: "all", label: `Бүгд (${todos.length})` },
              { key: "active", label: `Идэвхтэй (${activeCount})` },
              { key: "completed", label: `Дууссан (${completedCount})` },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                filter === key
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
          {categories.some((cat) =>
            todos.some((t) => t.category === cat.value),
          ) && <div className="h-4 w-px bg-border/50 mx-1" />}
          {categories.map((cat) => {
            const count = todos.filter((t) => t.category === cat.value).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.value}
                onClick={() =>
                  setCategoryFilter(
                    categoryFilter === cat.value ? "all" : cat.value,
                  )
                }
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all",
                  categoryFilter === cat.value
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                )}
              >
                {cat.emoji} {cat.label} ({count})
              </button>
            );
          })}
        </motion.div>

        {/* Todo list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <AnimatePresence mode="popLayout">
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => toggleTodo(todo.id)}
                onDelete={() => deleteTodo(todo.id)}
              />
            ))}
          </AnimatePresence>

          {/* Empty state */}
          {filteredTodos.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-5">
                <Sparkles className="h-9 w-9 text-primary" />
              </div>
              <p className="text-base font-semibold mb-1">
                {filter === "completed"
                  ? "Дууссан ажил алга"
                  : filter === "active"
                    ? "Бүх ажил дууслаа! 🎉"
                    : "Одоогоор ажил алга"}
              </p>
              <p className="text-sm text-muted-foreground">
                {filter === "all" &&
                  "Дээрх хурдан нэмэх хэсгээс ажилдаа эхлэн нэмэх"}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Advanced add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-border/50 rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ListTodo className="h-5 w-5 text-primary" />
              Дэлгэрэнгүй ажил нэмэх
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDialogAdd} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ажлын нэр</Label>
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Юу хийх вэ?"
                className="w-full bg-background/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Ач холбогдол
                </Label>
                <Select
                  value={priority}
                  onValueChange={(v) =>
                    setPriority(v as "high" | "medium" | "low")
                  }
                >
                  <SelectTrigger className="bg-background/60 border-border/50 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <Flag className="h-3.5 w-3.5 text-red-500" /> Чухал
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <Flag className="h-3.5 w-3.5 text-amber-500" /> Дунд
                      </span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <Flag className="h-3.5 w-3.5 text-primary" /> Энгийн
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ангилал</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background/60 border-border/50 rounded-xl">
                    <SelectValue placeholder="Сонгох" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          {cat.emoji} {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Дуусах хугацаа
              </Label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-background/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-sm"
                >
                  Цуцлах
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!newTask.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm"
              >
                Нэмэх
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
