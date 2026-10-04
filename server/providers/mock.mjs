// Mock provider: checks the wiring end to end without credentials.
// It makes one tool call where a capability has tools, then returns a fixed, schema-valid answer.
const ANSWERS = {
  'intake.screenItem': { status: 'clear' },
  'intake.writeRiderNote': null, // built from the request below
  'intake.answerQuestion': { message: '(mock model) I can help with items, rates, destinations and addresses.' },
  'deliveryStatus.answer': { kind: 'not_found', message: '(mock model) I could not find that parcel.' },
};
const FIRST_TOOL_INPUT = { text: 'Angeles City' };

export async function complete({ capability, messages, tools = [] }) {
  const usedTool = messages.some((m) => m.role === 'tool');
  if (tools.length && !usedTool) {
    const tool = tools.find((t) => (t.inputSchema.required || []).every((k) => k in FIRST_TOOL_INPUT)) || tools[0];
    return { text: '', toolCalls: [{ id: 'mock-1', name: tool.name, input: FIRST_TOOL_INPUT }], stopReason: 'tool_use' };
  }
  if (capability === 'intake.writeRiderNote') {
    const details = JSON.parse(messages[0].content.replace(/^Booking details:\n/, ''));
    return { text: JSON.stringify({ note: `(mock model) Deliver to ${[details.street, details.barangay].filter(Boolean).join(', ')}.` }), toolCalls: [], stopReason: 'end' };
  }
  // Capabilities without a canned answer return invalid output, which exercises the fallback path.
  return { text: JSON.stringify(ANSWERS[capability] ?? { unexpected: true }), toolCalls: [], stopReason: 'end' };
}
