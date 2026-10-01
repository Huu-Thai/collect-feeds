export interface CollectionJobData {
  jobId: string;
  triggeredBy: 'manual' | 'scheduled';
  /** Set only for manual runs, where the execution row is pre-created. */
  executionId?: string;
}

export const COLLECTION_QUEUE = 'collection';
export const RUN_JOB_NAME = 'run-job';
