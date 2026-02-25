/**
 * Database entity type definitions for ClickHouse
 */

export interface UserEntity {
  id: string;
  userId: string;
  password: string;
  name: string;
  position: string;
  profileImage: string;
  departmentId: string;
  isAdmin: number; // ClickHouse UInt8
  isActive: number; // ClickHouse UInt8
  allowedTools: string; // JSON string
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentEntity {
  id: string;
  name: string;
  description: string;
  manager: string;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewsEntity {
  id: string;
  title: string;
  content: string;
  category: string;
  imageUrl: string;
  authorId: string;
  isPublished: number; // ClickHouse UInt8
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseEntity {
  id: string;
  name: string;
  category: string;
  description: string;
  userId: string;
  createdAt: string;
}

export interface WorkoutLogEntity {
  id: string;
  exerciseId: string;
  userId: string;
  sets: number;
  repetitions: number;
  weight: number;
  notes: string;
  date: string;
}

export interface BodyStatsEntity {
  id: string;
  userId: string;
  weight: number;
  height: number;
  date: string;
}

export interface RefreshTokenEntity {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  isRevoked: number; // ClickHouse UInt8
  createdAt: string;
}

export interface AuditLogEntity {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId: string;
  method: string;
  ipAddress: string;
  userAgent: string;
  status: "success" | "failure";
  errorMessage: string;
  metadata: string; // JSON string
  createdAt: string;
}
