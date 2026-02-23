"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Trash2,
  ListTodo,
  Sparkles,
  Plus,
  Calendar,
  Flag,
  CheckCircle2,
  Circle,
  Clock,
  Target,
  TrendingUp,
  Zap,
  Lock,
} from "lucide-react";
import BackButton from "@/components/shared/BackButton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  },
  medium: {
    label: "Дунд",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  low: {
    label: "Энгийн",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
};

const categories = [
  { value: "work", label: "Ажил", emoji: "💼" },
  { value: "personal", label: "Хувийн", emoji: "🏠" },
  { value: "health", label: "Эрүүл мэнд", emoji: "💪" },
  { value: "study", label: "Суралцах", emoji: "📚" },
  { value: "other", label: "Бусад", emoji: "📌" },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: -100, scale: 0.9 },
};

// Stat Card Component
const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card/50 backdrop-blur-sm rounded-2xl p-4 border border-border/30"
  >
    <div className="flex items-center gap-3">
      <div className={cn("p-2.5 rounded-xl", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  </motion.div>
);

// Todo Item Component
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
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300",
        todo.completed
          ? "bg-muted/30 border-border/20"
          : cn("bg-card/50 backdrop-blur-sm hover:bg-card/70", priority.border),
        isOverdue && !todo.completed && "border-red-500/50 bg-red-500/5",
      )}
    >
      {/* Priority indicator */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
          priority.bg.replace("/10", ""),
        )}
      />

      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={cn(
          "mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
          todo.completed
            ? "bg-emerald-500 border-emerald-500"
            : "border-muted-foreground/30 hover:border-emerald-500",
        )}
      >
        {todo.completed && <CheckCircle2 className="h-4 w-4 text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-base font-medium transition-all",
            todo.completed && "line-through text-muted-foreground",
          )}
        >
          {todo.task}
        </p>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
              {category.emoji} {category.label}
            </span>
          )}
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
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
                "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
                isOverdue && !todo.completed
                  ? "bg-red-500/10 text-red-500"
                  : "bg-muted/50 text-muted-foreground",
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

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all"
      >
        <Trash2 className="h-4 w-4" />
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
  const { toast } = useToast();

  // Form state
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

      // Admin always has access
      if (user.isAdmin) {
        setHasAccess(true);
        return;
      }

      try {
        const freshUserData = await usersApi.getOne(user.id);
        const allowed = freshUserData.allowedTools?.includes("todo") || false;
        setHasAccess(allowed);
      } catch (error) {
        console.error("Error checking permission:", error);
        setHasAccess(false);
      }
    };
    checkPermission();
  }, [user]);

  // Local storage helpers
  const STORAGE_KEY = "todos_data";

  const loadTodosFromStorage = (): Todo[] => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading todos from storage:", error);
      return [];
    }
  };

  const saveTodosToStorage = (todos: Todo[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (error) {
      console.error("Error saving todos to storage:", error);
    }
  };

  useEffect(() => {
    const loadedTodos = loadTodosFromStorage();
    setTodos(loadedTodos);
    setLoading(false);
  }, []);

  const addTodo = async (e: FormEvent) => {
    e.preventDefault();
    if (newTask.trim() === "") return;

    try {
      const newTodo: Todo = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        task: newTask,
        completed: false,
        priority,
        dueDate: dueDate || undefined,
        category: category || undefined,
        createdAt: new Date().toISOString(),
      };

      const updatedTodos = [newTodo, ...todos];
      setTodos(updatedTodos);
      saveTodosToStorage(updatedTodos);

      setNewTask("");
      setPriority("medium");
      setDueDate("");
      setCategory("");
      setDialogOpen(false);
      toast({ title: "Амжилттай нэмлээ!" });
    } catch (error) {
      console.error("Error adding todo:", error);
      toast({
        title: "Алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    try {
      const updatedTodos = todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !completed } : todo,
      );
      setTodos(updatedTodos);
      saveTodosToStorage(updatedTodos);
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const updatedTodos = todos.filter((todo) => todo.id !== id);
      setTodos(updatedTodos);
      saveTodosToStorage(updatedTodos);
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  // Filter todos
  const filteredTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.completed;
    if (filter === "completed") return todo.completed;
    return true;
  });

  // Stats
  const completedCount = todos.filter((t) => t.completed).length;
  const activeCount = todos.filter((t) => !t.completed).length;
  const highPriorityCount = todos.filter(
    (t) => t.priority === "high" && !t.completed,
  ).length;
  const completionRate =
    todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  // Permission check
  if (hasAccess === null) {
    return (
      <div className="min-h-screen relative flex justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen relative flex flex-col justify-center items-center p-4">
        <div className="text-center max-w-md">
          <div className="p-6 rounded-full bg-muted/50 inline-block mb-6">
            <Lock className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Эрх хязгаарлагдсан</h2>
          <p className="text-muted-foreground mb-6">
            Та энэ хэрэгслийг ашиглах эрхгүй байна. Админтай холбогдож эрх авна
            уу.
          </p>
          <BackButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen relative flex justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen relative"
    >
      <div className="relative z-10 p-4 md:p-8">
        <BackButton />

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center pt-6 pb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30 mb-6"
            >
              <ListTodo className="h-10 w-10 text-white" />
            </motion.div>
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 bg-clip-text text-transparent">
              Хийх зүйлс
            </h1>
            <p className="text-muted-foreground mt-3 text-lg">
              Өдрийн ажлаа төлөвлөж, бүтээмжээ нэмэгдүүлээрэй
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
          >
            <StatCard
              icon={Target}
              label="Нийт"
              value={todos.length}
              color="bg-blue-500/10 text-blue-500"
            />
            <StatCard
              icon={Circle}
              label="Идэвхтэй"
              value={activeCount}
              color="bg-amber-500/10 text-amber-500"
            />
            <StatCard
              icon={CheckCircle2}
              label="Дууссан"
              value={completedCount}
              color="bg-emerald-500/10 text-emerald-500"
            />
            <StatCard
              icon={TrendingUp}
              label="Гүйцэтгэл"
              value={`${completionRate}%`}
              color="bg-purple-500/10 text-purple-500"
            />
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-3xl shadow-xl overflow-hidden">
              <CardContent className="p-6">
                {/* Top bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <Tabs
                    value={filter}
                    onValueChange={(v) => setFilter(v as any)}
                    className="w-full sm:w-auto"
                  >
                    <TabsList className="bg-muted/50 rounded-xl p-1">
                      <TabsTrigger
                        value="all"
                        className="rounded-lg data-[state=active]:bg-card"
                      >
                        Бүгд
                      </TabsTrigger>
                      <TabsTrigger
                        value="active"
                        className="rounded-lg data-[state=active]:bg-card"
                      >
                        Идэвхтэй
                      </TabsTrigger>
                      <TabsTrigger
                        value="completed"
                        className="rounded-lg data-[state=active]:bg-card"
                      >
                        Дууссан
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Button
                    onClick={() => setDialogOpen(true)}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="h-4 w-4" />
                    Шинэ
                  </Button>
                </div>

                {/* High priority alert */}
                {highPriorityCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <Zap className="h-5 w-5 text-red-500" />
                    <p className="text-sm text-red-500">
                      <span className="font-semibold">{highPriorityCount}</span>{" "}
                      чухал ажил хийгдээгүй байна
                    </p>
                  </motion.div>
                )}

                {/* Todo List */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredTodos.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={() => toggleTodo(todo.id, todo.completed)}
                        onDelete={() => deleteTodo(todo.id)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Empty state */}
                {filteredTodos.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                  >
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                      <Sparkles className="h-10 w-10 text-emerald-500" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">
                      {filter === "completed"
                        ? "Дууссан ажил алга"
                        : filter === "active"
                          ? "Идэвхтэй ажил алга, сайхан амар!"
                          : "Хийх ажил алга, сайхан амар!"}
                    </p>
                    {filter === "all" && (
                      <Button
                        onClick={() => setDialogOpen(true)}
                        variant="outline"
                        className="mt-4 rounded-xl gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Ажил нэмэх
                      </Button>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Add Todo Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-0 rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-500" />
              Шинэ ажил нэмэх
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={addTodo} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Ажлын нэр</Label>
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Юу хийх вэ?"
                className="bg-background/50 border-border/50 rounded-xl"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ач холбогдол</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as any)}
                >
                  <SelectTrigger className="bg-background/50 border-border/50 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="high" className="rounded-lg">
                      <span className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-red-500" /> Чухал
                      </span>
                    </SelectItem>
                    <SelectItem value="medium" className="rounded-lg">
                      <span className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-amber-500" /> Дунд
                      </span>
                    </SelectItem>
                    <SelectItem value="low" className="rounded-lg">
                      <span className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-emerald-500" /> Энгийн
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ангилал</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background/50 border-border/50 rounded-xl">
                    <SelectValue placeholder="Сонгох" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.map((cat) => (
                      <SelectItem
                        key={cat.value}
                        value={cat.value}
                        className="rounded-lg"
                      >
                        <span className="flex items-center gap-2">
                          {cat.emoji} {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Дуусах хугацаа
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-background/50 border-border/50 rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="rounded-xl">
                  Цуцлах
                </Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl"
                disabled={!newTask.trim()}
              >
                Нэмэх
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
