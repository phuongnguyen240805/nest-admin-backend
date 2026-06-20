/** Customer status — aligned with ladipage-fe customers module */
export type CustomerStatus = 'ACTIVE' | 'BLOCKED'

/** FE-compatible customer list item (khach-hang page) */
export interface CustomerItem {
  id: string | number
  name: string
  phone: string
  email: string
  status: CustomerStatus
  createdAt: string | Date
  segment?: string
  tags: string[]
}

export interface CompanyItem {
  id: string | number
  name: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface SegmentItem {
  id: string | number
  name: string
  isDefault: boolean
  customerCount: number
  createdAt: string | Date
  updatedAt: string | Date
}

export interface TagItem {
  id: string | number
  name: string
  count: number
  createdAt: string | Date
  updatedAt: string | Date
}

export type CustomFieldType =
  | 'Chữ'
  | 'Số'
  | 'Ngày tháng'
  | 'Danh sách'
  | 'Đúng/Sai'
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'LIST'
  | 'BOOLEAN'

export interface CustomFieldItem {
  id: string | number
  displayName: string
  fieldName: string
  dataType: CustomFieldType
  description: string
}

export interface ErrorLogItem {
  id: string | number
  time: string | Date
  errorCode: string
  customer: string
  actionType: string
  errorContent: string
}

/** CRM — Pipeline & Sales (Phase 4+) */
export interface PipelineStageItem {
  id: string
  slug: string
  name: string
  position: number
  color?: string
}

export interface PipelineItem {
  id: string
  name: string
  isDefault: boolean
  stages: PipelineStageItem[]
}

export interface OpportunityItem {
  id: string
  name: string
  amount?: number | null
  closeDate?: string | null
  stageId: string
  personId?: string | null
  companyId?: string | null
  position?: number
  createdAt: string | Date
  updatedAt: string | Date
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'

export interface TaskItem {
  id: string
  title: string
  status: TaskStatus
  dueDate?: string | null
  personId?: string | null
  opportunityId?: string | null
  createdAt: string | Date
}

export interface NoteItem {
  id: string
  body: string
  personId?: string | null
  opportunityId?: string | null
  createdAt: string | Date
}

export type ActivityAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'STAGE_CHANGED'

export interface ActivityItem {
  id: string
  action: ActivityAction
  targetType: 'person' | 'opportunity' | 'task' | 'note'
  targetId: string
  name: string
  happensAt: string | Date
  properties?: Record<string, unknown>
}

/** CRM — Custom fields (Phase 7) */
export type CustomFieldTargetType = 'person' | 'opportunity'

export interface CustomFieldDefItem {
  id: string
  fieldName: string
  displayName: string
  dataType: CustomFieldType
  targetType: CustomFieldTargetType
  isRequired?: boolean
  options?: string[] | null
  description?: string
}

/** CRM — Enterprise custom objects (Phase 8) */
export interface ObjectFieldDefItem {
  id: string
  fieldSlug: string
  label: string
  dataType: CustomFieldType
  isRequired: boolean
  options?: string[] | null
  position: number
}

export interface ObjectDefinitionItem {
  id: string
  slug: string
  label: string
  description?: string | null
  fields?: ObjectFieldDefItem[]
  createdAt: string | Date
  updatedAt: string | Date
}

export interface DynamicRecordItem {
  id: string
  objectId: string
  data: Record<string, unknown>
  createdAt: string | Date
  updatedAt: string | Date
}