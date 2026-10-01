import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import type { UserModel } from '@database/generated/prisma/models';
import { PrismaService } from '@database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  USER_EVENTS,
  UserCreatedEvent,
  UserDeletedEvent,
  UserUpdatedEvent,
} from './events/user.events';

export const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private toSafeUser(user: UserModel) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async create(dto: CreateUserDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new BadRequestException(`Role ${dto.roleId} not found`);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException(`Email ${dto.email} is already in use`);
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.runInTransaction((tx) =>
      tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstname: dto.firstname,
          lastname: dto.lastname,
          roleId: dto.roleId,
        },
      }),
    );
    this.eventEmitter.emit(
      USER_EVENTS.CREATED,
      new UserCreatedEvent(user.id, user.email, user.firstname ?? undefined),
    );
    return this.toSafeUser(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
    });
    return users.map((user) => this.toSafeUser(user));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toSafeUser(user);
  }

  /** Returns the raw record (including passwordHash) — used only by AuthService for login. */
  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException(`Role ${dto.roleId} not found`);
      }
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, SALT_ROUNDS)
      : undefined;

    const user = await this.prisma.runInTransaction((tx) =>
      tx.user.update({
        where: { id },
        data: {
          email: dto.email,
          firstname: dto.firstname,
          lastname: dto.lastname,
          roleId: dto.roleId,
          ...(passwordHash ? { passwordHash } : {}),
        },
      }),
    );
    this.eventEmitter.emit(
      USER_EVENTS.UPDATED,
      new UserUpdatedEvent(user.id, user.email, user.firstname ?? undefined),
    );
    return this.toSafeUser(user);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.runInTransaction((tx) =>
      tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    );
    this.eventEmitter.emit(USER_EVENTS.DELETED, new UserDeletedEvent(id));
  }

  async recordLogin(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });
  }

  async recordFailedLogin(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  }
}
