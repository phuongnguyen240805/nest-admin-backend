/** Registered platform / product application codes */
export const APP_CODE_LADIPAGE = 'ladipage' as const
export const APP_CODE_NEST_ADMIN = 'nest-admin' as const

/** JWT / legacy rows created before app-scoped auth */
export const LEGACY_DEFAULT_APP_CODE = APP_CODE_LADIPAGE

export const KNOWN_APP_CODES = [
  APP_CODE_LADIPAGE,
  APP_CODE_NEST_ADMIN,
] as const

export type KnownAppCode = (typeof KNOWN_APP_CODES)[number]