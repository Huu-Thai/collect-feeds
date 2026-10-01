import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { PrismaService } from '@database/prisma.service';
import {
  COLLECTION_QUEUE,
  RUN_JOB_NAME,
  type CollectionJobData,
} from './collection-worker/collection-job.data';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import {
  JOB_EVENTS,
  JobCreatedEvent,
  JobDeletedEvent,
  JobUpdatedEvent,
} from './events/job.events';
import { JobExecutionsService } from './job-executions/job-executions.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jobExecutionsService: JobExecutionsService,
    @InjectQueue(COLLECTION_QUEUE)
    private readonly collectionQueue: Queue<CollectionJobData>,
  ) {}

  async create(dto: CreateJobDto, createdById?: string) {
    await this.assertSourceExists(dto.sourceId);

    const job = await this.prisma.runInTransaction((tx) =>
      tx.job.create({
        data: {
          name: dto.name,
          type: dto.type,
          sourceId: dto.sourceId,
          schedule: dto.schedule,
          isActive: dto.isActive ?? true,
          createdById,
        },
      }),
    );

    if (job.schedule && job.isActive) {
      await this.scheduleJob(job.id, job.schedule);
    }

    this.eventEmitter.emit(JOB_EVENTS.CREATED, new JobCreatedEvent(job.id));
    return job;
  }

  findAll() {
    return this.prisma.job.findMany();
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }

  async update(id: string, dto: UpdateJobDto) {
    const existing = await this.findOne(id);
    if (dto.sourceId) {
      await this.assertSourceExists(dto.sourceId);
    }

    const job = await this.prisma.runInTransaction((tx) =>
      tx.job.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          sourceId: dto.sourceId,
          schedule: dto.schedule,
          isActive: dto.isActive,
        },
      }),
    );

    if (dto.schedule !== undefined || dto.isActive !== undefined) {
      await this.unscheduleJob(existing.id);
      if (job.schedule && job.isActive) {
        await this.scheduleJob(job.id, job.schedule);
      }
    }

    this.eventEmitter.emit(JOB_EVENTS.UPDATED, new JobUpdatedEvent(job.id));
    return job;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.unscheduleJob(id);
    await this.prisma.runInTransaction((tx) =>
      tx.job.delete({ where: { id } }),
    );
    this.eventEmitter.emit(JOB_EVENTS.DELETED, new JobDeletedEvent(id));
  }

  /** Manual trigger: pre-creates the execution row so the caller gets an id back immediately. */
  async run(id: string) {
    await this.findOne(id);
    const execution = await this.jobExecutionsService.create(id, 'manual');
    await this.collectionQueue.add(RUN_JOB_NAME, {
      jobId: id,
      triggeredBy: 'manual',
      executionId: execution.id,
    });
    return execution;
  }

  private async assertSourceExists(sourceId: string) {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      throw new BadRequestException(`Source ${sourceId} not found`);
    }
  }

  private scheduleJob(jobId: string, cronPattern: string) {
    return this.collectionQueue.upsertJobScheduler(
      jobId,
      { pattern: cronPattern },
      { name: RUN_JOB_NAME, data: { jobId, triggeredBy: 'scheduled' } },
    );
  }

  private unscheduleJob(jobId: string) {
    return this.collectionQueue.removeJobScheduler(jobId);
  }
}
