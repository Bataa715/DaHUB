import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class PlannedTaskDto {
  @IsNumber()
  order: number;

  @IsString()
  title: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  completion: number;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class DynamicSectionDto {
  @IsNumber()
  order: number;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;
}

export class TeamActivityDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  date?: string;
}

export class Section2TaskDto {
  @IsNumber()
  order: number;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsString()
  @IsOptional()
  period?: string;

  @IsString()
  @IsOptional()
  completion?: string;
}

export class Section3AutoTaskDto {
  @IsNumber()
  order: number;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  rating?: string;
}

export class Section3DashboardDto {
  @IsNumber()
  order: number;

  @IsString()
  dashboard: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  rating?: string;
}

export class Section4TrainingDto {
  @IsNumber()
  order: number;

  @IsString()
  @IsOptional()
  training?: string; // Хамрагдсан сургалт

  @IsString()
  @IsOptional()
  organizer?: string; // Зохион байгуулагч

  @IsString()
  @IsOptional()
  type?: string; // Онлайн/Танхим

  @IsString()
  @IsOptional()
  date?: string; // Хэзээ

  @IsString()
  @IsOptional()
  format?: string; // Сургалтын хэлбэр

  @IsString()
  @IsOptional()
  hours?: string; // Цаг

  @IsString()
  @IsOptional()
  meetsAuditGoal?: string; // Нийцсэн/Нийцээгүй

  @IsString()
  @IsOptional()
  sharedKnowledge?: string; // Хуваалцсан/Хуваалцаагүй
}

export class Section5TaskDto {
  @IsNumber()
  order: number;

  @IsString()
  @IsOptional()
  taskType?: string; // Ажлын төрөл

  @IsString()
  @IsOptional()
  completedWork?: string; // Хийгдсэн ажил
}

export class Section6ActivityDto {
  @IsNumber()
  order: number;

  @IsString()
  @IsOptional()
  date?: string; // Огноо

  @IsString()
  @IsOptional()
  activity?: string; // Хамт олны ажил

  @IsString()
  @IsOptional()
  initiative?: string; // Санаачлага
}

export class SaveTailanDto {
  @IsNumber()
  year: number;

  @IsNumber()
  @Min(1)
  @Max(4)
  quarter: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannedTaskDto)
  plannedTasks: PlannedTaskDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DynamicSectionDto)
  dynamicSections: DynamicSectionDto[];

  @IsString()
  @IsOptional()
  otherWork?: string; // kept for backward compat (ignored in new UI)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamActivityDto)
  teamActivities: TeamActivityDto[]; // kept for backward compat

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Section2TaskDto)
  @IsOptional()
  section2Tasks?: Section2TaskDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Section3AutoTaskDto)
  @IsOptional()
  section3AutoTasks?: Section3AutoTaskDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Section3DashboardDto)
  @IsOptional()
  section3Dashboards?: Section3DashboardDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Section4TrainingDto)
  @IsOptional()
  section4Trainings?: Section4TrainingDto[];

  @IsString()
  @IsOptional()
  section4KnowledgeText?: string; // Sub-section: мэдлэгээ ашиглаж буй байдал

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Section5TaskDto)
  @IsOptional()
  section5Tasks?: Section5TaskDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Section6ActivityDto)
  @IsOptional()
  section6Activities?: Section6ActivityDto[];

  @IsString()
  @IsOptional()
  section7Text?: string; // Шинэ санал санаачлага текст

  @IsEnum(["draft", "submitted"])
  @IsOptional()
  status?: "draft" | "submitted";
}

export class GetTailanQueryDto {
  @IsNumber()
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(4)
  quarter: number;
}
