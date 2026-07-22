import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsString,
} from "class-validator";

export class RelatedPartyTransactionsDto {
  @IsArray()
  @ArrayMinSize(2, { message: "Хамгийн багадаа 2 CIF/FORACID шаардлагатай" })
  @ArrayMaxSize(200, {
    message: "Хамгийн ихдээ 200 CIF/FORACID зэрэг шалгах боломжтой",
  })
  @IsString({ each: true })
  customerIds: string[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
