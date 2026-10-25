import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { concatMap, Observable, catchError, throwError } from 'rxjs';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AuditKind } from '../generated/prisma/enums';
import { auditStorage, newAuditStore } from './audit-context';
import {
  AUDIT_ACTIONS,
  LOGIN_ROUTE,
  LOGOUT_ROUTE,
  routeKey,
} from './audit-actions';
import { AuditService, type AuditEntry } from './audit.service';

const CHANGES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes the activity log: one entry per request that changes something
 * (with what changed, collected by the Prisma audit extension while the
 * request runs), per login and logout, and per failed login. The entry is
 * written before the response is sent, so it is never missing.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!CHANGES.has(req.method)) return next.handle();

    const route = (req.route as { path?: string } | undefined)?.path;
    const key = routeKey(req.method, route ?? req.path);
    const action = AUDIT_ACTIONS[key];
    if (!action) return next.handle();

    const store = newAuditStore();
    const params = req.params as Record<string, string | undefined>;
    const base: Omit<AuditEntry, 'kind' | 'actorId'> = {
      category: action.category,
      action: action.action,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      routeId: params.id,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    };

    return new Observable((subscriber) =>
      auditStorage.run(store, () =>
        next
          .handle()
          .pipe(
            concatMap(async (body: unknown) => {
              store.closed = true;
              await this.audit.write({
                ...base,
                kind:
                  key === LOGIN_ROUTE
                    ? AuditKind.LOGIN
                    : key === LOGOUT_ROUTE
                      ? AuditKind.LOGOUT
                      : AuditKind.CHANGE,
                actorId:
                  key === LOGIN_ROUTE
                    ? (body as { user?: { id?: string } } | null)?.user?.id
                    : req.user?.id,
                store,
              });
              return body;
            }),
            catchError((error: unknown) => {
              store.closed = true;
              const status =
                error instanceof HttpException ? error.getStatus() : 500;
              if (key !== LOGIN_ROUTE || status !== 401) {
                return throwError(() => error);
              }
              const email = (req.body as { email?: unknown } | undefined)
                ?.email;
              return new Observable<never>((failed) => {
                void this.audit
                  .write({
                    ...base,
                    kind: AuditKind.LOGIN_FAILED,
                    action: 'Failed to log in',
                    email: typeof email === 'string' ? email.slice(0, 254) : '',
                    status,
                  })
                  .finally(() => failed.error(error));
              });
            }),
          )
          .subscribe(subscriber),
      ),
    );
  }
}
