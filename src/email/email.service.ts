import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import * as nodemailer from 'nodemailer';
import {
  PASSWORD_RESET_EVENTS,
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
} from '@modules/auth/events/password-reset.events';
import {
  USER_EVENTS,
  UserCreatedEvent,
  UserUpdatedEvent,
} from '@modules/auth/users/events/user.events';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(configService: ConfigService) {
    this.fromAddress = configService.get<string>('mail.from') as string;
    const user = configService.get<string>('mail.user');
    const password = configService.get<string>('mail.password');

    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('mail.host'),
      port: configService.get<number>('mail.port'),
      secure: configService.get<boolean>('mail.secure'),
      auth: user ? { user, pass: password } : undefined,
    });
  }

  /** Best-effort: a failed/unreachable SMTP server should never fail the caller's request. */
  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email "${subject}" to ${to}: ${(error as Error).message}`,
      );
    }
  }

  sendWelcomeEmail(to: string, firstname?: string): Promise<void> {
    return this.send(
      to,
      'Welcome to Threat Feed',
      `<p>Hi ${firstname ?? 'there'},</p><p>Your account (${to}) has been created.</p>`,
    );
  }

  sendAccountUpdatedEmail(to: string, firstname?: string): Promise<void> {
    return this.send(
      to,
      'Your account was updated',
      `<p>Hi ${firstname ?? 'there'},</p><p>Your account details were just updated. If this wasn't you, contact an administrator.</p>`,
    );
  }

  sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    return this.send(
      to,
      'Reset your password',
      `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    );
  }

  sendPasswordResetConfirmationEmail(to: string): Promise<void> {
    return this.send(
      to,
      'Your password was changed',
      `<p>Your password was just changed. If this wasn't you, contact an administrator immediately.</p>`,
    );
  }

  @OnEvent(USER_EVENTS.CREATED)
  onUserCreated(event: UserCreatedEvent) {
    return this.sendWelcomeEmail(event.email, event.firstname);
  }

  @OnEvent(USER_EVENTS.UPDATED)
  onUserUpdated(event: UserUpdatedEvent) {
    return this.sendAccountUpdatedEmail(event.email, event.firstname);
  }

  @OnEvent(PASSWORD_RESET_EVENTS.REQUESTED)
  onPasswordResetRequested(event: PasswordResetRequestedEvent) {
    return this.sendPasswordResetEmail(event.email, event.resetLink);
  }

  @OnEvent(PASSWORD_RESET_EVENTS.COMPLETED)
  onPasswordResetCompleted(event: PasswordResetCompletedEvent) {
    return this.sendPasswordResetConfirmationEmail(event.email);
  }
}
