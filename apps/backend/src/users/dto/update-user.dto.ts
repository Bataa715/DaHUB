import { IsString, IsBoolean, IsOptional, IsArray } from "class-validator";

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  profileImage?: string;

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;

  @IsArray()
  @IsOptional()
  allowedTools?: string[];
}
