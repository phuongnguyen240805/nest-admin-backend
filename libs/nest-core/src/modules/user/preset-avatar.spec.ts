import {
  PRESET_AVATAR_IDS,
  isMissingAvatar,
  nextDefaultAvatar,
  resolveAvatarForNewUser,
} from './preset-avatar'

const PRESET_ID = /^preset:kedi-(0[1-9]|1[0-2])$/

describe('preset avatars', () => {
  it('assigns a catalog id when register or create has no avatar', () => {
    expect(resolveAvatarForNewUser()).toMatch(PRESET_ID)
    expect(resolveAvatarForNewUser('   ', () => 0)).toMatch(PRESET_ID)
    expect(resolveAvatarForNewUser(undefined, () => 0)).toBe('preset:kedi-01')
    expect(resolveAvatarForNewUser(null, () => 0.999)).toBe('preset:kedi-12')
  })

  it('keeps an avatar the caller already supplied', () => {
    expect(resolveAvatarForNewUser(' https://cdn.example/a.png ')).toBe('https://cdn.example/a.png')
    expect(resolveAvatarForNewUser('preset:kedi-04')).toBe('preset:kedi-04')
  })

  it('fills a blank avatar once and does not replace an existing one', () => {
    expect(nextDefaultAvatar('', () => 0.2)).toBe('preset:kedi-03')
    expect(nextDefaultAvatar(null, () => 0.2)).toBe('preset:kedi-03')
    expect(nextDefaultAvatar('preset:kedi-08')).toBeNull()
    expect(nextDefaultAvatar('https://cdn.example/a.png')).toBeNull()
    expect(isMissingAvatar('  ')).toBe(true)
    expect(PRESET_AVATAR_IDS).toHaveLength(12)
  })
})
