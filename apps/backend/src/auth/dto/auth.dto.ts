import {
  IsString,
  MinLength,
  IsNotEmpty,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SignupDto {
  @ApiProperty({
    example: "Password123!",
    description: "User password (min 6 characters)",
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: "Болд-Эрдэнэ", description: "Full name of the user" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "Удирдлага", description: "Department name" })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: "Менежер", description: "Job position" })
  @IsString()
  @IsNotEmpty()
  position: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "Refresh token",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LoginDto {
  @ApiProperty({ example: "Удирдлага", description: "Department name" })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: "Болд-Эрдэнэ", description: "Username" })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: "Password123!",
    description:
      "Password (min 8 chars, must contain uppercase, lowercase, number, special char)",
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: "Nuуц үг хамгийн багадаа 8 тэмдэгт байх ёстой" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    {
      message:
        "Nuуц үг нь том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой",
    },
  )
  password: string;
}

export class LoginByIdDto {
  @ApiProperty({ example: "DAG-EAH-Bold-Erdene", description: "User ID" })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: "user123",
    description: "Password",
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class AdminLoginDto {
  @ApiProperty({ example: "admin-userid", description: "Admin user ID" })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: "AdminPassword123!",
    description: "Admin password",
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  password: string;
}

// New DTOs for registration flow
export class CheckUserDto {
  @ApiProperty({
    example: "DAG-EAH-Bold-Erdene",
    description: "User ID to check",
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class RegisterUserDto {
  @ApiProperty({ example: "Удирдлага", description: "Department name" })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: "Менежер", description: "Job position" })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiProperty({ example: "Болд-Эрдэнэ", description: "Full name" })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class SetPasswordDto {
  @ApiProperty({ example: "DAG-EAH-Bold-Erdene", description: "User ID" })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: "Password123!",
    description:
      "New password (min 8 chars, must contain uppercase, lowercase, number, special char)",
    minLength: 8,
  })
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
}

export class ChangePasswordDto {
  @ApiProperty({ example: "OldPassword123!", description: "Current password" })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: "NewPassword123!",
    description:
      "New password (min 8 chars, must contain uppercase, lowercase, number, special char)",
    minLength: 8,
  })
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
