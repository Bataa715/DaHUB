import { Module } from "@nestjs/common";
import { ExcelReportController } from "./excel-report.controller";
import { ExcelReportService } from "./excel-report.service";

@Module({
  controllers: [ExcelReportController],
  providers: [ExcelReportService],
})
export class ExcelReportModule {}
