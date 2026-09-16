import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsJSON,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * Эрсдэлийн үзүүлэлтийн тохиргоо. Өмнө нь `@Body()` нь TypeScript type
 * (`Omit<IndicatorConfig…>`) байсан тул ValidationPipe ямар ч шалгалт хийдэггүй,
 * дурын талбар/утга хүснэгтэд бичигдэх боломжтой байв.
 * Талбарууд нь admin/risk-indicators хуудасны илгээдэг payload-той яг таарна.
 */
export class CreateIndicatorConfigDto {
  @IsString()
  @MaxLength(100, { message: "Дэд код хэт урт байна" })
  subid!: string;

  @IsString()
  @IsNotEmpty({ message: "Үзүүлэлтийн нэр шаардлагатай" })
  @MaxLength(300, { message: "Үзүүлэлтийн нэр хэт урт байна" })
  name!: string;

  @Type(() => Number)
  @IsInt({ message: "Бүлэг бүхэл тоо байх ёстой" })
  @Min(1)
  @Max(20)
  group_num!: number;

  @Type(() => Number)
  @IsNumber({}, { message: "Жин тоо байх ёстой" })
  @Min(0)
  @Max(1000)
  weight!: number;

  @Type(() => Number)
  @IsIn([0, 1])
  is_manual!: 0 | 1;

  @Type(() => Number)
  @IsIn([0, 1])
  is_judgment!: 0 | 1;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Тайлбар хэт урт байна" })
  hint?: string;

  @IsString()
  @IsJSON({ message: "Онооны шкал JSON хэлбэртэй байх ёстой" })
  @MaxLength(20_000, { message: "Онооны шкал хэт урт байна" })
  score_scale!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sort_order?: number;
}

/** Засах үед бүх талбар заавал биш — байхгүйг нь одоогийн утгаас нөхнө. */
export class UpdateIndicatorConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Дэд код хэт урт байна" })
  subid?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Үзүүлэлтийн нэр шаардлагатай" })
  @MaxLength(300, { message: "Үзүүлэлтийн нэр хэт урт байна" })
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Бүлэг бүхэл тоо байх ёстой" })
  @Min(1)
  @Max(20)
  group_num?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Жин тоо байх ёстой" })
  @Min(0)
  @Max(1000)
  weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  is_manual?: 0 | 1;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  is_judgment?: 0 | 1;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Тайлбар хэт урт байна" })
  hint?: string;

  @IsOptional()
  @IsString()
  @IsJSON({ message: "Онооны шкал JSON хэлбэртэй байх ёстой" })
  @MaxLength(20_000, { message: "Онооны шкал хэт урт байна" })
  score_scale?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sort_order?: number;
}
