import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@database/prisma.service';
import {
  DEFAULT_REGISTRATION_ROLE_KEY,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  PASSWORD_RESET_EVENTS,
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
} from './events/password-reset.events';
import { RolesService } from './roles/roles.service';
import { SALT_ROUNDS, UsersService } from './users/users.service';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.usersService.recordFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.recordLogin(user.id);
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { accessToken };
  }

  /** Public self-registration — always lands in the default (lowest-privilege) role. */
  async register(dto: RegisterDto) {
    const role = await this.rolesService.findByKey(
      DEFAULT_REGISTRATION_ROLE_KEY,
    );
    const user = await this.usersService.create({ ...dto, roleId: role.id });
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { user, accessToken };
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.usersService.update(userId, dto);
  }

  /** Always responds the same way regardless of whether the email exists, to avoid account enumeration. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !user.isActive) {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.prisma.runInTransaction((tx) =>
      tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    );

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    this.eventEmitter.emit(
      PASSWORD_RESET_EVENTS.REQUESTED,
      new PasswordResetRequestedEvent(user.id, user.email, resetLink),
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.runInTransaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
    });

    this.eventEmitter.emit(
      PASSWORD_RESET_EVENTS.COMPLETED,
      new PasswordResetCompletedEvent(resetToken.userId, resetToken.user.email),
    );
  }
}
