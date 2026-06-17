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

  constructor() {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      const reason = info?.message;
      // "No auth token" / хугацаа дууссан токен нь хэвийн нөхцөл —
      // клиент талд silent refresh хийгээд дахин оролддог. Үүнийг debug-д
      // бууруулж лог дэх 401 чимээ шуугианыг арилгана. Бусад буруу токенуудыг
      // аюулгүй байдлын хяналтад зориулж warn хэвээр үлдээнэ.
      if (reason === "No auth token" || reason === "jwt expired") {
        // Лог дэх 401 шуугианыг бүрэн арилгахын тулд verbose-д (default log
        // level-ээс доош) бичнэ — энэ нь хэвийн silent-refresh урсгал.
        this.logger.verbose("Authentication skipped", { reason });
      } else {
        // [L-3] Log auth failures in all environments for security monitoring
        this.logger.warn("Authentication failed", { reason });
      }
      throw err || new UnauthorizedException("Invalid credentials");
    }
    return user;
  }
}
