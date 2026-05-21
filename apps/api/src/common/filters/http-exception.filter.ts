import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      );
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = unique constraint violation, P2025 = record not found
      const map: Record<string, number> = { P2002: HttpStatus.CONFLICT, P2025: HttpStatus.NOT_FOUND };
      const status = map[exception.code] ?? HttpStatus.BAD_REQUEST;
      res.status(status).json({
        statusCode: status,
        message: exception.message.split('\n').pop()?.trim() ?? exception.message,
        code: exception.code,
      });
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}
