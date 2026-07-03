import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  manager?: string;

  // Хэрэглэгчийн ID-н prefix код (зөвхөн том үсэг/тоо, 1-12 тэмдэгт)
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

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  manager?: string;

  @IsString()
  @IsOptional()
  @MaxLength(12)
  @Matches(/^[A-Z0-9]*$/, {
    message: "Код нь зөвхөн том үсэг болон тооноос бүрдэнэ",
  })
  code?: string;
}
