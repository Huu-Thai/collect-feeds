import { BaseEvent } from '@common/events/base.event';

export const USER_EVENTS = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
} as const;

export class UserCreatedEvent extends BaseEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstname?: string,
  ) {
    super();
  }
}

export class UserUpdatedEvent extends BaseEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstname?: string,
  ) {
    super();
  }
}

export class UserDeletedEvent extends BaseEvent {
  constructor(public readonly userId: string) {
    super();
  }
}
