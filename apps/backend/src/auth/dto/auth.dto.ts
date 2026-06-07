import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  Matches,
} from "class-validator";

export class SignupDto {
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

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @IsNotEmpty()
  position: string;
}

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
  @IsString()
  @IsNotEmpty()
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
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._\-]+$/, { message: "userId формат буруу байна" })
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
  @IsString()
  @IsNotEmpty()
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
