import { buildBullMqConnection } from './bullmq-connection.factory'

describe('buildBullMqConnection', () => {
  it('uses url when provided', () => {
    expect(buildBullMqConnection({ url: 'redis://localhost:6379' })).toEqual({
      url: 'redis://localhost:6379',
    })
  })

  it('falls back to host/port', () => {
    expect(
      buildBullMqConnection({ host: '127.0.0.1', port: 6381, db: 0 }),
    ).toEqual({
      host: '127.0.0.1',
      port: 6381,
      password: undefined,
      db: 0,
    })
  })
})