import { Global, Module } from '@nestjs/common'

import { AI_PROVIDER_GATEWAY } from './ai-provider-gateway.tokens'
import { FakeAiProviderGateway } from './fake-ai-provider.gateway'
import { OmniRouteAiProviderGateway } from './omniroute-ai-provider.gateway'

@Global()
@Module({
  providers: [
    FakeAiProviderGateway,
    OmniRouteAiProviderGateway,
    {
      provide: AI_PROVIDER_GATEWAY,
      inject: [FakeAiProviderGateway, OmniRouteAiProviderGateway],
      useFactory: (
        fakeGateway: FakeAiProviderGateway,
        omniRouteGateway: OmniRouteAiProviderGateway,
      ) => {
        if (process.env.AI_GATEWAY_DRIVER === 'fake') return fakeGateway
        return omniRouteGateway
      },
    },
  ],
  exports: [AI_PROVIDER_GATEWAY, FakeAiProviderGateway, OmniRouteAiProviderGateway],
})
export class AiGatewayModule {}
