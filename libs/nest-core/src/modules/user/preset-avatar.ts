/** Illustrated account avatars. Ids must match ladipage-fe-v2 `PRESET_AVATAR_IDS`. */
export const PRESET_AVATAR_IDS = [
  'kedi-01',
  'kedi-02',
  'kedi-03',
  'kedi-04',
  'kedi-05',
  'kedi-06',
  'kedi-07',
  'kedi-08',
  'kedi-09',
  'kedi-10',
  'kedi-11',
  'kedi-12',
] as const

const PRESET_AVATAR_PREFIX = 'preset:'

export function isMissingAvatar(value?: string | null): boolean {
  return !value?.trim()
}

export function toPresetAvatarValue(id: (typeof PRESET_AVATAR_IDS)[number]): string {
  return `${PRESET_AVATAR_PREFIX}${id}`
}

/** Stable preset id for a new account. Keeps a caller-supplied avatar. */
export function resolveAvatarForNewUser(
  avatar?: string | null,
  random: () => number = Math.random,
): string {
  if (!isMissingAvatar(avatar))
    return avatar!.trim()

  const index = Math.min(
    PRESET_AVATAR_IDS.length - 1,
    Math.max(0, Math.floor(random() * PRESET_AVATAR_IDS.length)),
  )
  return toPresetAvatarValue(PRESET_AVATAR_IDS[index])
}

/** Value to persist on login, or null when the account already has an avatar. */
export function nextDefaultAvatar(
  current?: string | null,
  random: () => number = Math.random,
): string | null {
  if (!isMissingAvatar(current))
    return null
  return resolveAvatarForNewUser(null, random)
}
