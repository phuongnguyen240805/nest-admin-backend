import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { MenuModule } from '../system/menu/menu.module'
import { ParamConfigModule } from '../system/param-config/param-config.module'
import { TenantModule } from '../tenant/tenant.module'

import { RoleModule } from '../system/role/role.module'

import { UserController } from './user.controller'
import { UserEntity } from './user.entity'
import { UserService } from './user.service'
import { PasswordHasherService } from './services/password-hasher.service'

const providers = [UserService, PasswordHasherService]

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    RoleModule,
    MenuModule,
    ParamConfigModule,
    TenantModule,
  ],
  controllers: [UserController],
  providers: [...providers],
  exports: [TypeOrmModule, ...providers],
})
export class UserModule {}
