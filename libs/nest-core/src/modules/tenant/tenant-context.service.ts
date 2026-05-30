import { Injectable, Scope } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ClsStore } from '../types/cls-store';

export const TENANT_CONTEXT_KEY = 'tenantId' as const;

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
    constructor(private readonly cls: ClsService<ClsStore>) { }

    setTenantId(tenantId: string): void {
        this.cls.set(TENANT_CONTEXT_KEY, tenantId);
    }

    getTenantId(): string | undefined {
        return this.cls.get(TENANT_CONTEXT_KEY);
    }

    getCurrentTenant(): { id: string } | null {
        const tenantId = this.getTenantId();
        return tenantId ? { id: tenantId } : null;
    }

    clear(): void {
        this.cls.set(TENANT_CONTEXT_KEY, undefined);
    }
}