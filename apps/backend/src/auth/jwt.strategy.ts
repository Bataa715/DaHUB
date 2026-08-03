import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { Request } from "express";

/**
 * Cookie-оос хүчинтэй (хугацаа дуусаагүй) JWT сонгоно.
 * Хуучин: adminToken эхэнд байсан → хугацаа дууссан admin cookie байвал
 * хүчинтэй user `token`-ийг огт оролдолгүй 401/403 гаргадаг байсан.
 */
function extractBestCookieToken(req: Request): string | null {
  const candidates = [req?.cookies?.adminToken, req?.cookies?.token].filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );
  if (candidates.length === 0) return null;

  const now = Math.floor(Date.now() / 1000);
  for (const token of candidates) {
    try {
      const payloadPart = token.split(".")[1];
      if (!payloadPart) continue;
      const json = Buffer.from(
        payloadPart.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8");
      const payload = JSON.parse(json) as { exp?: number };
      if (typeof payload.exp === "number" && payload.exp > now) {
        return token;
      }
    } catch {
      // decode fail — дараагийн кандидат
    }
  }
  // Бүгд expired бол эхнийг өгнө (passport өөрөө 401 гаргана)
  return candidates[0];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractBestCookieToken,
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
