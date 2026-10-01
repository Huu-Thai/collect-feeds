import { BaseEvent } from '@common/events/base.event';

export const JOB_EVENTS = {
  CREATED: 'job.created',
  UPDATED: 'job.updated',
  DELETED: 'job.deleted',
} as const;

export const JOB_EXECUTION_EVENTS = {
  STARTED: 'job_execution.started',
  COMPLETED: 'job_execution.completed',
  FAILED: 'job_execution.failed',
} as const;

export class JobCreatedEvent extends BaseEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}

export class JobUpdatedEvent extends BaseEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}

export class JobDeletedEvent extends BaseEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}

export class JobExecutionStartedEvent extends BaseEvent {
  constructor(
    public readonly executionId: string,
    public readonly jobId: string,
  ) {
    super();
  }
}

export class JobExecutionCompletedEvent extends BaseEvent {
  constructor(
    public readonly executionId: string,
    public readonly jobId: string,
  ) {
    super();
  }
}

export class JobExecutionFailedEvent extends BaseEvent {
  constructor(
    public readonly executionId: string,
    public readonly jobId: string,
    public readonly errorMessage: string,
  ) {
    super();
  }
}
