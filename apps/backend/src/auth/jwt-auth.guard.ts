import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    // Remove debug logs for production
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      // Only log errors in development
      if (process.env.NODE_ENV === "development") {
        this.logger.warn("Authentication failed", { reason: info?.message });
      }
      throw err || new UnauthorizedException("Invalid credentials");
    }
    return user;
  }
}
