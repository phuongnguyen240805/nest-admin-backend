import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { AuthStrategy } from '../auth.constant'

@Injectable()
export class LocalGuard extends AuthGuard(AuthStrategy.LOCAL) {
  override async canActivate(context: ExecutionContext) {
    return true
  }
}
