import { Module } from '@nestjs/common';
import { OracleService } from './oracle.service';
import { OracleConfigService } from './oracle-config.service';
import { OracleSearchController } from './oracle-search.controller';

@Module({
  controllers: [OracleSearchController],
  providers: [OracleService, OracleConfigService],
  exports: [OracleService, OracleConfigService],
})
export class OracleModule {}
