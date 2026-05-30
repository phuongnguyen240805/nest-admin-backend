import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateTenantDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    domain?: string;
}