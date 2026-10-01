import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@database/prisma.service';
import { UsersService } from '@modules/auth/users/users.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  ROLE_EVENTS,
  RoleAssignedEvent,
  RoleCreatedEvent,
  RoleDeletedEvent,
  RoleUpdatedEvent,
} from './events/role.events';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateRoleDto) {
    const role = await this.prisma.runInTransaction((tx) =>
      tx.role.create({ data: dto }),
    );
    this.eventEmitter.emit(ROLE_EVENTS.CREATED, new RoleCreatedEvent(role.id));
    return role;
  }

  findAll() {
    return this.prisma.role.findMany();
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    return role;
  }

  async findByKey(key: string) {
    const role = await this.prisma.role.findUnique({ where: { key } });
    if (!role) {
      throw new NotFoundException(`Role with key "${key}" not found`);
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    const role = await this.prisma.runInTransaction((tx) =>
      tx.role.update({ where: { id }, data: dto }),
    );
    this.eventEmitter.emit(ROLE_EVENTS.UPDATED, new RoleUpdatedEvent(role.id));
    return role;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.runInTransaction((tx) =>
      tx.role.delete({ where: { id } }),
    );
    this.eventEmitter.emit(ROLE_EVENTS.DELETED, new RoleDeletedEvent(id));
  }

  async assignToUser(roleId: string, userId: string) {
    await this.findOne(roleId);
    const user = await this.usersService.update(userId, { roleId });
    this.eventEmitter.emit(
      ROLE_EVENTS.ASSIGNED,
      new RoleAssignedEvent(roleId, userId),
    );
    return user;
  }
}
