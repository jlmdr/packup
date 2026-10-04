// Agent gateway: the only way screens ask an agent for a decision.
// Every capability is async and returns the same shape in both modes:
//   simulated: the local agent logic in this folder (default; no backend needed)
//   live:      a model via the backend proxy, with tools and guardrails from specs.js
// If a live call fails or breaks a guardrail, the simulated agent answers instead.
import { AI_CONFIG } from '../ai/config.js';
import { runLive } from '../ai/run-agent.js';
import { SPECS } from './specs.js';
import { checkAddressFields, screenItem, checkDuplicate, writeRiderNote } from './intake.js';
import { answerBookingQuestion } from './booking-help.js';
import { planMorningBatch } from './assignment.js';
import { answer } from './delivery-status.js';

// Simulated counterparts, with a short pause so a decision reads as a step in the demo.
const SIMULATED = {
  'intake.checkAddress': { latency: 450, run: ({ fields, flags }) => checkAddressFields(fields, flags) },
  'intake.screenItem': { latency: 350, run: ({ description }) => screenItem(description) },
  'intake.writeRiderNote': { latency: 0, run: (input) => ({ note: writeRiderNote(input) }) },
  'intake.answerQuestion': { latency: 450, run: ({ question }) => answerBookingQuestion(question) },
  'intake.checkDuplicate': { latency: 0, run: (input) => checkDuplicate(input) }, // a data lookup: never sent to a model
  'assignment.planBatch': { latency: 900, run: () => planMorningBatch() },
  'deliveryStatus.answer': { latency: 500, run: ({ question }) => answer(question) },
};

const fallbackListeners = new Set();
const pause = (ms) => (ms ? new Promise((resolve) => { setTimeout(resolve, ms); }) : Promise.resolve());

async function decide(name, input) {
  const spec = SPECS[name];
  if (AI_CONFIG.mode === 'live' && spec) {
    try {
      return await runLive(spec, input);
    } catch (err) {
      console.warn(`[agents] ${name} fell back to the simulated agent:`, err.message);
      fallbackListeners.forEach((fn) => fn({ capability: name, error: err }));
    }
  }
  const simulated = SIMULATED[name];
  await pause(simulated.latency);
  return simulated.run(input);
}

export const agents = {
  intake: {
    checkAddress: (fields, flags) => decide('intake.checkAddress', { fields, flags }),
    screenItem: (description) => decide('intake.screenItem', { description }),
    writeRiderNote: (details) => decide('intake.writeRiderNote', details),
    answerQuestion: (question) => decide('intake.answerQuestion', { question }),
    checkDuplicate: (details) => decide('intake.checkDuplicate', details),
  },
  assignment: {
    planBatch: () => decide('assignment.planBatch', {}),
  },
  deliveryStatus: {
    answer: (question) => decide('deliveryStatus.answer', { question }),
  },
};

/** Called when a live decision falls back to the simulated agent. Returns an unsubscribe function. */
export function onFallback(fn) {
  fallbackListeners.add(fn);
  return () => fallbackListeners.delete(fn);
}

export const engineLabel = () => (AI_CONFIG.mode === 'live' ? 'Live model' : 'Simulated');
