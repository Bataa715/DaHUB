import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  Matches,
  MaxLength,
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
  @IsString()
  @IsOptional()
  @MaxLength(7_000_000) // ~5MB after base64 overhead
  @Matches(/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/, {
    message:
      "profileImage нь зөвхөн jpeg|png|webp|gif форматын data URI байх ёстой",
  })
  profileImage?: string;

  @IsArray()
  @IsOptional()
  allowedTools?: string[];
}
