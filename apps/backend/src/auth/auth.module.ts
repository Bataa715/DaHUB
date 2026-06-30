import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { AuditLogModule } from "../audit/audit-log.module";
import { ToolGuard } from "./guards/tool.guard";
import { AdminGuard } from "./guards/admin.guard";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: "15m" }, // H-6: shortened from 1h — refresh token handles session continuity
      }),
      inject: [ConfigService],
    }),
    AuditLogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ToolGuard, AdminGuard],
  exports: [AuthService, ToolGuard, AdminGuard],
})
export class AuthModule {}
