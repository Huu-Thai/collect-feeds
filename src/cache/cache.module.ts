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
          createKeyv({
            socket: {
              host: configService.get<string>('redis.host'),
              port: configService.get<number>('redis.port'),
            },
            password: configService.get<string>('redis.password'),
            // Separate logical DB from BullMQ's (db 0), so cache flushes never touch queue state.
            database: 1,
          }),
        ],
        ttl: 60_000,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class CacheModule {}
