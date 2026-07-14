import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CaptureConfig, ServicePattern } from './types.js';

export const DEFAULT_SERVICE_PATTERNS: ServicePattern[] = [
  {
    name: 'ladipage',
    urlIncludes: [
      'ladipage',
      'ladi-page',
      'ladiflow',
      'ladisales',
      'ldpform.net',
      'apiv5.sales',
      'ladilink',
      'api.ladiuid',
      'api.ladipage',
      'apiv5.ladipage',
      'app.ladipage',
      'build.ladipage',
      'apps.ladipage',
    ],
    globalKeys: ['LadiPage', 'ladiPage', '__LADI__', 'LADI_CONFIG', 'ladiConfig'],
  },
  {
    name: 'funnelx',
    urlIncludes: ['funnelx', 'funnel-x', 'fx-api', 'fx.'],
    wsIncludes: ['funnelx', 'funnel-x'],
    globalKeys: ['FunnelX', 'funnelX', '__FUNNELX__'],
  },
  {
    name: 'ladichat',
    urlIncludes: ['ladichat', 'ladi-chat', 'chat.ladi', 'ladi.chat'],
    wsIncludes: ['ladichat', 'ladi-chat', 'socket.io'],
    globalKeys: ['LadiChat', 'ladiChat', '__LADICHAT__'],
  },
];

function parseArgv(argv: string[]) {
  const get = (flag: string, fallback?: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const has = (flag: string) => argv.includes(flag);
  return { get, has };
}

export async function loadConfig(argv: string[]): Promise<CaptureConfig> {
  const { get, has } = parseArgv(argv);
  const configPath = get('--config');

  let base: Partial<CaptureConfig> = {};
  if (configPath) {
    const raw = JSON.parse(await readFile(resolve(configPath), 'utf8')) as Partial<CaptureConfig>;
    base = raw;
  }

  const headless = has('--headed') ? false : has('--headless') ? true : (base.headless ?? true);

  return {
    url: get('--url', process.env.CDP_TARGET_URL ?? base.url ?? 'https://example.com')!,
    durationMs: Number(get('--duration', process.env.CDP_DURATION_MS ?? String(base.durationMs ?? 15000))),
    headless,
    outputDir: get('--output', base.outputDir ?? 'output')!,
    actions: base.actions,
    servicePatterns: base.servicePatterns ?? DEFAULT_SERVICE_PATTERNS,
    maxBodyBytes: Number(get('--max-body', String(base.maxBodyBytes ?? 524288))),
    storageStatePath: get('--storage-state', base.storageStatePath ?? process.env.CDP_STORAGE_STATE),
    userDataDir: get('--user-data-dir', base.userDataDir ?? process.env.CDP_USER_DATA_DIR),
    pauseForLoginMs: (() => {
      const cli = get('--pause-for-login');
      if (cli !== undefined) return Number(cli);
      if (has('--pause-for-login')) return 120_000;
      return base.pauseForLoginMs;
    })(),
    saveStorageStatePath: get('--save-storage-state', base.saveStorageStatePath),
    loginUrl: get('--login-url', base.loginUrl ?? 'https://app.ladipage.com/auth/login'),
  };
}
