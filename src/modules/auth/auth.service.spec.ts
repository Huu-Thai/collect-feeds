import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@database/prisma.service';
import { AuthService } from './auth.service';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('new-hashed-password'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmailWithPassword: jest.Mock;
    recordLogin: jest.Mock;
    recordFailedLogin: jest.Mock;
    create: jest.Mock;
  };
  let rolesService: { findByKey: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmailWithPassword: jest.fn(),
      recordLogin: jest.fn(),
      recordFailedLogin: jest.fn(),
      create: jest.fn(),
    };
    rolesService = { findByKey: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    prisma = {
      passwordResetToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: { update: jest.fn() },
      runInTransaction: jest.fn((work: any) => work(prisma)),
    };
    eventEmitter = { emit: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('http://localhost:3000') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: RolesService, useValue: rolesService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('returns an access token for valid credentials', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('user@example.com', 'password123');

      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(usersService.recordLogin).toHaveBeenCalledWith('user-1');
    });

    it('rejects an unknown email', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      await expect(
        service.login('missing@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an inactive user', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        passwordHash: 'hashed',
      });
      await expect(
        service.login('user@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('records a failed attempt and rejects on a wrong password', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('user@example.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.recordFailedLogin).toHaveBeenCalledWith('user-1');
    });
  });

  describe('register', () => {
    it('creates a user under the default role and returns an access token', async () => {
      rolesService.findByKey.mockResolvedValue({
        id: 'role-viewer',
        key: 'viewer',
      });
      usersService.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
      });

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(rolesService.findByKey).toHaveBeenCalledWith('viewer');
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          roleId: 'role-viewer',
        }),
      );
      expect(result).toEqual({
        user: { id: 'user-1', email: 'new@example.com' },
        accessToken: 'signed-token',
      });
    });
  });

  describe('forgotPassword', () => {
    it('creates a reset token and emits password_reset.requested for a known active user', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        isActive: true,
      });

      await service.forgotPassword('user@example.com');

      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'password_reset.requested',
        expect.objectContaining({
          userId: 'user-1',
          email: 'user@example.com',
        }),
      );
    });

    it('does nothing for an unknown email (no account enumeration)', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await service.forgotPassword('missing@example.com');

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid or expired token', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword('bad-token', 'newpassword1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates the password, marks the token used, and emits password_reset.completed', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        user: { email: 'user@example.com' },
      });

      await service.resetPassword('good-token', 'newpassword1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'token-1' } }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'password_reset.completed',
        expect.objectContaining({
          userId: 'user-1',
          email: 'user@example.com',
        }),
      );
    });
  });
});
