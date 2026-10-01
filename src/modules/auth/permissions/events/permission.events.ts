import { BaseEvent } from '../../../../common/events/base.event';

export const PERMISSION_EVENTS = {
  CREATED: 'permission.created',
  UPDATED: 'permission.updated',
  DELETED: 'permission.deleted',
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
