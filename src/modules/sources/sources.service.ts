import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@database/prisma.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import {
  SOURCE_EVENTS,
  SourceCreatedEvent,
  SourceDeletedEvent,
  SourceUpdatedEvent,
} from './events/source.events';

@Injectable()
export class SourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateSourceDto) {
    const source = await this.prisma.runInTransaction((tx) =>
      tx.source.create({
        data: {
          name: dto.name,
          type: dto.type,
          params: dto.params,
          isActive: dto.isActive ?? true,
        },
      }),
    );
    this.eventEmitter.emit(
      SOURCE_EVENTS.CREATED,
      new SourceCreatedEvent(source.id),
    );
    return source;
  }

  findAll() {
    return this.prisma.source.findMany();
  }

  async findOne(id: string) {
    const source = await this.prisma.source.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException(`Source ${id} not found`);
    }
    return source;
  }

  async update(id: string, dto: UpdateSourceDto) {
    await this.findOne(id);
    const source = await this.prisma.runInTransaction((tx) =>
      tx.source.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          params: dto.params,
          isActive: dto.isActive,
        },
      }),
    );
    this.eventEmitter.emit(
      SOURCE_EVENTS.UPDATED,
      new SourceUpdatedEvent(source.id),
    );
    return source;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.runInTransaction((tx) =>
      tx.source.delete({ where: { id } }),
    );
    this.eventEmitter.emit(SOURCE_EVENTS.DELETED, new SourceDeletedEvent(id));
  }
}
