import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/prisma/client';

export type PrismaTransaction = Prisma.TransactionClient;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.get<string>('database.url'),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs `work` inside a single DB transaction. Callers should collect any
   * domain events to emit during `work` and dispatch them only after this
   * promise resolves, never from inside `work` itself.
   */
  runInTransaction<T>(work: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.$transaction((tx) => work(tx));
  }
}
