import { BaseEvent } from '@common/events/base.event';

export const PASSWORD_RESET_EVENTS = {
  REQUESTED: 'password_reset.requested',
  COMPLETED: 'password_reset.completed',
} as const;

export class PasswordResetRequestedEvent extends BaseEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly resetLink: string,
  ) {
    super();
  }
}

export class PasswordResetCompletedEvent extends BaseEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    super();
  }
}
