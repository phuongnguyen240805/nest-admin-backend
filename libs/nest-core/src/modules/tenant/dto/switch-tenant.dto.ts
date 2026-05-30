import { IsNotEmpty, IsUUID } from 'class-validator';

export class SwitchTenantDto {
    @IsNotEmpty()
    @IsUUID()
    tenantId?: string;
}