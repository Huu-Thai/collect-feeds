import { BaseEvent } from '../../../common/events/base.event';
import { FeedType } from '../../../database/generated/prisma/enums';

export const FEED_EVENTS = {
  CREATED: 'feed.created',
  UPDATED: 'feed.updated',
  DELETED: 'feed.deleted',
} as const;

export class FeedCreatedEvent extends BaseEvent {
  constructor(
    public readonly feedId: string,
    public readonly value: string,
    public readonly type: FeedType,
  ) {
    super();
  }
}

export class FeedUpdatedEvent extends BaseEvent {
  constructor(
    public readonly feedId: string,
    public readonly value: string,
    public readonly type: FeedType,
  ) {
    super();
  }
}

export class FeedDeletedEvent extends BaseEvent {
  constructor(
    public readonly feedId: string,
    public readonly value: string,
    public readonly type: FeedType,
  ) {
    super();
  }
}
