import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { CrmTaskService } from '@liora/crm-core'
import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from '../dto/task.dto'
import { CrmEnabledGuard } from '../guards/crm-enabled.guard'

@ApiTags('CRM - Tasks')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard, CrmEnabledGuard)
@Controller('crm/tasks')
export class TaskController {
  constructor(private readonly taskService: CrmTaskService) {}

  @Get()
  list(@Query() dto: TaskQueryDto) {
    return this.taskService.list(dto)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.taskService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.taskService.create({
      title: dto.title,
      body: dto.body,
      status: dto.status,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      personId: dto.personId ?? null,
      companyId: dto.companyId ?? null,
      opportunityId: dto.opportunityId ?? null,
      assigneeId: dto.assigneeId ?? null,
    })
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.taskService.update(id, {
      title: dto.title,
      body: dto.body,
      status: dto.status,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      assigneeId: dto.assigneeId,
    })
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taskService.remove(id)
  }
}