import { Injectable } from '@nestjs/common';
import type { Collector } from './collector.interface';
import { PhishingDatabaseCollector } from './phishing-database.collector';

/**
 * Resolves a `Collector` by `source.type`. Adding a new provider means
 * writing one more `Collector` and listing it here — the worker itself
 * never changes.
 */
@Injectable()
export class CollectorRegistry {
  private readonly collectors: Collector[];

  constructor(phishingDatabaseCollector: PhishingDatabaseCollector) {
    this.collectors = [phishingDatabaseCollector];
  }

  resolve(sourceType: string): Collector {
    const collector = this.collectors.find((candidate) =>
      candidate.supports(sourceType),
    );
    if (!collector) {
      throw new Error(
        `No collector registered for source type "${sourceType}"`,
      );
    }
    return collector;
  }
}
