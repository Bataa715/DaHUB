import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  userId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  position?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  departmentId?: string;

  // [H-5] Reject SVG and arbitrary content; accept only safe raster image data URIs.
  // Хоосон string = профайл зураг устгах
  @IsString()
  @IsOptional()
  @MaxLength(7_000_000) // ~5MB after base64 overhead
  @Matches(/^(|data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+)$/, {
    message:
      "profileImage нь зөвхөн jpeg|png|webp|gif форматын data URI эсвэл хоосон байх ёстой",
  })
  profileImage?: string;

  @IsArray()
  @IsOptional()
  allowedTools?: string[];
}

export class UpdateToolsDto {
  @IsArray()
  @IsString({ each: true })
  allowedTools!: string[];
}

export class SetAdminRoleDto {
  @IsBoolean()
  isAdmin!: boolean;

  @IsBoolean()
  isSuperAdmin!: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  grantableTools?: string[];
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
