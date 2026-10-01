import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@database/prisma.service';
import { COLLECTION_QUEUE } from './collection-worker/collection-job.data';
import { JobExecutionsService } from './job-executions/job-executions.service';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };
  let jobExecutionsService: { create: jest.Mock };
  let queue: {
    add: jest.Mock;
    upsertJobScheduler: jest.Mock;
    removeJobScheduler: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      source: { findUnique: jest.fn() },
      job: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };
    jobExecutionsService = { create: jest.fn() };
    queue = {
      add: jest.fn(),
      upsertJobScheduler: jest.fn(),
      removeJobScheduler: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: JobExecutionsService, useValue: jobExecutionsService },
        { provide: getQueueToken(COLLECTION_QUEUE), useValue: queue },
      ],
    }).compile();

    service = moduleRef.get(JobsService);
  });

  it('rejects creating a job for an unknown source', async () => {
    prisma.source.findUnique.mockResolvedValue(null);
    await expect(
      service.create({
        name: 'Job',
        type: 'phishing_database',
        sourceId: 'missing',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('registers a BullMQ scheduler when the job has a cron schedule', async () => {
    prisma.source.findUnique.mockResolvedValue({ id: 'source-1' });
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      schedule: '0 3 * * *',
      isActive: true,
    });

    await service.create({
      name: 'Job',
      type: 'phishing_database',
      sourceId: 'source-1',
      schedule: '0 3 * * *',
    });

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'job-1',
      { pattern: '0 3 * * *' },
      expect.objectContaining({
        data: { jobId: 'job-1', triggeredBy: 'scheduled' },
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'job.created',
      expect.objectContaining({ jobId: 'job-1' }),
    );
  });

  it('does not register a scheduler for a manual-trigger-only job', async () => {
    prisma.source.findUnique.mockResolvedValue({ id: 'source-1' });
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      schedule: null,
      isActive: true,
    });

    await service.create({
      name: 'Job',
      type: 'phishing_database',
      sourceId: 'source-1',
    });

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a missing job', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('run() pre-creates an execution and enqueues the job', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1' });
    jobExecutionsService.create.mockResolvedValue({
      id: 'exec-1',
      jobId: 'job-1',
    });

    const result = await service.run('job-1');

    expect(jobExecutionsService.create).toHaveBeenCalledWith('job-1', 'manual');
    expect(queue.add).toHaveBeenCalledWith('run-job', {
      jobId: 'job-1',
      triggeredBy: 'manual',
      executionId: 'exec-1',
    });
    expect(result).toEqual({ id: 'exec-1', jobId: 'job-1' });
  });
});
