export type Exercise = {
  id?: string;
  name: string;
  category?: string;
  description?: string;
  createdAt?: Date | string;
};

export type WorkoutLog = {
  id?: string;
  exerciseId: string;
  exerciseName?: string;
  duration?: number; // in minutes
  repetitions?: number;
  sets?: number;
  weight?: number; // weight used in kg
  notes?: string;
  date: Date | string;
  exercise?: Exercise;
};

export type BodyStats = {
  id?: string;
  weight: number; // kg
  height: number; // cm
  date: Date | string;
  notes?: string;
};
