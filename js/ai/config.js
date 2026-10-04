// Where agent decisions come from.
// "simulated" (default) runs the local agent logic, so the static demo needs no backend.
// "live" sends each decision to a model through the backend proxy (see server/ and docs/ai-integration.md).
const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);

export const AI_CONFIG = Object.freeze({
  mode: params.get('ai') === 'live' ? 'live' : 'simulated',
  endpoint: '/api/agent',   // API keys live on the server, never in the browser
  timeoutMs: 20000,
  maxToolSteps: 6,          // tool calls a model may make before it must answer
});
