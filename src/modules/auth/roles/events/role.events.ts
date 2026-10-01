import { BaseEvent } from '@common/events/base.event';

export const ROLE_EVENTS = {
  CREATED: 'role.created',
  UPDATED: 'role.updated',
  DELETED: 'role.deleted',
  ASSIGNED: 'role.assigned',
} as const;

export class RoleCreatedEvent extends BaseEvent {
  constructor(public readonly roleId: string) {
    super();
  }
}

export class RoleUpdatedEvent extends BaseEvent {
  constructor(public readonly roleId: string) {
    super();
  }
}

export class RoleDeletedEvent extends BaseEvent {
  constructor(public readonly roleId: string) {
    super();
  }
}

export class RoleAssignedEvent extends BaseEvent {
  constructor(
    public readonly roleId: string,
    public readonly userId: string,
  ) {
    super();
  }
}
