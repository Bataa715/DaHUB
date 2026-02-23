import { IsString, IsOptional, IsNumber, Min } from "class-validator";

export class CreateExerciseDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateWorkoutLogDto {
  @IsString()
  exerciseId: string;

  @IsNumber()
  @IsOptional()
  sets?: number;

  @IsNumber()
  @IsOptional()
  repetitions?: number;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateBodyStatsDto {
  @IsNumber()
  @Min(1)
  weight: number;

  @IsNumber()
  @Min(1)
  height: number;
}
