# AI integration

The demo runs on simulated agents, so it works as a static site with no backend. The code is already wired for a live model: switching is a configuration change, not a rebuild.

## How a decision flows

```
screen (js/ui)
  → agent gateway (js/agents/index.js)          one async call per capability
      simulated: local agent logic (js/agents/*.js)
      live:      js/ai/run-agent.js
                   → model client (js/ai/model-client.js) → POST /api/agent → server/index.mjs → provider adapter
                   ← tool calls run in the browser against read-only tools (js/ai/tool-registry.js)
                   ← final JSON checked against the spec's schema and guardrails (js/agents/specs.js)
```

Screens only ever talk to the gateway, and both modes return the same shape. If a live call fails, times out, or breaks a guardrail, the gateway logs a warning, shows the presenter a notice, and the simulated agent answers instead.

## Capabilities

| Capability | Model tier | Tools | Guardrails |
| --- | --- | --- | --- |
| `intake.checkAddress` | fast | city, barangay, landmark and past-delivery lookups | Cities and barangays must exist in the lists |
| `intake.screenItem` | fast | item policy lookups | Tags limited to Battery, Liquid, Food, Fragile |
| `intake.writeRiderNote` | fast | none | The note must name the barangay |
| `intake.answerQuestion` | fast | landmark, city, zone, rate and item lookups | Form fill only with a real city and barangay |
| `assignment.planBatch` | strong | batch parcels, riders, neighbouring areas, vehicle fit | Every parcel once; available riders only; capacity and vehicle fit respected |
| `deliveryStatus.answer` | fast | parcel search, rider location | Money, policy and complaints always escalate; parcels must exist; no draft on escalations |

`intake.checkDuplicate` is a data lookup and always runs locally.

Fixed rules never go to a model: field validation, the required city and barangay, the fee, the "too incomplete to deliver" check and the intake review reasons live in `js/core/validation.js` and `js/core/pricing.js`.

## Going live

1. **Install the provider SDK** (only needed for live mode):
   ```bash
   cd server && npm install
   ```
2. **Configure the proxy.** Credentials stay on the server:
   ```bash
   export AI_PROVIDER=bedrock
   export AWS_REGION=ap-southeast-1
   export MODEL_FAST=<a fast Bedrock model id>
   export MODEL_STRONG=<a stronger Bedrock model id>
   ```
3. **Run it:** `npm run start:live` from the repo root, then open `http://localhost:8787/?ai=live`.

To check the wiring without credentials, run `npm run start:mock`. The mock provider makes a tool call, returns valid answers for some capabilities and deliberately invalid ones for others, so you can see both live answers (marked "mock model") and the fallback.

## Adding a provider

Create `server/providers/<name>.mjs` exporting `complete(request)`:

- **request:** `{ capability, tier, system, messages, tools }`, where messages use the roles `user`, `assistant` (with optional `toolCalls`) and `tool` (with `toolCallId`)
- **returns:** `{ text, toolCalls: [{ id, name, input }], stopReason }`

Then start the server with `AI_PROVIDER=<name>`. Nothing in the browser changes.

## Configuration

`js/ai/config.js` holds the mode (from `?ai=live`), the proxy endpoint, the request timeout, and the maximum number of tool steps per decision.
