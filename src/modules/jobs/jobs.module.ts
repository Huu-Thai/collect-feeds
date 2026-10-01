import { Module } from '@nestjs/common';
import { CollectionWorkerModule } from './collection-worker/collection-worker.module';
import { JobExecutionsModule } from './job-executions/job-executions.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CollectionQueueModule } from './queues/collection-queue.module';

@Module({
  imports: [CollectionQueueModule, JobExecutionsModule, CollectionWorkerModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
