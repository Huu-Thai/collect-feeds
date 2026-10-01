import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from '../permissions/permissions.service';

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let permissionsService: { findByRoleId: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    permissionsService = { findByRoleId: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      permissionsService as unknown as PermissionsService,
    );
  });

  it('allows public routes without checking permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(permissionsService.findByRoleId).not.toHaveBeenCalled();
  });

  it('denies the request when there is no authenticated user', async () => {
    const context = createContext({ method: 'GET', path: '/api/v1/feeds' });
    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('allows a wildcard permission for any method and path', async () => {
    permissionsService.findByRoleId.mockResolvedValue([{ key: '*', method: '*', path: '*' }]);
    const context = createContext({
      method: 'DELETE',
      path: '/api/v1/feeds/123',
      user: { roleId: 'role-1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('matches a "/*" suffix as a sub-path prefix', async () => {
    permissionsService.findByRoleId.mockResolvedValue([
      { key: 'read', method: 'GET', path: '/feeds/*' },
    ]);
    const context = createContext({
      method: 'GET',
      path: '/api/v1/feeds/123',
      user: { roleId: 'role-1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws ForbiddenException when no permission matches the request', async () => {
    permissionsService.findByRoleId.mockResolvedValue([
      { key: 'read', method: 'GET', path: '/feeds/*' },
    ]);
    const context = createContext({
      method: 'DELETE',
      path: '/api/v1/feeds/123',
      user: { roleId: 'role-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a read-key permission on a write request even with a matching path', async () => {
    permissionsService.findByRoleId.mockResolvedValue([
      { key: 'read', method: '*', path: '/feeds/*' },
    ]);
    const context = createContext({
      method: 'POST',
      path: '/api/v1/feeds',
      user: { roleId: 'role-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
