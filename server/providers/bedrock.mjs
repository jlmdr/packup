// Amazon Bedrock adapter, using the Converse API (one request format across Bedrock models).
// Needs: npm install @aws-sdk/client-bedrock-runtime, AWS credentials in the environment,
// AWS_REGION, and model ids for each tier in MODEL_FAST and MODEL_STRONG.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const MODELS = { fast: process.env.MODEL_FAST, strong: process.env.MODEL_STRONG || process.env.MODEL_FAST };

// Provider-neutral messages → Converse messages. Tool results travel in a user turn.
function toConverse(messages) {
  const out = [];
  const push = (role, block) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };
  messages.forEach((m) => {
    if (m.role === 'user') push('user', { text: m.content });
    if (m.role === 'assistant') {
      if (m.content) push('assistant', { text: m.content });
      (m.toolCalls || []).forEach((c) => push('assistant', { toolUse: { toolUseId: c.id, name: c.name, input: c.input } }));
    }
    if (m.role === 'tool') push('user', { toolResult: { toolUseId: m.toolCallId, content: [{ json: JSON.parse(m.content) }] } });
  });
  return out;
}

export async function complete({ tier = 'fast', system, messages, tools = [] }) {
  const modelId = MODELS[tier];
  if (!modelId) throw new Error(`No model configured for tier "${tier}"`);
  const response = await client.send(new ConverseCommand({
    modelId,
    system: [{ text: system }],
    messages: toConverse(messages),
    inferenceConfig: { maxTokens: 2000, temperature: 0 },
    ...(tools.length && {
      toolConfig: { tools: tools.map((t) => ({ toolSpec: { name: t.name, description: t.description, inputSchema: { json: t.inputSchema } } })) },
    }),
  }));
  const blocks = response.output?.message?.content || [];
  return {
    text: blocks.filter((b) => b.text).map((b) => b.text).join(''),
    toolCalls: blocks.filter((b) => b.toolUse).map((b) => ({ id: b.toolUse.toolUseId, name: b.toolUse.name, input: b.toolUse.input })),
    stopReason: response.stopReason,
  };
}
