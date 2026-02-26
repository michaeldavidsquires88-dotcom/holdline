const NodeCache = require('node-cache');

// Sessions expire after 10 minutes of inactivity
const cache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

/**
 * Get or create a call session
 */
function getSession(callSid) {
  return cache.get(callSid) || {
    callSid,
    messages: [],      // Full conversation history for OpenAI
    data: {},          // Collected data (name, number, etc.)
    notified: false,   // Whether contractor SMS was sent
    turnCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Save session
 */
function saveSession(callSid, session) {
  cache.set(callSid, session);
}

/**
 * End a session
 */
function endSession(callSid) {
  cache.del(callSid);
}

/**
 * Add a message to session history
 */
function addMessage(session, role, content) {
  session.messages.push({ role, content });
  session.turnCount++;
  return session;
}

module.exports = { getSession, saveSession, endSession, addMessage };
