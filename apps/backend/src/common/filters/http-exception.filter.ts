import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { UserFacingBadRequestException } from "../exceptions/user-facing.exception";

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

    // Correlation id — set by the request-id middleware (see main.ts). Included
    // in every log line and echoed to the client so a user-reported error can
    // be traced to its exact server-side log entry.
    const requestId = (request as { requestId?: string }).requestId ?? "-";
    const rid = `[rid:${requestId}]`;

    // Log error details (but don't expose to client in production)
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${rid} Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    } else if (status === HttpStatus.UNAUTHORIZED) {
      // 401 нь cookie-д суурилсан silent-refresh урсгалын хэвийн хэсэг —
      // access token хугацаа дуусахад клиент дахин refresh хийгээд амжилттай
      // дахин оролддог. Лог дэх шуугианыг бүрэн арилгахын тулд verbose-д
      // (default log level-ээс доош) бичнэ.
      this.logger.verbose(
        `${rid} ${status} on ${request.method} ${request.url}: ${message}`,
      );
    } else if (status === HttpStatus.FORBIDDEN) {
      // 403 нь жинхэнэ эрхийн зөрчил — аюулгүй байдлын хяналтад warn хэвээр.
      this.logger.warn(
        `${rid} ${status} error on ${request.method} ${request.url}: ${message}`,
      );
    } else {
      // Always log all other client errors (4xx) for security monitoring.
      // ValidationPipe-ийн жинхэнэ шалтгаан getResponse()-д байдаг
      // (exception.message зөвхөн "Bad Request Exception").
      const details =
        exception instanceof HttpException ? exception.getResponse() : null;
      this.logger.warn(
        `${rid} ${status} error on ${request.method} ${request.url}: ${message}` +
          (details && typeof details === "object"
            ? ` | ${JSON.stringify(details)}`
            : ""),
      );
    }

    // [LOW-6] Strip query string from path — query params may contain sensitive data (tokens, IDs)
    const safePath = request.url.split("?")[0];

    // [SEC] Return generic messages for all status codes to prevent information
    // leakage (internal paths, user IDs, DB column names, etc.).
    // Original message is already logged above for debugging.
    const SAFE_MESSAGES: Record<number, string> = {
      400: "Хүсэлт буруу байна",
      401: "Нэвтрэх шаардлагатай",
      403: "Энэ үйлдлийг гүйцэтгэх эрх байхгүй",
      404: "Хайсан мэдээлэл олдсонгүй",
      409: "Давхар бүртгэл",
      422: "Өгөгдлийн формат буруу",
      429: "Хэт олон хүсэлт. Түр хүлээнэ үү",
      500: "Серверийн алдаа гарлаа",
    };
    // Explicitly opted-in errors (curated, non-sensitive text) pass their
    // real message through so users get actionable feedback — e.g. Python
    // sandbox validation errors ("import зөвшөөрөгдөхгүй", syntax errors).
    const safeMessage =
      exception instanceof UserFacingBadRequestException
        ? message
        : (SAFE_MESSAGES[status] ?? "Алдаа гарлаа");

    response.status(status).json({
      statusCode: status,
      message: safeMessage,
      timestamp: new Date().toISOString(),
      path: safePath,
      requestId,
    });
  }
}
