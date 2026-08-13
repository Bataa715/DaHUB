import { IsString, IsOptional, Matches, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Prefix код: том латин үсэг/тоо/зураас (жишээ: DAG-DAA).
 * Төгсгөл/эхний `-`-ийг цэвэрлэж, давхар `--`-ийг нэг болгоно.
 */
function sanitizeDeptCode(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
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
  @MaxLength(20)
  @Matches(/^([A-Z0-9]+(?:-[A-Z0-9]+)*)?$/, {
    message: "Код нь том үсэг, тоо болон зурааснаас бүрдэнэ (жишээ: DAG-DAA)",
  })
  code?: string;
}
