import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { FeedType } from '../../../../database/generated/prisma/enums';
import { PhishingDatabaseCollector } from './phishing-database.collector';

describe('PhishingDatabaseCollector', () => {
  it('parses newline-delimited indicators, trimming blank lines, for an ACTIVE source', async () => {
    const httpService = {
      get: jest.fn().mockReturnValue(of({ data: '1.2.3.4\n5.6.7.8\n\n  \n9.9.9.9\n' })),
    } as unknown as HttpService;
    const collector = new PhishingDatabaseCollector(httpService);

    const result = await collector.fetch({
      name: 'Phishing.Database - IPs Active',
      params: {
        url: 'https://example.com/phishing-IPs-ACTIVE.txt',
        indicatorType: FeedType.IPV4,
        status: 'ACTIVE',
      },
    } as any);

    expect(result).toEqual([
      { value: '1.2.3.4', type: FeedType.IPV4, isActive: true },
      { value: '5.6.7.8', type: FeedType.IPV4, isActive: true },
      { value: '9.9.9.9', type: FeedType.IPV4, isActive: true },
    ]);
  });

  it('marks indicators inactive for an INACTIVE source', async () => {
    const httpService = {
      get: jest.fn().mockReturnValue(of({ data: 'bad-domain.com' })),
    } as unknown as HttpService;
    const collector = new PhishingDatabaseCollector(httpService);

    const result = await collector.fetch({
      name: 'Phishing.Database - Domains Inactive',
      params: {
        url: 'https://example.com/phishing-domains-INACTIVE.txt',
        indicatorType: FeedType.DOMAIN,
        status: 'INACTIVE',
      },
    } as any);

    expect(result).toEqual([{ value: 'bad-domain.com', type: FeedType.DOMAIN, isActive: false }]);
  });

  it('only supports the phishing_database source type', () => {
    const collector = new PhishingDatabaseCollector({} as HttpService);
    expect(collector.supports('phishing_database')).toBe(true);
    expect(collector.supports('other')).toBe(false);
  });
});
