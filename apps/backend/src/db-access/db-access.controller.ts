import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DbAccessService } from "./db-access.service";
import {
  CreateAccessRequestDto,
  ReviewRequestDto,
  RevokeGrantDto,
} from "./dto/db-access.dto";

@Controller("db-access")
@UseGuards(JwtAuthGuard)
export class DbAccessController {
  constructor(private readonly dbAccessService: DbAccessService) {}

  // ─── Tables ─────────────────────────────────────────────────────────────────

  /** GET /db-access/tables - list all available ClickHouse tables */
  @Get("tables")
  getTables() {
    return this.dbAccessService.getAvailableTables();
  }

  /** GET /db-access/tables/:db/:table/columns - get columns for a table */
  @Get("tables/:db/:table/columns")
  getColumns(@Param("db") db: string, @Param("table") table: string) {
    return this.dbAccessService.getTableColumns(`${db}.${table}`);
  }

  // ─── Requests ───────────────────────────────────────────────────────────────

  /** POST /db-access/requests - submit a new access request */
  @Post("requests")
  @HttpCode(HttpStatus.CREATED)
  createRequest(@Request() req: any, @Body() dto: CreateAccessRequestDto) {
    return this.dbAccessService.createRequest(req.user, dto);
  }

  /** GET /db-access/requests/my - get my own requests */
  @Get("requests/my")
  getMyRequests(@Request() req: any) {
    return this.dbAccessService.getMyRequests(req.user.id);
  }

  /** GET /db-access/requests/pending - pending requests waiting for review */
  @Get("requests/pending")
  getPendingRequests(@Request() req: any) {
    return this.dbAccessService.getPendingRequests(req.user);
  }

  /** GET /db-access/requests - all requests (admin/granter view) */
  @Get("requests")
  getAllRequests(@Request() req: any) {
    return this.dbAccessService.getAllRequests(req.user);
  }

  /** PATCH /db-access/requests/:id/review - approve or reject a request */
  @Patch("requests/:id/review")
  reviewRequest(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.dbAccessService.reviewRequest(id, req.user, dto);
  }

  /** POST /db-access/requests/bulk-review - approve or reject ALL pending */
  @Post("requests/bulk-review")
  bulkReview(
    @Request() req: any,
    @Body() body: { action: "approve" | "reject" },
  ) {
    return this.dbAccessService.bulkReviewPending(req.user, body.action);
  }

  // ─── Grants ──────────────────────────────────────────────────────────────────

  /** GET /db-access/grants/my - my active grants */
  @Get("grants/my")
  getMyGrants(@Request() req: any) {
    return this.dbAccessService.getMyGrants(req.user.id);
  }

  /** GET /db-access/grants - all active grants (admin view) */
  @Get("grants")
  getAllGrants(@Request() req: any) {
    return this.dbAccessService.getAllGrants(req.user);
  }

  /** GET /db-access/grants/user/:userId - grants for a specific user */
  @Get("grants/user/:userId")
  getGrantsByUser(@Param("userId") userId: string, @Request() req: any) {
    return this.dbAccessService.getGrantsByUser(userId, req.user);
  }

  /** DELETE /db-access/grants/:id - revoke a grant */
  @Delete("grants/:id")
  revokeGrant(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: RevokeGrantDto,
  ) {
    return this.dbAccessService.revokeGrant(id, req.user, dto);
  }

  // ─── Grantors ────────────────────────────────────────────────────────────────

  /** GET /db-access/grantors - list users who can grant access */
  @Get("grantors")
  getGrantors() {
    return this.dbAccessService.getGrantors();
  }
}
