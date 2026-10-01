import type { SourceModel } from '../../../../database/generated/prisma/models';
import type { RawIndicator } from '../../../feeds/feeds.service';

export interface Collector {
  supports(sourceType: string): boolean;
  fetch(source: SourceModel): Promise<RawIndicator[]>;
}
