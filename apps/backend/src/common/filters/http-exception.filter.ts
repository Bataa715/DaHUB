import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : "Internal server error";

    // Log error details (but don't expose to client in production)
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    } else if (process.env.NODE_ENV === "development") {
      this.logger.warn(
        `${status} error on ${request.method} ${request.url}: ${message}`,
      );
    }

    // Send safe response to client
    response.status(status).json({
      statusCode: status,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? "Серверийн алдаа гарлаа"
          : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
