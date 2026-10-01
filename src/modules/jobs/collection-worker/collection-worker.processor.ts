import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '@database/prisma.service';
import { FeedsService } from '@modules/feeds/feeds.service';
import type { ExecutionCounts } from '../job-executions/job-executions.service';
import { JobExecutionsService } from '../job-executions/job-executions.service';
import {
  COLLECTION_QUEUE,
  type CollectionJobData,
} from './collection-job.data';
import { CollectorRegistry } from './collectors/collector.registry';

@Processor(COLLECTION_QUEUE)
export class CollectionWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(CollectionWorkerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feedsService: FeedsService,
    private readonly jobExecutionsService: JobExecutionsService,
    private readonly collectorRegistry: CollectorRegistry,
  ) {
    super();
  }

  async process(job: Job<CollectionJobData>): Promise<void> {
    const { jobId, triggeredBy, executionId } = job.data;

    const jobRecord = await this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: { source: true },
    });

    const execution = executionId
      ? await this.jobExecutionsService.markRunning(executionId)
      : await this.jobExecutionsService.createRunning(jobId, triggeredBy);

    const counts: ExecutionCounts = {
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
    };

    try {
      const collector = this.collectorRegistry.resolve(jobRecord.source.type);
      const indicators = await collector.fetch(jobRecord.source);

      for (const indicator of indicators) {
        counts.recordsProcessed += 1;
        try {
          const { wasCreated } = await this.feedsService.upsertFromSource(
            indicator,
            jobRecord.sourceId,
          );
          if (wasCreated) {
            counts.recordsCreated += 1;
          } else {
            counts.recordsUpdated += 1;
          }
        } catch (error) {
          counts.recordsFailed += 1;
          this.logger.warn(
            `Failed to upsert indicator "${indicator.value}": ${(error as Error).message}`,
          );
        }
      }

      await this.jobExecutionsService.markSuccess(execution.id, counts);
    } catch (error) {
      const err = error as Error;
      await this.jobExecutionsService.markFailed(
        execution.id,
        counts,
        err.message,
      );
      throw err;
    }
  }
}
