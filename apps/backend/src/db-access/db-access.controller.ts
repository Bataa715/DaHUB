import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ToolGuard } from "../auth/guards/tool.guard";
import { RequireTools } from "../auth/guards/require-tools.decorator";
import { DbAccessService } from "./db-access.service";
import {
  CreateAccessRequestDto,
  ReviewRequestDto,
  RevokeGrantDto,
} from "./dto/db-access.dto";

@Controller("db-access")
@UseGuards(JwtAuthGuard, ToolGuard)
@RequireTools("db_access_requester", "db_access_granter")
export class DbAccessController {
  constructor(private readonly dbAccessService: DbAccessService) {}

  // ─── Tables ─────────────────────────────────────────────────────────────────

  /** GET /db-access/tables - list all available ClickHouse tables */
  @Get("tables")
  getTables() {
    return this.dbAccessService.getAvailableTables();
  }

  // ─── Requests ───────────────────────────────────────────────────────────────

  /** POST /db-access/requests - submit a new access request */
  @Post("requests")
  @HttpCode(HttpStatus.CREATED)
  createRequest(@Request() req: any, @Body() dto: CreateAccessRequestDto) {
    return this.dbAccessService.createRequest(req.user, dto);
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

  /** DELETE /db-access/requests/:id - hard-delete a single request (not approved) */
  @Delete("requests/:id")
  deleteRequest(@Param("id") id: string, @Request() req: any) {
    return this.dbAccessService.deleteRequest(id, req.user);
  }

  /**
   * POST /db-access/grants/cleanup-ch/:requesterUserId
   * Force-drop all ClickHouse roles and the CH user for the given userId string.
   * Use when a user's CH access state is stuck/orphaned after a failed revoke.
   */
  @Post("grants/cleanup-ch/:requesterUserId")
  cleanupChUser(
    @Param("requesterUserId") requesterUserId: string,
    @Request() req: any,
  ) {
    return this.dbAccessService.cleanupUserChAccess(requesterUserId, req.user);
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

  /** DELETE /db-access/grants/:id - revoke a grant (admin/granter only) */
  @Delete("grants/:id")
  revokeGrant(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: RevokeGrantDto,
  ) {
    return this.dbAccessService.revokeGrant(id, req.user, dto);
  }

  /** DELETE /db-access/grants/:id/cancel - user self-cancels their own grant */
  @Delete("grants/:id/cancel")
  selfRevokeGrant(@Param("id") id: string, @Request() req: any) {
    return this.dbAccessService.selfRevokeGrant(id, req.user);
  }
}
