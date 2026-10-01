import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CACHE_KEYS, CACHE_TTL } from '@cache/cache.constants';
import type { PermissionModel } from '@database/generated/prisma/models';
import { PrismaService } from '@database/prisma.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import {
  PERMISSION_EVENTS,
  PermissionCreatedEvent,
  PermissionDeletedEvent,
  PermissionsAssignedEvent,
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

  /** Replaces the role's entire permission set in one transaction. */
  async assignToRole(dto: AssignPermissionsDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new NotFoundException(`Role ${dto.roleId} not found`);
    }

    const permissions = await this.prisma.runInTransaction(async (tx) => {
      await tx.permission.deleteMany({ where: { roleId: dto.roleId } });
      if (dto.permissions.length > 0) {
        await tx.permission.createMany({
          data: dto.permissions.map((item) => ({
            ...item,
            roleId: dto.roleId,
          })),
        });
      }
      return tx.permission.findMany({ where: { roleId: dto.roleId } });
    });

    this.eventEmitter.emit(
      PERMISSION_EVENTS.ASSIGNED,
      new PermissionsAssignedEvent(dto.roleId),
    );
    return permissions;
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
    PERMISSION_EVENTS.ASSIGNED,
  ])
  async invalidateRoleCache(
    event:
      | PermissionCreatedEvent
      | PermissionUpdatedEvent
      | PermissionDeletedEvent
      | PermissionsAssignedEvent,
  ) {
    await this.cache.del(CACHE_KEYS.permissionsByRole(event.roleId));
  }
}
