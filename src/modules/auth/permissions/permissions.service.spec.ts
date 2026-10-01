import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@database/prisma.service';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    prisma = {
      role: { findUnique: jest.fn() },
      permission: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(PermissionsService);
  });

  it('creates a permission and emits permission.created', async () => {
    prisma.permission.create.mockResolvedValue({
      id: 'perm-1',
      roleId: 'role-1',
    });

    const result = await service.create({
      key: 'read',
      method: 'GET',
      path: '/feeds/*',
      roleId: 'role-1',
    });

    expect(result.id).toBe('perm-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'permission.created',
      expect.objectContaining({ permissionId: 'perm-1', roleId: 'role-1' }),
    );
  });

  it('rejects assigning permissions to an unknown role', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(
      service.assignToRole({ roleId: 'missing', permissions: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it("replaces a role's permission set and emits permission.assigned", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    const items = [
      { key: 'read' as const, method: 'GET' as const, path: '/feeds/*' },
    ];
    prisma.permission.findMany.mockResolvedValue([
      { id: 'perm-1', roleId: 'role-1', ...items[0] },
    ]);

    const result = await service.assignToRole({
      roleId: 'role-1',
      permissions: items,
    });

    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'role-1' },
    });
    expect(prisma.permission.createMany).toHaveBeenCalledWith({
      data: [{ ...items[0], roleId: 'role-1' }],
    });
    expect(result).toHaveLength(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'permission.assigned',
      expect.objectContaining({ roleId: 'role-1' }),
    );
  });

  it('caches findByRoleId lookups and invalidates them on permission.assigned', async () => {
    cache.get.mockResolvedValue(undefined);
    prisma.permission.findMany.mockResolvedValue([]);

    await service.findByRoleId('role-1');
    expect(cache.set).toHaveBeenCalledWith(
      'permissions:role:role-1',
      [],
      expect.any(Number),
    );

    await service.invalidateRoleCache({ roleId: 'role-1' } as any);
    expect(cache.del).toHaveBeenCalledWith('permissions:role:role-1');
  });
});
