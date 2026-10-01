import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { SourcesService } from './sources.service';

describe('SourcesService', () => {
  let service: SourcesService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      source: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(SourcesService);
  });

  it('creates a source and emits source.created', async () => {
    prisma.source.create.mockResolvedValue({ id: 'source-1', name: 'X', type: 'phishing_database' });

    const result = await service.create({
      name: 'X',
      type: 'phishing_database',
      params: { url: 'https://example.com/list.txt' },
    });

    expect(result.id).toBe('source-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'source.created',
      expect.objectContaining({ sourceId: 'source-1' }),
    );
  });

  it('throws NotFoundException for a missing source', async () => {
    prisma.source.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('removes a source and emits source.deleted', async () => {
    prisma.source.findUnique.mockResolvedValue({ id: 'source-1' });

    await service.remove('source-1');

    expect(prisma.source.delete).toHaveBeenCalledWith({ where: { id: 'source-1' } });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'source.deleted',
      expect.objectContaining({ sourceId: 'source-1' }),
    );
  });
});
