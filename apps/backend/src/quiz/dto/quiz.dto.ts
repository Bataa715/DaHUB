import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsInt,
  Min,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class QuizQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(150, { each: true })
  options: string[];

  @IsInt()
  @Min(0)
  correctIndex: number;
}

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  // [MULTI-Q] Нэг quiz-д олон асуулт байж болно (1-20). Асуулт бүр өөрийн
  // сонголт + зөв хариулттай.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions: QuizQuestionDto[];
}

export class QuizAnswerItemDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsInt()
  @Min(0)
  selectedIndex: number;
}

export class AnswerQuizDto {
  // Quiz дотрох бүх асуултын хариултыг НЭГ дор илгээнэ (нэг оролдлого).
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerItemDto)
  answers: QuizAnswerItemDto[];

  // Клиент талд хэмжсэн, quiz эхлүүлснээс дуусгах хүртэлх хугацаа (мс).
  @IsInt()
  @Min(0)
  timeTakenMs: number;
}
