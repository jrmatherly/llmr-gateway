import { expect, it } from 'vitest';
import { parseAnthropicMessagesRequest } from './source/parsers';
import { anthropicMessagesTargetAdapter } from './target/anthropic-messages';
import { parseAnthropicToStandardResponse } from './target/shared';
import { formatAnthropicMessagesResponse } from './source/formatters';
import { nativeAnthropicFields } from './anthropic-native-fields';

it('round-trips opaque native safeguards and future fields without leaking metadata into other formats', () => {
  const safeguards = [{ type: 'future-classifier', config: { unknown: ['opaque', 123] } }];
  const source = parseAnthropicMessagesRequest({ model: 'alias', messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 32, safeguards, future_native_request: { keep: true } });
  expect(source.ok).toBe(true); if (!source.ok) return;
  const request = anthropicMessagesTargetAdapter.buildRequestFromStandard({
    request: { headers: { 'anthropic-beta': 'future-beta' } }, standardRequest: { ...source.value, model: 'native' },
    config: { anthropicBaseUrl: 'https://native.invalid', anthropicApiKey: 'test' }
  } as any);
  expect(request.ok).toBe(true); if (!request.ok) return;
  expect(request.value.body).toMatchObject({ model: 'native', safeguards, future_native_request: { keep: true } });
  const verdict = { toolu_original: { verdict: 'allow', unknown: [1, 'future'] } };
  const response = parseAnthropicToStandardResponse({ id: 'msg', type: 'message', model: 'native',
    content: [{ type: 'tool_use', id: 'toolu_original', name: 't', input: {} }],
    stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 }, safeguard_results: verdict,
    future_native_reply: { keep: true } });
  expect(response.ok).toBe(true); if (!response.ok) return;
  const formatted = formatAnthropicMessagesResponse({ ...response.value });
  expect(formatted).toMatchObject({ safeguard_results: verdict, future_native_reply: { keep: true },
    content: [{ type: 'tool_use', id: 'toolu_original' }] });
  expect(response.value[nativeAnthropicFields]?.safeguard_results).toBe(verdict);
  expect(JSON.stringify(response.value)).not.toContain('future_native_reply');
  const empty = parseAnthropicMessagesRequest({ model: 'm', messages: [{ role: 'user', content: 'hi' }], safeguards: [] });
  expect(empty.ok && empty.value[nativeAnthropicFields]?.safeguards).toEqual([]);
});
