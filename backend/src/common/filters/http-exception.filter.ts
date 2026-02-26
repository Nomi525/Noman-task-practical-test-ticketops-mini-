import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        message = exceptionResponse.message || message;
        details = Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message
          : [];
      }

      switch (status) {
        case 400:
          code = 'VALIDATION_ERROR';
          break;
        case 401:
          code = 'UNAUTHORIZED';
          break;
        case 403:
          code = 'FORBIDDEN';
          break;
        case 404:
          code = 'NOT_FOUND';
          break;
        case 409:
          code = 'CONFLICT';
          break;
        default:
          code = 'HTTP_ERROR';
      }
    }

    response.status(status).json({
      success: false,
      error: { code, message, details },
    });
  }
}
