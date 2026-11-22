import { describe, expect, it } from 'vitest';
import { claimWebSocketUpgradePath, isWebSocketUpgradePathClaimed } from './upgrade-paths';

describe('websocket upgrade path claims', () => {
  it('unclaims a path once its only claim is released', () => {
    const server = {};
    const release = claimWebSocketUpgradePath(server, '/mcp/ws');
    expect(isWebSocketUpgradePathClaimed(server, '/mcp/ws')).toBe(true);

    release();
    expect(isWebSocketUpgradePathClaimed(server, '/mcp/ws')).toBe(false);
  });

  it('keeps a path claimed while another claim on it is held', () => {
    const server = {};
    const releaseFirst = claimWebSocketUpgradePath(server, '/mcp/ws');
    const releaseSecond = claimWebSocketUpgradePath(server, '/mcp/ws');

    releaseFirst();
    expect(isWebSocketUpgradePathClaimed(server, '/mcp/ws')).toBe(true);

    releaseSecond();
    expect(isWebSocketUpgradePathClaimed(server, '/mcp/ws')).toBe(false);
  });

  it('keeps claims separate per server', () => {
    const first = {};
    const second = {};
    claimWebSocketUpgradePath(first, '/mcp/ws');

    expect(isWebSocketUpgradePathClaimed(second, '/mcp/ws')).toBe(false);
  });

  it('releases a claim only once', () => {
    const server = {};
    const release = claimWebSocketUpgradePath(server, '/mcp/ws');
    claimWebSocketUpgradePath(server, '/mcp/ws');

    release();
    release();
    expect(isWebSocketUpgradePathClaimed(server, '/mcp/ws')).toBe(true);
  });
});
