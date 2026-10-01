import { Module } from '@nestjs/common';
import { JobExecutionsController } from './job-executions.controller';
import { JobExecutionsService } from './job-executions.service';

@Module({
  controllers: [JobExecutionsController],
  providers: [JobExecutionsService],
  exports: [JobExecutionsService],
})
export class JobExecutionsModule {}
