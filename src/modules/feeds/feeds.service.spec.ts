import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { FeedType } from '../../database/generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { FeedsService } from './feeds.service';

describe('FeedsService', () => {
  let service: FeedsService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    prisma = {
      feed: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(FeedsService);
  });

  it('marks a new indicator as created and emits feed.created', async () => {
    prisma.feed.findUnique.mockResolvedValue(null);
    prisma.feed.upsert.mockResolvedValue({ id: 'feed-1', value: '1.2.3.4', type: FeedType.IPV4 });

    const { wasCreated } = await service.upsertFromSource(
      { value: '1.2.3.4', type: FeedType.IPV4, isActive: true },
      'source-1',
    );

    expect(wasCreated).toBe(true);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'feed.created',
      expect.objectContaining({ feedId: 'feed-1' }),
    );
  });

  it('marks an existing indicator as updated and emits feed.updated', async () => {
    prisma.feed.findUnique.mockResolvedValue({ id: 'feed-1' });
    prisma.feed.upsert.mockResolvedValue({ id: 'feed-1', value: '1.2.3.4', type: FeedType.IPV4 });

    const { wasCreated } = await service.upsertFromSource(
      { value: '1.2.3.4', type: FeedType.IPV4, isActive: false },
      'source-1',
    );

    expect(wasCreated).toBe(false);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'feed.updated',
      expect.objectContaining({ feedId: 'feed-1' }),
    );
  });

  it('returns a cached feed without hitting the database', async () => {
    const cached = { id: 'feed-1', value: '1.2.3.4', type: FeedType.IPV4 };
    cache.get.mockResolvedValue(cached);

    const result = await service.findByValue('1.2.3.4', FeedType.IPV4);

    expect(result).toEqual(cached);
    expect(prisma.feed.findFirst).not.toHaveBeenCalled();
  });

  it('caches a database lookup on a miss', async () => {
    cache.get.mockResolvedValue(undefined);
    const feed = { id: 'feed-1', value: '1.2.3.4', type: FeedType.IPV4 };
    prisma.feed.findFirst.mockResolvedValue(feed);

    const result = await service.findByValue('1.2.3.4', FeedType.IPV4);

    expect(result).toEqual(feed);
    expect(cache.set).toHaveBeenCalledWith('feed:IPV4:1.2.3.4', feed, expect.any(Number));
  });

  it('invalidates the cache entry when a feed is updated or deleted', async () => {
    await service.invalidateFeedCache({
      feedId: 'feed-1',
      value: '1.2.3.4',
      type: FeedType.IPV4,
    } as any);

    expect(cache.del).toHaveBeenCalledWith('feed:IPV4:1.2.3.4');
  });
});
