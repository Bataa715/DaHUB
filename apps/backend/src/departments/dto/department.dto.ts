import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";

/** Prefix код: том латин үсэг/тоо, хамгийн ихдээ 12. */
function sanitizeDeptCode(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value }) =>
    value === null || value === undefined ? undefined : String(value),
  )
  @IsString()
  @IsOptional()
  description?: string;

  @Transform(({ value }) =>
    value === null || value === undefined ? undefined : String(value),
  )
  @IsString()
  @IsOptional()
  manager?: string;

  // Хэрэглэгчийн ID-н prefix код (зөвхөн том үсэг/тоо, 1-12 тэмдэгт)
  @Transform(({ value }) => sanitizeDeptCode(value))
  @IsString()
  @IsOptional()
  @MaxLength(12)
  @Matches(/^[A-Z0-9]*$/, {
    message: "Код нь зөвхөн том үсэг болон тооноос бүрдэнэ",
  })
  code?: string;
}

export class UpdateDepartmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @Transform(({ value }) =>
    value === null || value === undefined ? undefined : String(value),
  )
  @IsString()
  @IsOptional()
  description?: string;

  @Transform(({ value }) =>
    value === null || value === undefined ? undefined : String(value),
  )
  @IsString()
  @IsOptional()
  manager?: string;

  @Transform(({ value }) => sanitizeDeptCode(value))
  @IsString()
  @IsOptional()
  @MaxLength(12)
  @Matches(/^[A-Z0-9]*$/, {
    message: "Код нь зөвхөн том үсэг болон тооноос бүрдэнэ",
  })
  code?: string;
}
