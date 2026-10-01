import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@database/prisma.service';
import { UsersService } from '@modules/auth/users/users.service';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };
  let usersService: { update: jest.Mock };

  beforeEach(async () => {
    prisma = {
      role: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };
    usersService = { update: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(RolesService);
  });

  it('creates a role and emits role.created', async () => {
    const created = { id: 'role-1', name: 'Admin', key: 'admin' };
    prisma.role.create.mockResolvedValue(created);

    const result = await service.create({ name: 'Admin', key: 'admin' });

    expect(result).toEqual(created);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'role.created',
      expect.objectContaining({ roleId: 'role-1' }),
    );
  });

  it('throws NotFoundException when the role does not exist', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates a role and emits role.updated', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'Admin',
      key: 'admin',
    });
    prisma.role.update.mockResolvedValue({
      id: 'role-1',
      name: 'Superadmin',
      key: 'admin',
    });

    const result = await service.update('role-1', { name: 'Superadmin' });

    expect(result.name).toBe('Superadmin');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'role.updated',
      expect.objectContaining({ roleId: 'role-1' }),
    );
  });

  it('removes a role and emits role.deleted', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'Admin',
      key: 'admin',
    });

    await service.remove('role-1');

    expect(prisma.role.delete).toHaveBeenCalledWith({
      where: { id: 'role-1' },
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'role.deleted',
      expect.objectContaining({ roleId: 'role-1' }),
    );
  });

  it('assigns a role to a user and emits role.assigned', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'Admin',
      key: 'admin',
    });
    usersService.update.mockResolvedValue({ id: 'user-1', roleId: 'role-1' });

    const result = await service.assignToUser('role-1', 'user-1');

    expect(usersService.update).toHaveBeenCalledWith('user-1', {
      roleId: 'role-1',
    });
    expect(result).toEqual({ id: 'user-1', roleId: 'role-1' });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'role.assigned',
      expect.objectContaining({ roleId: 'role-1', userId: 'user-1' }),
    );
  });
});
