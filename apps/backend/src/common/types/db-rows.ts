/**
 * ClickHouse хүснэгтийн мөрийн төрлүүд — `clickhouse.query<T>()`-д `any`-ийн оронд.
 *
 * JSON гаралтын дүрэм: UInt8/UInt16/UInt32 → number, UInt64 → string,
 * DateTime/Date → "YYYY-MM-DD HH:MM:SS" string, Array(String) → string[].
 * DDL: clickhouse.service.ts (+ модулийн `ALTER … ADD COLUMN` self-heal).
 *
 * `interface` биш `type` — `Record<string, unknown>` параметрт (buildUsersTableRow г.м.)
 * шууд дамжуулах боломжтой (interface-д далд index signature байдаггүй).
 */

export type UserDbRow = {
  id: string;
  userId: string;
  password: string;
  name: string;
  position: string;
  profileImage: string;
  departmentId: string;
  isAdmin: number;
  isSuperAdmin: number;
  isActive: number;
  /** JSON массив мөр */
  allowedTools: string;
  /** JSON массив мөр */
  grantableTools: string;
  isLocked: number;
  failedLoginCount: number;
  lockedAt: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `users u LEFT JOIN departments d` — `d.name AS departmentName` */
export type UserWithDepartmentDbRow = UserDbRow & {
  departmentName: string | null;
};

export type DepartmentDbRow = {
  id: string;
  name: string;
  description: string;
  manager: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

export type RegistrationRequestDbRow = {
  id: string;
  userId: string;
  name: string;
  department: string;
  departmentId: string;
  position: string;
  status: string;
  claimToken: string;
  reviewedBy: string;
  reviewedByName: string;
  reviewNote: string;
  requestedAt: string;
  reviewedAt: string;
  updatedAt: string;
};

export type AccessRequestDbRow = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterUserId: string;
  tables: string[];
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  reason: string;
  status: string;
  reviewedBy: string;
  reviewedByName: string;
  reviewNote: string;
  requestTime: string;
  reviewedAt: string;
  updatedAt: string;
};

export type AccessGrantDbRow = {
  id: string;
  userId: string;
  userName: string;
  userUserId: string;
  requestId: string;
  tableName: string;
  columns: string[];
  accessTypes: string[];
  validUntil: string;
  grantedBy: string;
  grantedByName: string;
  grantedAt: string;
  isActive: number;
  revokedAt: string;
  revokeReason: string;
  /** AES-256-GCM-ээр шифрлэгдсэн — хэзээ ч клиент рүү буцаахгүй */
  chPassword: string;
};

export type MedlegDbRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl: string;
  imageMime: string;
  imagesJson: string;
  authorId: string;
  isPublished: number;
  createdAt: string;
  updatedAt: string;
};
