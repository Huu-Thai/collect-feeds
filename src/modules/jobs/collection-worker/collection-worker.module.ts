import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FeedsModule } from '@modules/feeds/feeds.module';
import { JobExecutionsModule } from '../job-executions/job-executions.module';
import { CollectionQueueModule } from '../queues/collection-queue.module';
import { CollectionWorkerProcessor } from './collection-worker.processor';
import { CollectorRegistry } from './collectors/collector.registry';
import { PhishingDatabaseCollector } from './collectors/phishing-database.collector';

@Module({
  imports: [
    CollectionQueueModule,
    FeedsModule,
    JobExecutionsModule,
    HttpModule,
  ],
  providers: [
    CollectionWorkerProcessor,
    CollectorRegistry,
    PhishingDatabaseCollector,
  ],
})
export class CollectionWorkerModule {}
