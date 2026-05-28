import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { Request } from "express";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      // [N-2] Try HttpOnly adminToken first (admin routes), fall back to user token, then Bearer header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          req?.cookies?.adminToken ?? req?.cookies?.token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
    this.logger.log("JwtStrategy initialized");
  }

  async validate(payload: any) {
    // payload.id нь UUID, payload.userId нь string (e.g., "DAG-EAH-BATAA")
    const user = await this.authService.validateUser(payload.id);
    if (!user) {
      this.logger.warn(`JWT validation failed for payload id: ${payload.id}`);
      throw new UnauthorizedException();
    }
    return user;
  }
}
