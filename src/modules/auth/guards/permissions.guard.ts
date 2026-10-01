import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { API_PREFIX } from '@common/constants/api.constants';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Global guard: matches the incoming method+path against the caller's role
 * permissions (`permissions` table), not per-route decorators — the DB is
 * the single source of truth for who can call what.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return false;
    }

    const permissions = await this.permissionsService.findByRoleId(user.roleId);
    const requestPath = this.stripPrefix(request.path);
    const requiredKey = ['GET', 'HEAD'].includes(request.method)
      ? 'read'
      : 'write';

    const allowed = permissions.some((permission) => {
      const keyOk = permission.key === '*' || permission.key === requiredKey;
      const methodOk =
        permission.method === '*' || permission.method === request.method;
      const pathOk = this.matchesPath(permission.path, requestPath);
      return keyOk && methodOk && pathOk;
    });

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }

  private stripPrefix(path: string): string {
    const prefix = `/${API_PREFIX}`;
    if (path.startsWith(prefix)) {
      return path.slice(prefix.length) || '/';
    }
    return path;
  }

  private matchesPath(pattern: string, path: string): boolean {
    if (pattern === '*') {
      return true;
    }
    if (pattern.endsWith('/*')) {
      const prefixPath = pattern.slice(0, -2);
      return path === prefixPath || path.startsWith(`${prefixPath}/`);
    }
    return pattern === path;
  }
}
