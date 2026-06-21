import { HttpService } from '@nestjs/axios'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { AxiosError } from 'axios'
import { firstValueFrom } from 'rxjs'

import { ILibrefangConfig, LibrefangConfig } from './librefang.config'

export interface LibrefangAgentChatResponse {
  [key: string]: unknown
}

@Injectable()
export class LibrefangService {
  private readonly logger = new Logger(LibrefangService.name)

  constructor(
    private readonly httpService: HttpService,
    @Inject(LibrefangConfig.KEY)
    private readonly librefangConfig: ILibrefangConfig,
  ) {}

  async sendToAgent(
    userId: string,
    agentId: string,
    message: string,
    capabilities: string[],
  ): Promise<LibrefangAgentChatResponse> {
    const baseUrl = this.librefangConfig.apiUrl.replace(/\/$/, '')
    const url = `${baseUrl}/agents/${encodeURIComponent(agentId)}/chat`

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<LibrefangAgentChatResponse>(
          url,
          { message },
          {
            headers: {
              'X-User-Id': userId,
              'X-Capabilities': capabilities.join(','),
              Authorization: `Bearer ${this.librefangConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 120_000,
          },
        ),
      )
      return data
    }
    catch (error) {
      const axiosError = error as AxiosError
      const status = axiosError.response?.status
      const detail = axiosError.response?.data ?? axiosError.message
      this.logger.error(
        `LibreFang request failed (${status ?? 'no-status'}): ${JSON.stringify(detail)}`,
      )
      throw error
    }
  }
}
