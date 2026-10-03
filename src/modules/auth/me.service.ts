import { Injectable } from '@nestjs/common';
import { PermissionsService } from './permissions/permissions.service';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';

export interface MeView {
  id: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  role: { id: string; key: string; name: string };
  permissions: { key: string; method: string; path: string }[];
}

/**
 * The caller's own identity, role and permissions in one call — what other services (manage-feed,
 * fuzzer-scanner) need to authorise a user token without a privileged service account.
 */
@Injectable()
export class MeService {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly permissions: PermissionsService,
  ) {}

  async me(userId: string): Promise<MeView> {
    const user = await this.users.findOne(userId);
    const [role, permissions] = await Promise.all([
      this.roles.findOne(user.roleId),
      this.permissions.findByRoleId(user.roleId),
    ]);
    return {
      id: user.id,
      email: user.email,
      firstname: user.firstname ?? null,
      lastname: user.lastname ?? null,
      role: { id: role.id, key: role.key, name: role.name },
      permissions: permissions.map(({ key, method, path }) => ({
        key,
        method,
        path,
      })),
    };
  }
}
