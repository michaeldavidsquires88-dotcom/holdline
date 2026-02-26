const twilio = require('twilio');
const config = require('./config');
const { formatEmergencySMS, formatLeadSMS } = require('./emergency');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Send SMS to contractor with call details
 */
async function notifyContractor(data, callerNumber) {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });

  let message;

  if (data.isEmergency) {
    message = formatEmergencySMS({
      callerName: data.callerName,
      callerNumber: data.callerPhone || callerNumber,
      issue: data.issue,
      address: data.address,
      aiResponse: data.aiResponse,
      timestamp,
    });
  } else {
    message = formatLeadSMS({
      callerName: data.callerName,
      callerNumber: data.callerPhone || callerNumber,
      service: data.service,
      timeline: data.timeline,
      address: data.address,
      callbackPromise: config.business.callbackPromise,
      weeksOut: config.business.weeksOutTimeline,
      timestamp,
    });

    // Append appointment slot if calendar booking was made
    if (data.appointmentSlot) {
      message += `\n📅 HOLD BOOKED: ${data.appointmentSlot}\n(Awaiting your confirmation)`;
    }
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: config.twilio.phoneNumber,
      to: config.business.ownerPhone,
    });
    console.log(`📱 SMS sent to contractor: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('SMS send error:', err.message);
    throw err;
  }
}

module.exports = { notifyContractor };
