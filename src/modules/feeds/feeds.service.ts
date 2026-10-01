import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CACHE_KEYS, CACHE_TTL } from '../../cache/cache.constants';
import type { FeedModel } from '../../database/generated/prisma/models';
import { FeedType, type Prisma } from '../../database/generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { FindFeedsQueryDto } from './dto/find-feeds-query.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import {
  FEED_EVENTS,
  FeedCreatedEvent,
  FeedDeletedEvent,
  FeedUpdatedEvent,
} from './events/feed.events';

export interface RawIndicator {
  value: string;
  type: FeedType;
  isActive: boolean;
}

@Injectable()
export class FeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreateFeedDto) {
    const feed = await this.prisma.runInTransaction((tx) =>
      tx.feed.create({
        data: {
          value: dto.value,
          type: dto.type,
          confidence: dto.confidence,
          severity: dto.severity,
          tags: dto.tags ?? [],
          isActive: dto.isActive ?? true,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          sourceId: dto.sourceId,
        },
      }),
    );
    this.eventEmitter.emit(
      FEED_EVENTS.CREATED,
      new FeedCreatedEvent(feed.id, feed.value, feed.type),
    );
    return feed;
  }

  async findAll(query: FindFeedsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.FeedWhereInput = {
      deletedAt: null,
      type: query.type,
      isActive: query.isActive,
      value: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.feed.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.feed.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const feed = await this.prisma.feed.findFirst({
      where: { id, deletedAt: null },
    });
    if (!feed) {
      throw new NotFoundException(`Feed ${id} not found`);
    }
    return feed;
  }

  async findByValue(value: string, type: FeedType) {
    const cacheKey = CACHE_KEYS.feedByValue(value, type);
    const cached = await this.cache.get<FeedModel>(cacheKey);
    if (cached) {
      return cached;
    }
    const feed = await this.prisma.feed.findFirst({
      where: { value, type, deletedAt: null },
    });
    if (feed) {
      await this.cache.set(cacheKey, feed, CACHE_TTL.FEED_LOOKUP);
    }
    return feed;
  }

  async update(id: string, dto: UpdateFeedDto) {
    await this.findOne(id);
    const feed = await this.prisma.runInTransaction((tx) =>
      tx.feed.update({
        where: { id },
        data: {
          value: dto.value,
          type: dto.type,
          confidence: dto.confidence,
          severity: dto.severity,
          tags: dto.tags,
          isActive: dto.isActive,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          sourceId: dto.sourceId,
        },
      }),
    );
    this.eventEmitter.emit(
      FEED_EVENTS.UPDATED,
      new FeedUpdatedEvent(feed.id, feed.value, feed.type),
    );
    return feed;
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    await this.prisma.runInTransaction((tx) =>
      tx.feed.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    );
    this.eventEmitter.emit(
      FEED_EVENTS.DELETED,
      new FeedDeletedEvent(existing.id, existing.value, existing.type),
    );
  }

  /**
   * Upserts one ingested indicator. Used by the collection worker — not
   * routed through HTTP, so no DTO validation, but the same transaction +
   * after-commit-event pattern applies.
   */
  async upsertFromSource(
    indicator: RawIndicator,
    sourceId: string,
  ): Promise<{ feed: FeedModel; wasCreated: boolean }> {
    const existing = await this.prisma.feed.findUnique({
      where: { value_type: { value: indicator.value, type: indicator.type } },
    });

    const feed = await this.prisma.runInTransaction((tx) =>
      tx.feed.upsert({
        where: { value_type: { value: indicator.value, type: indicator.type } },
        create: {
          value: indicator.value,
          type: indicator.type,
          isActive: indicator.isActive,
          sourceId,
        },
        update: {
          isActive: indicator.isActive,
          sourceId,
          deletedAt: null,
        },
      }),
    );

    this.eventEmitter.emit(
      existing ? FEED_EVENTS.UPDATED : FEED_EVENTS.CREATED,
      existing
        ? new FeedUpdatedEvent(feed.id, feed.value, feed.type)
        : new FeedCreatedEvent(feed.id, feed.value, feed.type),
    );

    return { feed, wasCreated: !existing };
  }

  @OnEvent([FEED_EVENTS.UPDATED, FEED_EVENTS.DELETED])
  async invalidateFeedCache(event: FeedUpdatedEvent | FeedDeletedEvent) {
    await this.cache.del(CACHE_KEYS.feedByValue(event.value, event.type));
  }
}
