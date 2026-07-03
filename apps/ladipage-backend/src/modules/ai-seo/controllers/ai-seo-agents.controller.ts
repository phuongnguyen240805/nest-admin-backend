import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

const DEFAULT_AGENTS = [
  {
    id: 'chat-assistant',
    name: 'AI Chat Assistant',
    role: 'Trợ lý SEO đa năng',
    description: 'Hỗ trợ giải đáp các câu hỏi về SEO, phân tích sơ bộ và tư vấn chiến lược nội dung, kỹ thuật tổng quan.',
    avatar: '🤖',
    playbooks: [
      { id: 'seo-intro', name: 'Giải thích chuẩn SEO', prompt: 'Hãy giải thích thế nào là cấu trúc website chuẩn SEO và các bước tối ưu hóa ban đầu.' },
    ],
  },
  {
    id: 'seo-audit',
    name: 'SEO Audit Agent',
    role: 'Chuyên gia kiểm toán kỹ thuật website',
    description: 'Phân tích cấu trúc website, thẻ meta, sơ đồ trang web, tốc độ tải trang và các lỗi kỹ thuật chuẩn SEO.',
    avatar: '🔍',
    playbooks: [
      { id: 'meta-audit', name: 'Kiểm tra Meta Tags', prompt: 'Kiểm tra cấu trúc và nội dung các thẻ title, description của domain sau đây và đề xuất cải thiện: ' },
    ],
  },
  {
    id: 'keyword-research',
    name: 'Keyword Research Agent',
    role: 'Nhà nghiên cứu từ khóa',
    description: 'Tìm kiếm từ khóa tiềm năng, phân tích khối lượng tìm kiếm (volume), độ khó từ khóa (KD) và ý định tìm kiếm (search intent).',
    avatar: '📊',
    playbooks: [
      { id: 'keyword-discovery', name: 'Tìm kiếm từ khóa ngách', prompt: 'Tìm kiếm 20 từ khóa ngách có độ khó thấp (KD < 30) và volume cao trong ngành: ' },
    ],
  },
]

@ApiTags('AI SEO - Agents')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo/agents')
export class AiSeoAgentsController {
  @Get()
  list() {
    return DEFAULT_AGENTS
  }
}