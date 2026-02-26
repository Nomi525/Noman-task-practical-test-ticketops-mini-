import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((result) => {
        // If already wrapped, return as-is
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }

        const { data, meta } = result && result.data !== undefined
          ? result
          : { data: result, meta: undefined };

        return {
          success: true,
          data,
          ...(meta !== undefined && { meta }),
        };
      }),
    );
  }
}
