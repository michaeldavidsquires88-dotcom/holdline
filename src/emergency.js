const config = require('./config');

/**
 * Check if text contains any emergency keywords
 */
function isEmergency(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return config.business.emergencyKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Format emergency SMS to contractor
 */
function formatEmergencySMS({ callerName, callerNumber, issue, address, aiResponse, timestamp }) {
  return `🚨 EMERGENCY CALL
From: ${callerName || 'Unknown'} (${callerNumber || 'Unknown'})
Issue: "${issue || 'Not specified'}"
Address: ${address || 'Not provided'}
Time: ${timestamp || new Date().toLocaleString()}

AI told customer: "${aiResponse || 'Mike will call you within 30 minutes.'}"
----
Reply CALL to connect`;
}

/**
 * Format new lead SMS to contractor
 */
function formatLeadSMS({ callerName, callerNumber, service, timeline, address, callbackPromise, weeksOut, timestamp }) {
  return `📋 NEW LEAD
From: ${callerName || 'Unknown'} (${callerNumber || 'Unknown'})
Service: ${service || 'Not specified'}
Timeline: ${timeline || 'Not specified'}
Address: ${address || 'Not provided'}
AI Promise: You'll call ${callbackPromise || 'by 6pm'}, ${weeksOut || '3 weeks'} out
Time: ${timestamp || new Date().toLocaleString()}`;
}

module.exports = { isEmergency, formatEmergencySMS, formatLeadSMS };
