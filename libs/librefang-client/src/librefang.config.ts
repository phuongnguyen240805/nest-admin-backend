import { ConfigType, registerAs } from '@nestjs/config'

export const librefangRegToken = 'librefang'

function env(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue
}

export const LibrefangConfig = registerAs(librefangRegToken, () => ({
  apiUrl: env('LIBREFANG_API_URL', 'http://localhost:4545'),
  apiKey: env('LIBREFANG_API_KEY', ''),
}))

export type ILibrefangConfig = ConfigType<typeof LibrefangConfig>
