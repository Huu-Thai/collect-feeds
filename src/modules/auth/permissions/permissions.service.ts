import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CACHE_KEYS, CACHE_TTL } from '../../../cache/cache.constants';
import type { PermissionModel } from '../../../database/generated/prisma/models';
import { PrismaService } from '../../../database/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import {
  PERMISSION_EVENTS,
  PermissionCreatedEvent,
  PermissionDeletedEvent,
  PermissionUpdatedEvent,
} from './events/permission.events';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(dto: CreatePermissionDto) {
    const permission = await this.prisma.runInTransaction((tx) =>
      tx.permission.create({ data: dto }),
    );
    this.eventEmitter.emit(
      PERMISSION_EVENTS.CREATED,
      new PermissionCreatedEvent(permission.id, permission.roleId),
    );
    return permission;
  }

  findAll() {
    return this.prisma.permission.findMany();
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException(`Permission ${id} not found`);
    }
    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const existing = await this.findOne(id);
    const permission = await this.prisma.runInTransaction((tx) =>
      tx.permission.update({ where: { id }, data: dto }),
    );
    this.eventEmitter.emit(
      PERMISSION_EVENTS.UPDATED,
      new PermissionUpdatedEvent(permission.id, existing.roleId),
    );
    if (permission.roleId !== existing.roleId) {
      this.eventEmitter.emit(
        PERMISSION_EVENTS.UPDATED,
        new PermissionUpdatedEvent(permission.id, permission.roleId),
      );
    }
    return permission;
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    await this.prisma.runInTransaction((tx) =>
      tx.permission.delete({ where: { id } }),
    );
    this.eventEmitter.emit(
      PERMISSION_EVENTS.DELETED,
      new PermissionDeletedEvent(id, existing.roleId),
    );
  }

  /** Used by PermissionsGuard on every request; cached to avoid a DB hit per call. */
  async findByRoleId(roleId: string) {
    const cacheKey = CACHE_KEYS.permissionsByRole(roleId);
    const cached = await this.cache.get<PermissionModel[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const permissions = await this.prisma.permission.findMany({
      where: { roleId },
    });
    await this.cache.set(cacheKey, permissions, CACHE_TTL.PERMISSION_LOOKUP);
    return permissions;
  }

  @OnEvent([
    PERMISSION_EVENTS.CREATED,
    PERMISSION_EVENTS.UPDATED,
    PERMISSION_EVENTS.DELETED,
  ])
  async invalidateRoleCache(
    event:
      PermissionCreatedEvent | PermissionUpdatedEvent | PermissionDeletedEvent,
  ) {
    await this.cache.del(CACHE_KEYS.permissionsByRole(event.roleId));
  }
}
