import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_TOOLS_KEY } from "./require-tools.decorator";

@Injectable()
export class ToolGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_TOOLS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) {
      throw new ForbiddenException("Энэ хэрэгслийг ашиглах эрх байхгүй");
    }
    if (user.isAdmin || user.isSuperAdmin) return true;

    const allowed: string[] = user.allowedTools ?? [];
    if (!required.some((t) => allowed.includes(t))) {
      throw new ForbiddenException("Энэ хэрэгслийг ашиглах эрх байхгүй");
    }
    return true;
  }
}
