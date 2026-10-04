// Talks to the backend proxy in one provider-neutral format:
//   request  { capability, tier, system, messages, tools }
//   response { text, toolCalls: [{ id, name, input }], stopReason }
// The proxy translates this to the model provider's API (see server/providers/).
import { AI_CONFIG } from './config.js';

export class AIError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AIError';
    this.cause = cause;
  }
}

export async function requestModel(payload, { endpoint = AI_CONFIG.endpoint, timeoutMs = AI_CONFIG.timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new AIError(`Model proxy returned ${res.status}`);
    const data = await res.json();
    return { text: data.text || '', toolCalls: data.toolCalls || [], stopReason: data.stopReason || 'end' };
  } catch (err) {
    if (err instanceof AIError) throw err;
    throw new AIError(err.name === 'AbortError' ? 'Model request timed out' : 'Model request failed', err);
  } finally {
    clearTimeout(timer);
  }
}
