import { Module } from '@nestjs/common';
// import { AgentModule } from '@liora/nest-core';

/**
 * FlowiseModule
 * Tích hợp FlowiseAI (hoặc tương đương) để tạo chatbot / AI blocks trên landing.
 *
 * Có thể reuse AgentModule + LibrefangClient từ nest-core làm nền tảng.
 */
@Module({
  // imports: [AgentModule],
})
export class FlowiseModule {}
