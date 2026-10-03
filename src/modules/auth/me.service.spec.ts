import { MeService } from './me.service';
import { PermissionsService } from './permissions/permissions.service';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';

describe('MeService', () => {
  it("returns the caller's profile, role and role permissions (no secrets)", async () => {
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'u1',
        email: 'ana@example.com',
        firstname: 'Ana',
        lastname: null,
        roleId: 'r1',
        passwordHash: 'never-returned',
      }),
    };
    const roles = {
      findOne: jest.fn().mockResolvedValue({
        id: 'r1',
        key: 'analyst',
        name: 'Analyst',
        createdAt: new Date(),
      }),
    };
    const permissions = {
      findByRoleId: jest.fn().mockResolvedValue([
        { id: 'p1', key: 'read', method: 'GET', path: '/feeds', roleId: 'r1' },
        {
          id: 'p2',
          key: 'write',
          method: 'POST',
          path: '/feeds',
          roleId: 'r1',
        },
      ]),
    };
    const svc = new MeService(
      users as unknown as UsersService,
      roles as unknown as RolesService,
      permissions as unknown as PermissionsService,
    );
    const me = await svc.me('u1');
    expect(me).toEqual({
      id: 'u1',
      email: 'ana@example.com',
      firstname: 'Ana',
      lastname: null,
      role: { id: 'r1', key: 'analyst', name: 'Analyst' },
      permissions: [
        { key: 'read', method: 'GET', path: '/feeds' },
        { key: 'write', method: 'POST', path: '/feeds' },
      ],
    });
    expect(JSON.stringify(me)).not.toContain('never-returned');
    expect(permissions.findByRoleId).toHaveBeenCalledWith('r1');
  });
});
