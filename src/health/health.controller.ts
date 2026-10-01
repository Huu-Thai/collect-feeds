import { Controller, Get, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () =>
        this.healthIndicatorService
          .check('database')
          .attempt(() => this.prisma.$queryRaw`SELECT 1`),
      () =>
        this.healthIndicatorService.check('redis').attempt(async () => {
          await this.redis.ping();
        }),
    ]);
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
