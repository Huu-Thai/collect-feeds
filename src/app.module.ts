import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { CacheModule } from '@cache/cache.module';
import configuration from '@config/configuration';
import { validationSchema } from '@config/validation.schema';
import { PrismaModule } from '@database/prisma.module';
import { EmailModule } from '@email/email.module';
import { HealthModule } from '@health/health.module';
import { AuthModule } from '@modules/auth/auth.module';
import { FeedsModule } from '@modules/feeds/feeds.module';
import { JobsModule } from '@modules/jobs/jobs.module';
import { SourcesModule } from '@modules/sources/sources.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level:
            configService.get<string>('env') === 'production'
              ? 'info'
              : 'debug',
          transport:
            configService.get<string>('env') === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
        },
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    CacheModule,
    HealthModule,
    EmailModule,
    AuthModule,
    SourcesModule,
    FeedsModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
