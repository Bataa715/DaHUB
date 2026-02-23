"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/shared/BackButton";
import type { Exercise, WorkoutLog, BodyStats } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fitnessApi, usersApi } from "@/lib/api";
import {
  PlusCircle,
  Trash2,
  Dumbbell,
  History,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Target,
  Scale,
  Ruler,
  Activity,
  Flame,
  Heart,
  Zap,
  Award,
  Lock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  LineChart,
  Area,
  AreaChart,
} from "recharts";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
};

// Accent color
const accentColor = "34, 197, 94"; // Green

// Interactive Particles Background
const InteractiveParticles = ({ quantity = 30 }: { quantity?: number }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: quantity }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            backgroundColor: `rgba(${accentColor}, ${0.1 + Math.random() * 0.2})`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
};

// BMI Calculator
const calculateBMI = (weight: number, heightCm: number): number => {
  const heightM = heightCm / 100;
  return Number((weight / (heightM * heightM)).toFixed(1));
};

const getBMICategory = (bmi: number): { label: string; color: string } => {
  if (bmi < 18.5) return { label: "Туранхай", color: "text-blue-400" };
  if (bmi < 25) return { label: "Хэвийн", color: "text-green-400" };
  if (bmi < 30) return { label: "Илүүдэл жин", color: "text-yellow-400" };
  return { label: "Таргалалт", color: "text-red-400" };
};

// Helper: parse date safely
const parseDate = (date: Date | string): Date => {
  if (date instanceof Date) return date;
  return parseISO(date);
};

// Stat Card Component
const StatCard = ({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  color = accentColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  color?: string;
}) => (
  <motion.div variants={itemVariants}>
    <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-2xl overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: `rgba(${color}, 0.15)`,
                color: `rgb(${color})`,
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">
                {value}
                {unit && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {unit}
                  </span>
                )}
              </p>
            </div>
          </div>
          {trend && (
            <div
              className={`${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"}`}
            >
              {trend === "up" ? (
                <TrendingUp className="h-5 w-5" />
              ) : trend === "down" ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <Activity className="h-5 w-5" />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

// Add Body Stats Dialog
const AddBodyStatsDialog = ({
  onAdd,
  latestStats,
}: {
  onAdd: (stats: { weight: number; height: number }) => void;
  latestStats?: BodyStats | null;
}) => {
  const [weight, setWeight] = useState(latestStats?.weight?.toString() || "");
  const [height, setHeight] = useState(latestStats?.height?.toString() || "");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (weight && height) {
      onAdd({ weight: Number(weight), height: Number(height) });
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white">
          <Scale className="h-4 w-4" />
          Жин бүртгэх
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-0 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-green-400" />
            Биеийн үзүүлэлт
          </DialogTitle>
          <DialogDescription>
            Өнөөдрийн жин болон өндрийг оруулна уу
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Жин (кг)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="70"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Өндөр (см)</Label>
              <Input
                type="number"
                placeholder="175"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                Болих
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="rounded-xl bg-green-500 hover:bg-green-600"
            >
              Хадгалах
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Add Exercise Dialog
const AddExerciseDialog = ({
  onAdd,
}: {
  onAdd: (exercise: {
    name: string;
    category?: string;
    description?: string;
  }) => void;
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  const categories = [
    "Цээж",
    "Нуруу",
    "Мөр",
    "Гар",
    "Хөл",
    "Хэвлий",
    "Кардио",
    "Бусад",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name) {
      onAdd({
        name,
        category: category || undefined,
        description: description || undefined,
      });
      setName("");
      setCategory("");
      setDescription("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-xl gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white">
          <PlusCircle className="h-4 w-4" />
          Дасгал нэмэх
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-0 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-green-400" />
            Шинэ дасгал
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Нэр</Label>
            <Input
              placeholder="Жишээ: Bench Press"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Ангилал</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={category === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg ${category === cat ? "bg-green-500 hover:bg-green-600" : ""}`}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Тайлбар (заавал биш)</Label>
            <Textarea
              placeholder="Дасгалын тухай товч тайлбар..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                Болих
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="rounded-xl bg-green-500 hover:bg-green-600"
            >
              Нэмэх
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Exercise Card Component
const ExerciseCard = ({
  exercise,
  onLog,
  onDelete,
  recentLog,
}: {
  exercise: Exercise;
  onLog: (log: {
    exerciseId: string;
    sets?: number;
    repetitions?: number;
    weight?: number;
    notes?: string;
  }) => void;
  onDelete: () => void;
  recentLog?: WorkoutLog;
}) => {
  const [logOpen, setLogOpen] = useState(false);
  const [sets, setSets] = useState(recentLog?.sets?.toString() || "3");
  const [reps, setReps] = useState(recentLog?.repetitions?.toString() || "12");
  const [weight, setWeight] = useState(recentLog?.weight?.toString() || "");
  const [notes, setNotes] = useState("");

  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    onLog({
      exerciseId: exercise.id!,
      sets: sets ? Number(sets) : undefined,
      repetitions: reps ? Number(reps) : undefined,
      weight: weight ? Number(weight) : undefined,
      notes: notes || undefined,
    });
    setNotes("");
    setLogOpen(false);
  };

  return (
    <motion.div variants={itemVariants}>
      <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-xl overflow-hidden group hover:shadow-lg transition-all">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-sm">{exercise.name}</p>
                {exercise.category && (
                  <p className="text-xs text-muted-foreground">
                    {exercise.category}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Dialog open={logOpen} onOpenChange={setLogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-lg"
                  >
                    <PlusCircle className="h-4 w-4 text-green-400" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card/95 backdrop-blur-xl border-0 rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Dumbbell className="h-5 w-5 text-green-400" />
                      {exercise.name} бүртгэх
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLog} className="space-y-4 mt-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Сет</Label>
                        <Input
                          type="number"
                          value={sets}
                          onChange={(e) => setSets(e.target.value)}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Давталт</Label>
                        <Input
                          type="number"
                          value={reps}
                          onChange={(e) => setReps(e.target.value)}
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Жин (кг)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          className="rounded-lg"
                          placeholder="--"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Тэмдэглэл</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="rounded-lg resize-none"
                        rows={2}
                        placeholder="Заавал биш..."
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        className="rounded-xl bg-green-500 hover:bg-green-600 w-full"
                      >
                        Бүртгэх
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-0 rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Дасгал устгах уу?</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">
                      Болих
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="rounded-xl bg-red-500 hover:bg-red-600"
                    >
                      Устгах
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Workout History Component
const WorkoutHistory = ({ logs }: { logs: WorkoutLog[] }) => {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-muted-foreground">Түүх байхгүй</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {logs.slice(0, 20).map((log, index) => {
        const logDate = parseDate(log.date);
        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-3 bg-muted/30 rounded-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Dumbbell className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {log.exercise?.name || "Дасгал"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.sets && `${log.sets} сет`}
                    {log.repetitions && ` × ${log.repetitions} давталт`}
                    {log.weight && ` @ ${log.weight}кг`}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(logDate, "MM/dd HH:mm")}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// Weekly Activity Chart
const WeeklyActivityChart = ({ logs }: { logs: WorkoutLog[] }) => {
  const chartData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });

    return last7Days.map((day) => {
      const dayString = format(day, "yyyy-MM-dd");
      const logsForDay = logs.filter((log) => {
        const logDate = parseDate(log.date);
        return format(logDate, "yyyy-MM-dd") === dayString;
      });

      return {
        day: format(day, "EEE"),
        count: logsForDay.length,
        volume: logsForDay.reduce(
          (acc, log) =>
            acc + (log.sets || 1) * (log.repetitions || 0) * (log.weight || 1),
          0,
        ),
      };
    });
  }, [logs]);

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-green-400" />7 хоногийн идэвхи
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="rgb(34, 197, 94)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="rgb(34, 197, 94)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis dataKey="day" tick={{ fill: "#888", fontSize: 12 }} />
              <YAxis tick={{ fill: "#888", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "none",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="rgb(34, 197, 94)"
                fillOpacity={1}
                fill="url(#colorCount)"
                name="Дасгал"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Weight Progress Chart
const WeightProgressChart = ({ stats }: { stats: BodyStats[] }) => {
  const chartData = useMemo(() => {
    return [...stats]
      .reverse()
      .slice(-14)
      .map((stat) => ({
        date: format(parseDate(stat.date), "MM/dd"),
        weight: stat.weight,
      }));
  }, [stats]);

  if (chartData.length < 2) {
    return (
      <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            Жингийн өөрчлөлт
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
            График харуулахад хангалттай мэдээлэл байхгүй
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-400" />
          Жингийн өөрчлөлт
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "#888", fontSize: 12 }}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "none",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="rgb(96, 165, 250)"
                strokeWidth={2}
                dot={{ fill: "rgb(96, 165, 250)", strokeWidth: 2 }}
                name="Жин (кг)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Component
export default function FitnessPage() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [bodyStats, setBodyStats] = useState<BodyStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Check permission
  useEffect(() => {
    const checkPermission = async () => {
      if (!authUser) {
        setHasAccess(false);
        return;
      }

      // Admin always has access
      if (authUser.isAdmin) {
        setHasAccess(true);
        return;
      }

      try {
        const freshUserData = await usersApi.getOne(authUser.id);
        const allowed =
          freshUserData.allowedTools?.includes("fitness") || false;
        setHasAccess(allowed);
      } catch (error) {
        console.error("Error checking permission:", error);
        setHasAccess(false);
      }
    };
    checkPermission();
  }, [authUser]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fitnessApi.getDashboard();
      setExercises(data.exercises || []);
      setWorkoutLogs(data.workoutLogs || []);
      setBodyStats(data.bodyStats || []);
    } catch (error) {
      console.error("Error fetching fitness data:", error);
      toast({
        title: "Алдаа",
        description: "Мэдээлэл татахад алдаа гарлаа.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [hasAccess, toast]);

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess, fetchData]);

  // Handlers
  const handleAddBodyStats = async (stats: {
    weight: number;
    height: number;
  }) => {
    try {
      await fitnessApi.createBodyStats(stats);
      toast({
        title: "Амжилттай",
        description: "Биеийн үзүүлэлт бүртгэгдлээ.",
      });
      fetchData();
    } catch (e) {
      console.error(e);
      toast({ title: "Алдаа", variant: "destructive" });
    }
  };

  const handleAddExercise = async (exercise: {
    name: string;
    category?: string;
    description?: string;
  }) => {
    try {
      await fitnessApi.createExercise(exercise);
      toast({ title: "Амжилттай", description: "Шинэ дасгал нэмэгдлээ." });
      fetchData();
    } catch (e) {
      console.error(e);
      toast({ title: "Алдаа", variant: "destructive" });
    }
  };

  const handleLogWorkout = async (log: {
    exerciseId: string;
    sets?: number;
    repetitions?: number;
    weight?: number;
    notes?: string;
  }) => {
    try {
      await fitnessApi.createWorkoutLog(log);
      toast({ title: "Амжилттай", description: "Дасгал бүртгэгдлээ." });
      fetchData();
    } catch (e) {
      console.error(e);
      toast({ title: "Алдаа", variant: "destructive" });
    }
  };

  const handleDeleteExercise = async (id: string) => {
    try {
      await fitnessApi.deleteExercise(id);
      toast({ title: "Устгагдлаа" });
      fetchData();
    } catch (e) {
      console.error(e);
      toast({ title: "Алдаа", variant: "destructive" });
    }
  };

  // Computed values
  const latestStats = bodyStats[0] || null;
  const bmi = latestStats
    ? calculateBMI(latestStats.weight, latestStats.height)
    : null;
  const bmiCategory = bmi ? getBMICategory(bmi) : null;

  const todayLogs = workoutLogs.filter((log) => {
    const logDate = parseDate(log.date);
    return format(logDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  });

  const weeklyStats = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });
    let totalWorkouts = 0;
    let totalVolume = 0;

    last7Days.forEach((day) => {
      const dayString = format(day, "yyyy-MM-dd");
      const logsForDay = workoutLogs.filter((log) => {
        const logDate = parseDate(log.date);
        return format(logDate, "yyyy-MM-dd") === dayString;
      });
      totalWorkouts += logsForDay.length;
      logsForDay.forEach((log) => {
        totalVolume +=
          (log.sets || 1) * (log.repetitions || 0) * (log.weight || 1);
      });
    });

    return { totalWorkouts, totalVolume: Math.round(totalVolume) };
  }, [workoutLogs]);

  const groupedExercises = useMemo(() => {
    return exercises.reduce(
      (acc, ex) => {
        const category = ex.category || "Бусад";
        if (!acc[category]) acc[category] = [];
        acc[category].push(ex);
        return acc;
      },
      {} as Record<string, Exercise[]>,
    );
  }, [exercises]);

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
      <div className="min-h-screen relative">
        <InteractiveParticles quantity={30} />
        <div className="p-4 md:p-8 space-y-6 relative z-10">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen relative"
    >
      <InteractiveParticles quantity={40} />

      <div className="relative z-10 p-4 md:p-8 pt-4">
        <BackButton />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
                  <Dumbbell className="h-6 w-6" />
                </span>
                Fitness Tracker
              </h1>
              <p className="text-muted-foreground mt-2">
                Дасгал хөдөлгөөнөө бүртгэж, хянаарай
              </p>
            </div>
            <AddBodyStatsDialog
              onAdd={handleAddBodyStats}
              latestStats={latestStats}
            />
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            icon={Scale}
            label="Жин"
            value={latestStats?.weight || "--"}
            unit="кг"
            trend={
              bodyStats.length > 1 && bodyStats[0].weight < bodyStats[1].weight
                ? "down"
                : bodyStats.length > 1 &&
                    bodyStats[0].weight > bodyStats[1].weight
                  ? "up"
                  : "stable"
            }
          />
          <StatCard
            icon={Ruler}
            label="Өндөр"
            value={latestStats?.height || "--"}
            unit="см"
          />
          <StatCard
            icon={Target}
            label="BMI"
            value={bmi || "--"}
            color={
              bmi && bmi >= 18.5 && bmi < 25
                ? "34, 197, 94"
                : bmi && bmi >= 25
                  ? "234, 179, 8"
                  : "96, 165, 250"
            }
          />
          <StatCard
            icon={Flame}
            label="Өнөөдөр"
            value={todayLogs.length}
            unit="дасгал"
            color="249, 115, 22"
          />
        </motion.div>

        {/* BMI Info */}
        {bmi && bmiCategory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-2xl">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
                      <Heart className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Биеийн жингийн индекс
                      </p>
                      <p className="text-lg font-bold">
                        BMI {bmi} -{" "}
                        <span className={bmiCategory.color}>
                          {bmiCategory.label}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:block w-1/3">
                    <div className="h-2 rounded-full bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 to-red-400 relative">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-green-400 shadow-lg"
                        style={{
                          left: `${Math.min(Math.max(((bmi - 15) / 25) * 100, 0), 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>15</span>
                      <span>18.5</span>
                      <span>25</span>
                      <span>30</span>
                      <span>40</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Charts & History */}
          <div className="lg:col-span-2 space-y-6">
            <WeeklyActivityChart logs={workoutLogs} />
            <WeightProgressChart stats={bodyStats} />

            {/* Weekly Summary */}
            <Card className="bg-card/50 backdrop-blur-xl border-0 rounded-2xl">
              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-xl bg-muted/30">
                    <Zap className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold">
                      {weeklyStats.totalWorkouts}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      7 хоногийн дасгал
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/30">
                    <Award className="h-6 w-6 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold">
                      {weeklyStats.totalVolume.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Нийт хэмжээ (кг)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exercises & History */}
          <div className="space-y-6">
            <AddExerciseDialog onAdd={handleAddExercise} />

            <Tabs defaultValue="exercises" className="w-full">
              <TabsList className="bg-card/50 backdrop-blur-xl border-0 rounded-xl p-1 w-full">
                <TabsTrigger
                  value="exercises"
                  className="flex-1 rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-white gap-1.5"
                >
                  <Dumbbell className="h-4 w-4" />
                  Дасгалууд
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="flex-1 rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-white gap-1.5"
                >
                  <History className="h-4 w-4" />
                  Түүх
                </TabsTrigger>
              </TabsList>

              <TabsContent value="exercises" className="mt-4">
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4 max-h-[500px] overflow-y-auto"
                >
                  {Object.keys(groupedExercises).map((category) => (
                    <div key={category}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {groupedExercises[category].map((ex) => (
                          <ExerciseCard
                            key={ex.id}
                            exercise={ex}
                            onLog={handleLogWorkout}
                            onDelete={() => handleDeleteExercise(ex.id!)}
                            recentLog={workoutLogs.find(
                              (log) => log.exerciseId === ex.id,
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {exercises.length === 0 && (
                    <div className="text-center py-12">
                      <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-muted-foreground">
                        Дасгал нэмээгүй байна
                      </p>
                      <p className="text-sm text-muted-foreground/70">
                        Дээрх товч дээр дарж дасгал нэмнэ үү
                      </p>
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <WorkoutHistory logs={workoutLogs} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
