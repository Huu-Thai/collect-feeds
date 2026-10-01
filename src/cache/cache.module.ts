import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => ({
        stores: [
          createKeyv(
            `redis://${configService.get<string>('redis.host')}:${configService.get<number>('redis.port')}/1`,
          ),
        ],
        ttl: 60_000,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class CacheModule {}
