import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from "class-validator";

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

  @IsInt()
  @Min(0)
  @IsOptional()
  employeeCount?: number;
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

  @IsInt()
  @Min(0)
  @IsOptional()
  employeeCount?: number;
}
