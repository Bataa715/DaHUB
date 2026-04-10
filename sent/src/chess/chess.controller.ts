import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ChessService } from "./chess.service";
import { SendInviteDto, MakeMoveDto, FinishGameDto } from "./dto/chess.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("chess")
@UseGuards(JwtAuthGuard)
export class ChessController {
  constructor(private chessService: ChessService) {}

  // ── Invitations ──────────────────────────────────────────────────────────

  @Get("invitations")
  getMyInvitations(@Request() req: any) {
    return this.chessService.getMyInvitations(req.user.id);
  }

  @Post("invite")
  sendInvite(@Request() req: any, @Body() dto: SendInviteDto) {
    return this.chessService.sendInvite(req.user.id, req.user.name, dto);
  }

  @Post("invite/:id/accept")
  acceptInvite(@Param("id") id: string, @Request() req: any) {
    return this.chessService.acceptInvite(id, req.user.id);
  }

  @Post("invite/:id/decline")
  declineInvite(@Param("id") id: string, @Request() req: any) {
    return this.chessService.declineInvite(id, req.user.id);
  }

  // ── Games ─────────────────────────────────────────────────────────────────

  @Get("games")
  getMyGames(@Request() req: any) {
    return this.chessService.getMyGames(req.user.id);
  }

  @Get("game/:id")
  getGame(@Param("id") id: string) {
    return this.chessService.getGame(id);
  }

  @Post("game/:id/move")
  makeMove(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: MakeMoveDto,
  ) {
    return this.chessService.makeMove(id, req.user.id, dto);
  }

  @Post("game/:id/finish")
  finishGame(
    @Param("id") id: string,
    @Request() req: any,
    @Body() dto: FinishGameDto,
  ) {
    return this.chessService.finishGame(id, req.user.id, dto);
  }

  @Get("history")
  getHistory(@Request() req: any) {
    return this.chessService.getHistory(req.user.id);
  }

  @Get("rankings")
  getRankings() {
    return this.chessService.getRankings();
  }
}
