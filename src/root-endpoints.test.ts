import { describe, expect, it } from 'vitest';
import { isManagementRoutesEnabled, parseGatewayConfigFromRaw } from './config';
import { listRootEndpoints } from './root-endpoints';

function listFor(raw: Record<string, unknown>): string[] {
  const config = parseGatewayConfigFromRaw(raw);
  return listRootEndpoints(config, {
    agentManagementEnabled: true,
    agentSessionManagementEnabled: true,
    managementRoutesEnabled: isManagementRoutesEnabled(config),
    providerManagementEnabled: true
  });
}

describe('listRootEndpoints', () => {
  it('leaves out the /agent and /manager endpoints when managementRoutes.enabled is false', () => {
    const endpoints = listFor({ managementRoutes: { enabled: false } });

    expect(endpoints.filter((item) => /\/(agent|manager)\//.test(item))).toEqual([]);
    expect(endpoints).toContain('POST /v1/responses');
    expect(endpoints).toContain('POST /v1/messages');
    expect(endpoints).toContain('GET /health');
  });

  it.each([
    ['true', { managementRoutes: { enabled: true } }],
    ['unset', {}]
  ])('lists the /agent and /manager endpoints when managementRoutes.enabled is %s', (_label, raw) => {
    const endpoints = listFor(raw);

    expect(endpoints).toContain('GET /agent/tools');
    expect(endpoints).toContain('GET /manager/config');
    expect(endpoints).toContain('POST /v1/responses');
  });
});
