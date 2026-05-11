import {
  ArgumentMetadata,
  Inject,
  Injectable,
  PipeTransform,
} from '@nestjs/common'
import { REQUEST } from '@nestjs/core'

import { OperatorDto } from '@liora/dto/operator.dto'
import { IAuthUser } from '~/modules/auth/interfaces/auth.interface'

@Injectable()
export class CreatorPipe implements PipeTransform {
  constructor(@Inject(REQUEST) private readonly request: any) {}
  transform(value: OperatorDto, metadata: ArgumentMetadata) {
    const user = this.request.user as IAuthUser

    value.createBy = user.uid

    return value
  }
}
