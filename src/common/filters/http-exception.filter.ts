import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      isHttpException &&
      typeof exceptionResponse === 'object' &&
      exceptionResponse
        ? ((exceptionResponse as Record<string, unknown>).message ??
          exception.message)
        : isHttpException
          ? exception.message
          : 'Internal server error';

    const error =
      isHttpException &&
      typeof exceptionResponse === 'object' &&
      exceptionResponse
        ? ((exceptionResponse as Record<string, unknown>).error ??
          HttpStatus[statusCode])
        : HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR];

    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
