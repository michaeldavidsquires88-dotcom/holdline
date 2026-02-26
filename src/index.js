require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const twilio = require('twilio');

const { loadSavedSettings, router: settingsRouter } = require('./settings');
const voiceRouter = require('./voice');
const config = require('./config');

// Load persisted settings before anything else
loadSavedSettings();

const app = express();

// Parse Twilio form-encoded webhooks + JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Optionally validate Twilio webhook signatures in production
if (process.env.NODE_ENV === 'production') {
  app.use('/voice', twilio.webhook({ validate: true }));
}

// Static settings UI
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/settings', settingsRouter);
app.use('/voice', voiceRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'HoldLine',
    business: config.business.name,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Root → settings UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║          📞  HoldLine Active         ║
╚══════════════════════════════════════╝
  Business:   ${config.business.name}
  Owner:      ${config.business.ownerName} → ${config.business.ownerPhone}
  Rings:      ${config.business.ringsBeforeAI} before AI
  Calendar:   ${config.calendar.enabled ? '✅ Enabled' : '❌ Disabled'}
  Server:     http://localhost:${PORT}
  Webhook:    ${config.baseUrl}/voice/incoming
══════════════════════════════════════`);
});

module.exports = app;
