import { ConfigType, registerAs } from '@nestjs/config'

import { buildDataSourceOptions } from '@liora/database/utils/connection-url.util'
import { DataSource, DataSourceOptions } from 'typeorm'

export const dbRegToken = 'database'

export const DatabaseConfig = registerAs(
  dbRegToken,
  (): DataSourceOptions => buildDataSourceOptions(),
)

export type IDatabaseConfig = ConfigType<typeof DatabaseConfig>

const dataSource = new DataSource(buildDataSourceOptions())

export default dataSource
