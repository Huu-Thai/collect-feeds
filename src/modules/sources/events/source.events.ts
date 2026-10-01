import { BaseEvent } from '../../../common/events/base.event';

export const SOURCE_EVENTS = {
  CREATED: 'source.created',
  UPDATED: 'source.updated',
  DELETED: 'source.deleted',
} as const;

export class SourceCreatedEvent extends BaseEvent {
  constructor(public readonly sourceId: string) {
    super();
  }
}

export class SourceUpdatedEvent extends BaseEvent {
  constructor(public readonly sourceId: string) {
    super();
  }
}

export class SourceDeletedEvent extends BaseEvent {
  constructor(public readonly sourceId: string) {
    super();
  }
}
