import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsIn, IsOptional, ValidateIf } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Хэрэглэгчийн нэр шаардлагатай' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Нууц үг шаардлагатай' })
  password: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(3, { message: 'Нэвтрэх нэр 3-50 тэмдэгт байх ёстой' })
  @MaxLength(50, { message: 'Нэвтрэх нэр 3-50 тэмдэгт байх ёстой' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'Нэвтрэх нэр зөвхөн үсэг, тоо, _, ., - агуулна' })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой' })
  @Matches(/(?=.*[A-Za-z])/, { message: 'Нууц үг үсэг агуулсан байх ёстой' })
  @Matches(/(?=.*\d)/, { message: 'Нууц үг тоо агуулсан байх ёстой' })
  password: string;

  @IsString()
  @MinLength(1, { message: 'Нэр 1-100 тэмдэгт байх ёстой' })
  @MaxLength(100, { message: 'Нэр 1-100 тэмдэгт байх ёстой' })
  displayName: string;

  @IsString()
  @IsIn(['admin', 'viewer'], { message: 'Үүрэг зөвхөн admin эсвэл viewer байх ёстой' })
  role: 'admin' | 'viewer';
}

export class UpdateRoleDto {
  @IsString()
  @IsIn(['admin', 'viewer'], { message: 'Үүрэг зөвхөн admin эсвэл viewer байх ёстой' })
  role: 'admin' | 'viewer';
}

export class ChangePasswordDto {
  @ValidateIf(o => o.newPassword === undefined)
  @IsString()
  @MinLength(8, { message: 'Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой' })
  @Matches(/(?=.*[A-Za-z])/, { message: 'Нууц үг үсэг агуулсан байх ёстой' })
  @Matches(/(?=.*\d)/, { message: 'Нууц үг тоо агуулсан байх ёстой' })
  password?: string;

  @ValidateIf(o => o.password === undefined)
  @IsString()
  @MinLength(8, { message: 'Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой' })
  @Matches(/(?=.*[A-Za-z])/, { message: 'Нууц үг үсэг агуулсан байх ёстой' })
  @Matches(/(?=.*\d)/, { message: 'Нууц үг тоо агуулсан байх ёстой' })
  newPassword?: string;
}
