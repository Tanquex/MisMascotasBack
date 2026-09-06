import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorResponse: any = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    let message = 'An unexpected error occurred';
    let errors: any = null;

    if (typeof errorResponse === 'object' && errorResponse !== null) {
      message = errorResponse.message || message;
      errors = errorResponse.errors || null;
    } else if (typeof errorResponse === 'string') {
      message = errorResponse;
    }

    const clientIp =
      (request.headers['x-forwarded-for'] as string) ||
      request.ip ||
      request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // In production, mask internal server errors to prevent information disclosure
    const isProduction = process.env.NODE_ENV === 'production';
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      const errDetail =
        exception instanceof Error ? exception.stack : JSON.stringify(exception);
      this.logger.error(
        `[${request.method}] ${request.url} - Status ${status} - Error: ${errDetail}`,
      );

      this.auditLogService.logEvent({
        action: 'SYSTEM_ERROR',
        resource: `${request.method} ${request.url}`,
        ipAddress: clientIp,
        userAgent,
        details: `Error 500: ${
          exception instanceof Error ? exception.message : 'Fallo inesperado del servidor'
        }`,
      });

      if (isProduction) {
        message = 'Internal server error. Please try again later.';
        errors = null;
      }
    } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.auditLogService.logEvent({
        action: 'THROTTLE_BLOCKED',
        resource: `${request.method} ${request.url}`,
        ipAddress: clientIp,
        userAgent,
        details: 'Exceso de solicitudes (429 Too Many Requests) mitigado por Throttler.',
      });
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status ${status} - Message: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
