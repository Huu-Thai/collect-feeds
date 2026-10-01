import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from './users/users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmailWithPassword: jest.Mock;
    recordLogin: jest.Mock;
    recordFailedLogin: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmailWithPassword: jest.fn(),
      recordLogin: jest.fn(),
      recordFailedLogin: jest.fn(),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

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
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1' });
  });

  it('rejects an unknown email', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    await expect(service.login('missing@example.com', 'password123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'user-1',
      isActive: false,
      passwordHash: 'hashed',
    });
    await expect(service.login('user@example.com', 'password123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('records a failed attempt and rejects on a wrong password', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login('user@example.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    expect(usersService.recordFailedLogin).toHaveBeenCalledWith('user-1');
  });
});
