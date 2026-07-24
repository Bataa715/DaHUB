import { Request } from "express";

/**
 * Shape JwtStrategy.validate() (see auth/jwt.strategy.ts) attaches to
 * req.user for every authenticated request. Mirrors AuthService's
 * formatUserResponse() output.
 */
export interface AuthenticatedUser {
  id: string;
  userId: string;
  name: string;
  position?: string;
  department?: string | null;
  departmentId?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedTools?: string[];
  grantableTools?: string[];
  profileImage?: string | null;
  isActive?: boolean;
  [key: string]: unknown;
}

/** Use this instead of `@Request() req: any` / `@Req() req: any` on any
 * route guarded by JwtAuthGuard — gives req.user real autocomplete + type
 * checking instead of `any`. */
export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
