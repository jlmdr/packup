// Runs one agent decision on a live model: a bounded tool-use loop, then strict output checks.
// Any failure throws, and the gateway falls back to the simulated agent.
import { AI_CONFIG } from './config.js';
import { requestModel, AIError } from './model-client.js';
import { toolSpecs, runTool } from './tool-registry.js';
import { validate } from './schema.js';

const OUTPUT_RULE = 'Reply with a single JSON object that matches the output schema. No prose, no code fences.';

function parseJson(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AIError('Model output was not valid JSON');
  }
}

export async function runLive(spec, input) {
  const system = `${spec.system}\n\nOutput schema:\n${JSON.stringify(spec.output)}\n\n${OUTPUT_RULE}`;
  const tools = toolSpecs(spec.tools);
  const messages = [{ role: 'user', content: spec.prompt(input) }];

  for (let step = 0; step <= AI_CONFIG.maxToolSteps; step += 1) {
    const reply = await requestModel({ capability: spec.name, tier: spec.tier, system, messages, tools });

    if (reply.toolCalls.length) {
      messages.push({ role: 'assistant', content: reply.text, toolCalls: reply.toolCalls });
      reply.toolCalls.forEach((call) => {
        const allowed = spec.tools.includes(call.name);
        const result = allowed ? runTool(call.name, call.input) : { error: `Tool not available: ${call.name}` };
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result) });
      });
      continue;
    }

    const output = parseJson(reply.text);
    // Shape first; the spec's guardrail checks only make sense on a well-formed answer.
    const shape = validate(output, spec.output);
    const problems = shape.length ? shape : (spec.check ? spec.check(output, input) : []);
    if (problems.length) throw new AIError(`Model output rejected: ${problems.slice(0, 3).join('; ')}`);
    return output;
  }
  throw new AIError('Model used too many tool steps');
}
