import { IsIn } from 'class-validator'

export class UpdateSeoTaskDto {
  @IsIn(['todo', 'in_progress', 'completed'])
  status!: 'todo' | 'in_progress' | 'completed'
}