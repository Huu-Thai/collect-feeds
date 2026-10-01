import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { COLLECTION_QUEUE } from '../collection-worker/collection-job.data';

@Module({
  imports: [BullModule.registerQueue({ name: COLLECTION_QUEUE })],
  exports: [BullModule],
})
export class CollectionQueueModule {}
