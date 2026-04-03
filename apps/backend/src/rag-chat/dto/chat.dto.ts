import { IsString, IsNotEmpty, MaxLength, IsOptional, IsArray } from "class-validator";

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conversationHistory?: string[];
}
