/**
 * User utility functions for formatting and parsing
 */

/**
 * Format user object for API responses
 */
export function formatUserResponse(user: any) {
  return {
    id: user.id,
    userId: user.userId,
    email: user.email,
    name: user.name,
    position: user.position || "",
    department: user.departmentName || user.department || "",
    departmentId: user.departmentId || "",
    isAdmin: !!user.isAdmin,
    isActive: user.isActive !== undefined ? !!user.isActive : true,
    allowedTools: parseAllowedTools(user.allowedTools),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Parse allowedTools JSON field safely
 */
export function parseAllowedTools(
  allowedTools: string | null | undefined,
): string[] {
  if (!allowedTools) return [];

  try {
    const parsed = JSON.parse(allowedTools);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Sanitize user object (remove sensitive fields)
 */
export function sanitizeUser(user: any) {
  const { password, ...sanitized } = user;
  return sanitized;
}
