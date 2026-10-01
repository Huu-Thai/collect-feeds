import { BaseEvent } from '@common/events/base.event';

export const PERMISSION_EVENTS = {
  CREATED: 'permission.created',
  UPDATED: 'permission.updated',
  DELETED: 'permission.deleted',
  ASSIGNED: 'permission.assigned',
} as const;

export class PermissionCreatedEvent extends BaseEvent {
  constructor(
    public readonly permissionId: string,
    public readonly roleId: string,
  ) {
    super();
  }
}

export class PermissionUpdatedEvent extends BaseEvent {
  constructor(
    public readonly permissionId: string,
    public readonly roleId: string,
  ) {
    super();
  }
}

export class PermissionDeletedEvent extends BaseEvent {
  constructor(
    public readonly permissionId: string,
    public readonly roleId: string,
  ) {
    super();
  }
}

/** Fired once for a bulk `assignToRole` replace — not tied to a single permission id. */
export class PermissionsAssignedEvent extends BaseEvent {
  constructor(public readonly roleId: string) {
    super();
  }
}
