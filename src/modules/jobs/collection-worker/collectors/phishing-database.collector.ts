import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { FeedType } from '@database/generated/prisma/enums';
import type { SourceModel } from '@database/generated/prisma/models';
import type { RawIndicator } from '@modules/feeds/feeds.service';
import type { Collector } from './collector.interface';

interface PhishingDatabaseParams {
  url: string;
  indicatorType: FeedType;
  status: 'ACTIVE' | 'INACTIVE' | 'INVALID';
}

/**
 * Fetches one of the Phishing.Database project's raw newline-delimited text
 * lists (https://github.com/Phishing-Database/Phishing.Database). Each list
 * is its own `Source` row so a bad/slow file doesn't block the others.
 */
@Injectable()
export class PhishingDatabaseCollector implements Collector {
  private readonly logger = new Logger(PhishingDatabaseCollector.name);

  constructor(private readonly httpService: HttpService) {}

  supports(sourceType: string): boolean {
    return sourceType === 'phishing_database';
  }

  async fetch(source: SourceModel): Promise<RawIndicator[]> {
    const params = source.params as unknown as PhishingDatabaseParams;
    this.logger.log(`Fetching "${source.name}" from ${params.url}`);

    const response = await firstValueFrom(
      this.httpService.get<string>(params.url, {
        responseType: 'text',
        timeout: 15_000,
      }),
    );

    const isActive = params.status === 'ACTIVE';

    return response.data
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((value) => ({ value, type: params.indicatorType, isActive }));
  }
}
