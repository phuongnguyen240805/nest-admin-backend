import type { CDPSession } from 'playwright';
import type { WebSocketEntry } from '../types.js';
import { matchService, nowIso, truncate } from '../utils.js';
import type { ServicePattern } from '../types.js';

export class WebSocketCollector {
  private sockets = new Map<string, WebSocketEntry>();
  readonly entries: WebSocketEntry[] = [];

  constructor(
    private readonly patterns: ServicePattern[],
    private readonly maxBodyBytes: number,
  ) {}

  async attach(cdp: CDPSession): Promise<void> {
    cdp.on('Network.webSocketCreated', (evt) => {
      const entry: WebSocketEntry = {
        id: evt.requestId,
        url: evt.url,
        service: matchService(evt.url, this.patterns, 'ws'),
        frames: [],
        openedAt: nowIso(),
      };
      this.sockets.set(evt.requestId, entry);
      this.entries.push(entry);
    });

    cdp.on('Network.webSocketFrameSent', (evt) => {
      const sock = this.sockets.get(evt.requestId);
      if (!sock) return;
      sock.frames.push({
        direction: 'sent',
        opcode: evt.response.opcode,
        payload: truncate(evt.response.payloadData, this.maxBodyBytes),
        timestamp: nowIso(),
      });
    });

    cdp.on('Network.webSocketFrameReceived', (evt) => {
      const sock = this.sockets.get(evt.requestId);
      if (!sock) return;
      sock.frames.push({
        direction: 'received',
        opcode: evt.response.opcode,
        payload: truncate(evt.response.payloadData, this.maxBodyBytes),
        timestamp: nowIso(),
      });
    });

    cdp.on('Network.webSocketClosed', (evt) => {
      const sock = this.sockets.get(evt.requestId);
      if (sock) sock.closedAt = nowIso();
    });
  }
}