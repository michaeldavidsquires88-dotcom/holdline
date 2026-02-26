require('dotenv').config();

const config = {
  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Anthropic
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Business
  business: {
    name: process.env.BUSINESS_NAME || "Mike's Plumbing",
    ownerName: process.env.OWNER_NAME || 'Mike',
    ownerPhone: process.env.OWNER_PHONE,
    ringsBeforeAI: parseInt(process.env.RINGS_BEFORE_AI || '4'),
    weeksOutTimeline: process.env.WEEKS_OUT_TIMELINE || '3 weeks',
    callbackPromise: process.env.CALLBACK_PROMISE || 'by 6pm today',
    emergencyKeywords: (process.env.EMERGENCY_KEYWORDS || 'flood,burst,no heat,leaking,water everywhere,emergency,furnace out,electrical fire,gas leak,sewage,no power,sparks')
      .split(',')
      .map(k => k.trim().toLowerCase()),
  },

  // Server
  port: parseInt(process.env.PORT || '3000'),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // Google Calendar (Tier 2)
  calendar: {
    enabled: process.env.GOOGLE_CALENDAR_ENABLED === 'true',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    appointmentDurationMinutes: parseInt(process.env.APPOINTMENT_DURATION_MINUTES || '60'),
  },
};

// Validate required fields
function validate() {
  const required = [
    ['TWILIO_ACCOUNT_SID', config.twilio.accountSid],
    ['TWILIO_AUTH_TOKEN', config.twilio.authToken],
    ['TWILIO_PHONE_NUMBER', config.twilio.phoneNumber],
    ['ANTHROPIC_API_KEY', config.anthropic.apiKey],
    ['OWNER_PHONE', config.business.ownerPhone],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);
  if (missing.length > 0) {
    console.warn(`⚠️  Missing env vars: ${missing.join(', ')}`);
  }
}

validate();

module.exports = config;
