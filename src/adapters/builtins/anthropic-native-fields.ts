// Internal metadata survives StandardRequest/Response spreads but never JSON serialization.
export const nativeAnthropicFields: unique symbol = Symbol('nativeAnthropicFields');

export function extraAnthropicFields(body: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const mapped = new Set(keys);
  return Object.fromEntries(Object.entries(body).filter(([key]) => !mapped.has(key)));
}

export function preserveNativeAnthropicFields(body: Record<string, unknown>, keys: string[]): { [nativeAnthropicFields]?: Record<string, unknown> } {
  const fields = extraAnthropicFields(body, keys);
  return Object.keys(fields).length ? { [nativeAnthropicFields]: fields } : {};
}
