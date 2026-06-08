import { Roles } from '../../auth/auth.constant'

const ADMIN_CAPABILITIES = ['browser_donut', 'midscene_vision', 'mcp'] as const
const USER_CAPABILITIES = ['browser_donut'] as const

export function mapRolesToCapabilities(roles: string[] = []): string[] {
  if (roles.includes(Roles.ADMIN)) {
    return [...ADMIN_CAPABILITIES]
  }
  return [...USER_CAPABILITIES]
}
