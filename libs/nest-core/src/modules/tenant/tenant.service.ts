import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from './dto';

@Injectable()

export class TenantService {
    constructor(
        @InjectRepository(Tenant)
        private readonly tenantRepository: Repository<Tenant>,
    ) { }

    async create(createTenantDto: CreateTenantDto) {
        const tenant = this.tenantRepository.create(createTenantDto);
        return this.tenantRepository.save(tenant);
    }

    async findAll() {
        return this.tenantRepository.find();
    }

    async findOne(id: string) {
        return this.tenantRepository.findOne({ where: { id: parseInt(id, 10) } });
    }

    async update(id: string, updateTenantDto: UpdateTenantDto) {
        await this.tenantRepository.update(parseInt(id, 10), updateTenantDto);
        return this.findOne(id);
    }
}