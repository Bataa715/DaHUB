import { IsString, IsNotEmpty, Matches } from "class-validator";

export class DeleteDocumentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_\-.\u0400-\u04FF\s()]+$/, {
    message: "source нь зөвхөн хэвийн тэмдэгтүүдийг агуулна.",
  })
  source: string;
}
