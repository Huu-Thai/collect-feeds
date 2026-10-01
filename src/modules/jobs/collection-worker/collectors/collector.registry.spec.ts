import { CollectorRegistry } from './collector.registry';
import { PhishingDatabaseCollector } from './phishing-database.collector';

describe('CollectorRegistry', () => {
  it('resolves a collector by source type', () => {
    const collector = new PhishingDatabaseCollector({} as any);
    const registry = new CollectorRegistry(collector);

    expect(registry.resolve('phishing_database')).toBe(collector);
  });

  it('throws when no collector supports the given source type', () => {
    const collector = new PhishingDatabaseCollector({} as any);
    const registry = new CollectorRegistry(collector);

    expect(() => registry.resolve('unknown')).toThrow(
      'No collector registered for source type "unknown"',
    );
  });
});
