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

import { CrmNoteService } from '@liora/crm-core'
import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { CreateNoteDto, NoteQueryDto, UpdateNoteDto } from '../dto/note.dto'
import { CrmEnabledGuard } from '../guards/crm-enabled.guard'

@ApiTags('CRM - Notes')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard, CrmEnabledGuard)
@Controller('crm/notes')
export class NoteController {
  constructor(private readonly noteService: CrmNoteService) {}

  @Get()
  list(@Query() dto: NoteQueryDto) {
    return this.noteService.list(dto)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.noteService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateNoteDto) {
    return this.noteService.create({
      title: dto.title,
      body: dto.body,
      personId: dto.personId ?? null,
      companyId: dto.companyId ?? null,
      opportunityId: dto.opportunityId ?? null,
    })
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.noteService.update(id, {
      title: dto.title,
      body: dto.body,
    })
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.noteService.remove(id)
  }
}