import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Requires the request user to be an admin OR superAdmin.
 * Must be used AFTER JwtAuthGuard so that req.user is already populated.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || (!user.isAdmin && !user.isSuperAdmin)) {
      throw new ForbiddenException("Зөвхөн администраторт зориулсан үйлдэл");
    }
    return true;
  }
}
