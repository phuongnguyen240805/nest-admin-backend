export interface CaptureConfig {
  url: string;
  durationMs: number;
  headless: boolean;
  outputDir: string;
  actions?: CaptureAction[];
  servicePatterns?: ServicePattern[];
  maxBodyBytes: number;
  /** Playwright storageState JSON — dùng session đã đăng nhập */
  storageStatePath?: string;
  /** Chrome profile folder — giữ login lâu dài giữa các lần chạy */
  userDataDir?: string;
  /** Mở browser chờ user đăng nhập thủ công (ms) trước khi capture */
  pauseForLoginMs?: number;
  /** Lưu session sau khi đăng nhập để lần sau dùng --storage-state */
  saveStorageStatePath?: string;
  /** URL mở khi chờ login (mặc định app.ladipage.com) */
  loginUrl?: string;
}

export interface CaptureAction {
  type: 'click' | 'dblclick' | 'fill' | 'wait' | 'scroll' | 'press' | 'navigate' | 'waitForSelector' | 'hover';
  selector?: string;
  value?: string;
  ms?: number;
  /** Ghi log khi thực hiện (vd: "create-tag") */
  label?: string;
  /** Click force khi element bị overlay che */
  force?: boolean;
}

export interface ServicePattern {
  name: string;
  urlIncludes: string[];
  wsIncludes?: string[];
  globalKeys?: string[];
}

export interface ApiEntry {
  id: string;
  method: string;
  url: string;
  path: string;
  host: string;
  status?: number;
  mimeType?: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  timingMs?: number;
  service?: string;
  timestamp: string;
}

export interface WebSocketEntry {
  id: string;
  url: string;
  service?: string;
  frames: WebSocketFrame[];
  openedAt: string;
  closedAt?: string;
}

export interface WebSocketFrame {
  direction: 'sent' | 'received';
  opcode: number;
  payload: string;
  timestamp: string;
}

export interface StateSnapshot {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: Array<{ name: string; domain: string; path: string; value: string }>;
  indexedDB: string[];
  serviceWorkers: string[];
  globals: Record<string, unknown>;
  redux?: unknown;
  zustand?: unknown;
}

export interface ServiceHit {
  name: string;
  apis: string[];
  websockets: string[];
  globals: string[];
  storageKeys: string[];
}

export interface NestJsHint {
  module: string;
  controller: string;
  route: string;
  method: string;
  requestDto?: string;
  responseDto?: string;
  tags: string[];
}

export interface CaptureReport {
  meta: {
    url: string;
    finalUrl: string;
    pageTitle: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    userAgent: string;
  };
  summary: {
    apiCount: number;
    websocketCount: number;
    websocketFrameCount: number;
    services: string[];
  };
  apis: ApiEntry[];
  websockets: WebSocketEntry[];
  state: StateSnapshot;
  services: ServiceHit[];
  nestjsHints: NestJsHint[];
}