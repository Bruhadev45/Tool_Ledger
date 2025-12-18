import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;
    const action = this.mapMethodToAction(method);

    return next.handle().pipe(
      tap(() => {
        if (user && action) {
          // Extract resource type and id from URL
          const resourceType = this.extractResourceType(url);
          const resourceId = this.extractResourceId(url, request);

          this.auditLogService.create({
            action,
            resourceType,
            resourceId,
            userId: user.id,
            organizationId: user.organizationId,
            ipAddress: request.ip,
            userAgent: request.get('user-agent'),
            metadata: JSON.stringify({ method, url }),
          });
        }
      }),
    );
  }

  private mapMethodToAction(method: string): AuditAction | null {
    const mapping = {
      POST: AuditAction.CREATE,
      GET: AuditAction.READ,
      PATCH: AuditAction.UPDATE,
      PUT: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };
    return mapping[method] || null;
  }

  private extractResourceType(url: string): string {
    const parts = url.split('/').filter(Boolean);
    // Skip 'api' prefix
    const resourceIndex = parts.findIndex((p) => p !== 'api');
    return parts[resourceIndex] || 'unknown';
  }

  private extractResourceId(url: string, request: any): string {
    // Try to get ID from URL params or body
    const urlParts = url.split('/').filter(Boolean);
    const idIndex = urlParts.findIndex((p) => p.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
    if (idIndex !== -1) {
      return urlParts[idIndex];
    }
    return request.body?.id || request.params?.id || 'unknown';
  }
}
