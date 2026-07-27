import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  Matches,
} from "class-validator";
import { Transform } from "class-transformer";

/** userId — латин + кирилл (Монгол нэр), тоо, . _ - */
const USER_ID_PATTERN = /^[\p{L}\p{N}._\-]+$/u;

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(8, { message: "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой" })
  password: string;
}

export class LoginByIdDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(USER_ID_PATTERN, {
    message: "userId формат буруу байна",
  })
  userId: string;

  @IsString()
  @MinLength(8, { message: "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой" })
  password: string;
}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(8, { message: "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой" })
  password: string;
}

// New DTOs for registration flow
export class CheckUserDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(USER_ID_PATTERN, {
    message: "userId формат буруу байна",
  })
  userId: string;
}

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  department: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class SetPasswordDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(USER_ID_PATTERN, {
    message: "userId формат буруу байна",
  })
  userId: string;

  @IsString()
  @MinLength(8, { message: "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`])[A-Za-z\d@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`]+$/,
    {
      message:
        "Нууц үг нь том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой",
    },
  )
  password: string;

  // [N-3] One-time claim token issued at registration — prevents account hijacking
  @IsString()
  @IsNotEmpty()
  claimToken: string;
}

export class ReviewRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(approve|reject)$/, {
    message: "action нь 'approve' эсвэл 'reject' байх ёстой",
  })
  action: "approve" | "reject";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`])[A-Za-z\d@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`]+$/,
    {
      message:
        "Нууц үг нь том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой",
    },
  )
  newPassword: string;
}
