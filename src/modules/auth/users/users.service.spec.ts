import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };

  const dto = {
    email: 'new@example.com',
    password: 'password123',
    roleId: 'role-1',
  };

  beforeEach(async () => {
    prisma = {
      role: { findUnique: jest.fn() },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('creates a user, hashes the password, and strips it from the response', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user-1', ...data }),
    );

    const result = await service.create(dto as any);

    expect(result).not.toHaveProperty('passwordHash');
    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe(dto.email);
    expect(createArgs.data.passwordHash).not.toBe(dto.password);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'user.created',
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('rejects creating a user with an unknown role', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects creating a user with a duplicate email', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException for a missing user', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('soft-deletes a user and emits user.deleted', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', email: dto.email });

    await service.remove('user-1');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'user.deleted',
      expect.objectContaining({ userId: 'user-1' }),
    );
  });
});
