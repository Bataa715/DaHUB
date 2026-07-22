import { BadRequestException } from "@nestjs/common";

/**
 * BadRequestException variant whose message IS safe to show to the client
 * as-is (curated, non-sensitive text — e.g. Python sandbox validation
 * errors like "import зөвшөөрөгдөхгүй"). The global AllExceptionsFilter
 * masks all other 400s with a generic message to avoid leaking internal
 * details; this class opts a specific error out of that masking.
 *
 * Only throw this with messages you fully control and have reviewed for
 * sensitive info (no stack traces, connection strings, file paths, etc).
 */
export class UserFacingBadRequestException extends BadRequestException {}
