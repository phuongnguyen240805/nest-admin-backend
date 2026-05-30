import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Tenant])],
    providers: [
        TenantContextService,
        TenantGuard,
        TenantContextInterceptor,
        TenantService,
    ],
    exports: [
        TenantContextService,
        TenantGuard,
        TenantContextInterceptor,
        TenantService,
        TypeOrmModule,
    ],
})
export class TenantModule { }