import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let sendMail: jest.Mock;

  beforeEach(async () => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const configValues: Record<string, unknown> = {
      'mail.from': 'Threat Feed <no-reply@threat-feed.local>',
      'mail.host': 'localhost',
      'mail.port': 1025,
      'mail.secure': false,
      'mail.user': undefined,
      'mail.password': undefined,
    };
    const configService = { get: jest.fn((key: string) => configValues[key]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  afterEach(() => jest.clearAllMocks());

  it('sends a welcome email on user.created', async () => {
    await service.onUserCreated({
      userId: 'u1',
      email: 'new@example.com',
      firstname: 'Ann',
    } as any);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: 'Welcome to Threat Feed',
      }),
    );
  });

  it('sends a reset-link email on password_reset.requested', async () => {
    await service.onPasswordResetRequested({
      userId: 'u1',
      email: 'user@example.com',
      resetLink: 'http://localhost:3000/reset-password?token=abc',
    } as any);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your password',
      }),
    );
    expect(sendMail.mock.calls[0][0].html).toContain('abc');
  });

  it('does not throw when the SMTP transport fails', async () => {
    sendMail.mockRejectedValue(new Error('connection refused'));

    await expect(
      service.onUserUpdated({ userId: 'u1', email: 'user@example.com' } as any),
    ).resolves.toBeUndefined();
  });
});
