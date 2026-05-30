import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateTenantDto {
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    domain?: string;
}