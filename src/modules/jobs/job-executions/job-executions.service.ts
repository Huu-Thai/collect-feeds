import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobStatus } from '../../../database/generated/prisma/enums';
import { PrismaService } from '../../../database/prisma.service';
import {
  JOB_EXECUTION_EVENTS,
  JobExecutionCompletedEvent,
  JobExecutionFailedEvent,
  JobExecutionStartedEvent,
} from '../events/job.events';

export interface ExecutionCounts {
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
}

@Injectable()
export class JobExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  findAll(jobId?: string) {
    return this.prisma.jobExecution.findMany({
      where: jobId ? { jobId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id },
    });
    if (!execution) {
      throw new NotFoundException(`Job execution ${id} not found`);
    }
    return execution;
  }

  /** Pre-creates a PENDING execution for a manual trigger, before the queue picks it up. */
  create(jobId: string, triggeredBy: string) {
    return this.prisma.runInTransaction((tx) =>
      tx.jobExecution.create({
        data: { jobId, status: JobStatus.PENDING, triggeredBy },
      }),
    );
  }

  async markRunning(id: string) {
    const execution = await this.prisma.runInTransaction((tx) =>
      tx.jobExecution.update({
        where: { id },
        data: { status: JobStatus.RUNNING, startedAt: new Date() },
      }),
    );
    this.eventEmitter.emit(
      JOB_EXECUTION_EVENTS.STARTED,
      new JobExecutionStartedEvent(execution.id, execution.jobId),
    );
    return execution;
  }

  /** Used by the collection worker for a scheduled run, which has no pre-created execution. */
  async createRunning(jobId: string, triggeredBy: string) {
    const execution = await this.prisma.runInTransaction((tx) =>
      tx.jobExecution.create({
        data: {
          jobId,
          status: JobStatus.RUNNING,
          startedAt: new Date(),
          triggeredBy,
        },
      }),
    );
    this.eventEmitter.emit(
      JOB_EXECUTION_EVENTS.STARTED,
      new JobExecutionStartedEvent(execution.id, execution.jobId),
    );
    return execution;
  }

  async markSuccess(id: string, counts: ExecutionCounts) {
    const execution = await this.prisma.runInTransaction((tx) =>
      tx.jobExecution.update({
        where: { id },
        data: { status: JobStatus.SUCCESS, finishedAt: new Date(), ...counts },
      }),
    );
    await this.prisma.job.update({
      where: { id: execution.jobId },
      data: { lastRunAt: new Date() },
    });
    this.eventEmitter.emit(
      JOB_EXECUTION_EVENTS.COMPLETED,
      new JobExecutionCompletedEvent(execution.id, execution.jobId),
    );
    return execution;
  }

  async markFailed(id: string, counts: ExecutionCounts, errorMessage: string) {
    const execution = await this.prisma.runInTransaction((tx) =>
      tx.jobExecution.update({
        where: { id },
        data: {
          status: JobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage,
          ...counts,
        },
      }),
    );
    this.eventEmitter.emit(
      JOB_EXECUTION_EVENTS.FAILED,
      new JobExecutionFailedEvent(execution.id, execution.jobId, errorMessage),
    );
    return execution;
  }
}
