import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { JobStatus } from '@database/generated/prisma/enums';
import { PrismaService } from '@database/prisma.service';
import { JobExecutionsService } from './job-executions.service';

describe('JobExecutionsService', () => {
  let service: JobExecutionsService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      jobExecution: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      job: { update: jest.fn() },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        JobExecutionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(JobExecutionsService);
  });

  it('throws NotFoundException for a missing execution', async () => {
    prisma.jobExecution.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('markSuccess updates status, records counts, and bumps the job lastRunAt', async () => {
    prisma.jobExecution.update.mockResolvedValue({
      id: 'exec-1',
      jobId: 'job-1',
      status: JobStatus.SUCCESS,
    });

    const counts = {
      recordsProcessed: 10,
      recordsCreated: 4,
      recordsUpdated: 6,
      recordsFailed: 0,
    };
    await service.markSuccess('exec-1', counts);

    expect(prisma.jobExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec-1' },
        data: expect.objectContaining({ status: JobStatus.SUCCESS, ...counts }),
      }),
    );
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1' } }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'job_execution.completed',
      expect.objectContaining({ executionId: 'exec-1', jobId: 'job-1' }),
    );
  });

  it('markFailed updates status with the error message and emits job_execution.failed', async () => {
    prisma.jobExecution.update.mockResolvedValue({
      id: 'exec-1',
      jobId: 'job-1',
      status: JobStatus.FAILED,
    });

    const counts = {
      recordsProcessed: 2,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 2,
    };
    await service.markFailed('exec-1', counts, 'boom');

    expect(prisma.jobExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: JobStatus.FAILED,
          errorMessage: 'boom',
          ...counts,
        }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'job_execution.failed',
      expect.objectContaining({ executionId: 'exec-1', errorMessage: 'boom' }),
    );
  });
});
