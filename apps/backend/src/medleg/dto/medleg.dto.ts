import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  MaxLength,
} from "class-validator";

export class CreateMedlegDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  category?: string;

  /** Хуучин нэг зураг — imageUrls-тай хамт ашиглаж болно */
  @IsString()
  @IsOptional()
  imageUrl?: string;

  /** Олон зураг (data URI), хамгийн ихдээ 5 */
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(7_000_000, { each: true })
  imageUrls?: string[];
}

/** Админ: мэдлэгийн нийтлэлийг засах (бүх талбар optional — зөвхөн ирсэн талбарыг шинэчилнэ) */
export class UpdateMedlegDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(7_000_000, { each: true })
  imageUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
