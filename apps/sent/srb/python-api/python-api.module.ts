import { Module } from "@nestjs/common";
import { PythonApiController } from "./python-api.controller";
import { PythonApiService } from "./python-api.service";

@Module({
  controllers: [PythonApiController],
  providers: [PythonApiService],
})
export class PythonApiModule {}
