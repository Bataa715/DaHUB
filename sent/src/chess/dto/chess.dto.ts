import { IsString } from "class-validator";

export class SendInviteDto {
  @IsString()
  toUserId: string;

  @IsString()
  toUserName: string;
}

export class MakeMoveDto {
  @IsString()
  move: string; // SAN notation e.g. "e4", "Nf3", "O-O"
}

export class FinishGameDto {
  @IsString()
  status: string; // 'white_won' | 'black_won' | 'draw'

  @IsString()
  resultReason: string; // 'checkmate' | 'stalemate' | 'resignation' | 'draw_agreement' | 'insufficient_material' | 'fifty_move' | 'threefold_repetition'
}
