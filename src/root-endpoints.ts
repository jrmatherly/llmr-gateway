import type { GatewayConfig } from './types';

interface RootEndpointOptions {
  agentManagementEnabled: boolean;
  agentSessionManagementEnabled: boolean;
  managementRoutesEnabled: boolean;
  providerManagementEnabled: boolean;
}

const agentReadEndpoints = [
  'GET /agent/tools',
  'GET /agent/agents',
  'GET /agent/agents/:agentId',
  'GET /agent/sessions',
  'GET /agent/sessions/:sessionId',
  'GET /agent/sessions/:sessionId/stream',
  'GET /agent/sessions/:sessionId/events'
];
const agentManageEndpoints = [
  'POST /agent/agents',
  'PUT /agent/agents/:agentId',
  'DELETE /agent/agents/:agentId'
];
const agentSessionManageEndpoints = [
  'POST /agent/sessions',
  'DELETE /agent/sessions/:sessionId',
  'POST /agent/sessions/:sessionId/resume',
  'POST /agent/sessions/:sessionId/input',
  'POST /agent/sessions/:sessionId/config',
  'POST /agent/sessions/:sessionId/tool-result',
  'POST /agent/sessions/:sessionId/events'
];

export function listRootEndpoints(config: GatewayConfig, options: RootEndpointOptions): string[] {
  return [
    'GET /health',
    'GET /ready',
    'POST /v1/responses',
    'WS /v1/responses',
    'GET /v1/models',
    'GET /v1/models/:model',
    'POST /v1/chat/completions',
    'POST /v1/embeddings',
    'POST /v1/moderations',
    'POST /v1/images/generations',
    'POST /v1/images/edits',
    'POST /v1/videos',
    'POST /v1/videos/generations',
    'GET /v1/videos/:id',
    'GET /v1/videos/:id/content',
    config.metrics.enabled ? 'GET /metrics' : undefined,
    'POST /v1/messages',
    'POST /v1beta/models/:model:generateContent',
    config.mcpGateway.enabled ? `POST ${config.mcpGateway.endpoint}` : undefined,
    config.mcpGateway.enabled && config.mcpGateway.websocket.enabled
      ? `WS ${config.mcpGateway.websocket.endpoint}`
      : undefined,
    ...agentReadEndpoints,
    ...(options.agentManagementEnabled ? agentManageEndpoints : []),
    ...(options.agentSessionManagementEnabled ? agentSessionManageEndpoints : []),
    ...(options.agentManagementEnabled
      ? [
          'GET /manager/config',
          'POST /manager/config/validate',
          'PUT /manager/config',
          'GET /manager/providers/health',
          'POST /manager/providers/health/check'
        ]
      : []),
    ...(options.agentManagementEnabled && options.providerManagementEnabled ? ['GET /manager/providers'] : [])
  ]
    .filter((item): item is string => Boolean(item))
    .filter((item) => options.managementRoutesEnabled || !/^\w+ \/(agent|manager)\//.test(item));
}
