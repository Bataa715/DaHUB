import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Requires the request user to be a superAdmin.
 * Must be used AFTER JwtAuthGuard so that req.user is already populated.
 *
 * Used exclusively for admin-role management endpoints — only superAdmin
 * can promote/demote other users to/from admin.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.isSuperAdmin) {
      throw new ForbiddenException(
        "Зөвхөн супер администраторт зориулсан үйлдэл",
      );
    }
    return true;
  }
}
