const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');
const { isEmergency } = require('./emergency');
const { getAvailableSlots } = require('./calendar');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

/**
 * Build the system prompt for the AI scheduling assistant
 */
async function buildSystemPrompt(calendarSlots) {
  const { name: businessName, ownerName, weeksOutTimeline, callbackPromise } = config.business;

  let calendarSection = '';
  if (config.calendar.enabled && calendarSlots && calendarSlots.length > 0) {
    const slotList = calendarSlots.map((s, i) => `  ${i + 1}. ${s.label}`).join('\n');
    calendarSection = `
CALENDAR (Tier 2 enabled):
You have access to ${ownerName}'s calendar. These are the next available appointment slots:
${slotList}

When scheduling, offer 2 of these options to the customer. Ask them to pick one.
Tell them it's a HOLD and ${ownerName} will confirm.
When they pick a slot, confirm it and note in your collected_data which slot they chose (use the exact label).`;
  } else {
    calendarSection = `
SCHEDULING:
${ownerName} is booking about ${weeksOutTimeline} out right now.
Do NOT offer specific time slots. Tell the customer ${ownerName} will call them ${callbackPromise} to schedule.`;
  }

  return `You are a professional scheduling assistant for ${businessName}. Your name is not important — you are "the scheduling assistant."

${ownerName} is on a job site and cannot answer the phone right now.

YOUR GOAL: Collect the caller's information, understand their need, and give them a helpful response.

CONVERSATION FLOW:
1. Greet them and ask if this is an EMERGENCY or they want to SCHEDULE A QUOTE.
2. Based on their answer:
   - EMERGENCY: Collect name, callback number, address, and what's happening. Reassure them ${ownerName} will call within 30 minutes.
   - QUOTE/SCHEDULING: Collect name, callback number, address, what service they need, and their timeline preference.
3. Confirm the information and close warmly.

EMERGENCY SIGNALS: flood, burst pipe, no heat, water everywhere, gas leak, electrical fire, sewage backup, no power, sparks, furnace out.
If you detect ANY of these, treat it as an EMERGENCY immediately.

${calendarSection}

TONE: Warm, professional, efficient. You represent ${businessName}. Don't ramble. Keep responses concise.

IMPORTANT - At the end of EVERY response, include a JSON block on its own line in this exact format:
<data>{"type":"collecting|emergency|quote|complete","callerName":"","callerPhone":"","address":"","issue":"","service":"","timeline":"","isEmergency":false,"appointmentSlot":"","aiResponse":""}</data>

- type: "collecting" while still gathering info, "emergency" if emergency detected, "quote" for quote requests, "complete" when done
- Fill in fields as you collect them (leave empty string if not yet collected)
- isEmergency: true if emergency keywords detected
- aiResponse: the exact message you told the customer (for SMS to contractor)
- appointmentSlot: only if calendar enabled and customer chose a slot

Never mention this JSON to the caller. It is invisible to them.`;
}

/**
 * Parse the data block from AI response
 */
function parseDataBlock(text) {
  const match = text.match(/<data>(.*?)<\/data>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Strip the data block from the visible response text
 */
function stripDataBlock(text) {
  return text.replace(/<data>.*?<\/data>/gs, '').trim();
}

/**
 * Run one turn of the AI conversation
 * @param {Array} messages - Full conversation history [{role, content}]
 * @param {Object} options
 * @returns {{ reply: string, data: Object|null, visibleText: string }}
 */
async function chat(messages, options = {}) {
  try {
    // Get calendar slots if enabled (cache would be better but keep it simple)
    let calendarSlots = null;
    if (config.calendar.enabled) {
      calendarSlots = await getAvailableSlots(4);
    }

    const systemPrompt = await buildSystemPrompt(calendarSlots);

    const completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    });

    const raw = completion.content[0].text;
    const data = parseDataBlock(raw);
    const visibleText = stripDataBlock(raw);

    return { raw, visibleText, data };
  } catch (err) {
    console.error('Claude API error:', err.message);
    // Fallback response
    return {
      raw: null,
      visibleText: `I'm sorry, I'm having a technical issue right now. Please leave a message after the tone, or call back shortly.`,
      data: null,
      error: true,
    };
  }
}

/**
 * Generate the opening greeting
 */
async function getOpeningGreeting() {
  const { name: businessName, ownerName } = config.business;
  return `Hi, thanks for calling ${businessName}. I'm the scheduling assistant — ${ownerName} is on a job site right now. Is this an emergency, or are you looking to schedule a quote?`;
}

module.exports = { chat, getOpeningGreeting, parseDataBlock, stripDataBlock };
