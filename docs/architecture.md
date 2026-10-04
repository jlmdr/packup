# Architecture

## Prototype

```
UI screens (js/ui)  →  agent gateway (js/agents/index.js)  →  agents or live model (js/agents, js/ai)
                                                            →  typed tools (js/tools)  →  store + data (js/core, js/data)
```

- **Store** (`js/core/store.js`) is the system of record: bookings, riders, the draft plan. It issues reference codes and emits change events; screens re-render on those events.
- **Tools** are small read-only functions over the store and data. They define exactly what each agent can see, which is how the delivery status agent stays read-only.
- **Agents** take tool results and return a structured decision (for example `{ status: 'ask', message, options }`). The UI renders the decision; it never contains agent logic.
- **Simulation** (`js/core/simulation.js`) stands in for the rider app: it moves riders across the schematic map and records delivery events.

## Swapping in a real model

Screens call the agent gateway (`js/agents/index.js`), never an agent directly. The gateway runs each decision on the simulated agent or, with `?ai=live`, on a model through the backend proxy, with the same tools, output shape and guardrails. See [ai-integration.md](ai-integration.md).

## Production target

- Models on AWS Bedrock, with a fast tier for intake and customer questions and a stronger tier for assignment
- A LangGraph orchestrator once events span agents (a failed delivery that needs an address fix, a reschedule and a customer update)
- PostgreSQL on Amazon RDS for bookings and riders
- Google Maps Platform for maps and address validation
- A rider mobile app for live location and delivery events
