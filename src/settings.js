const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const ENV_FILE = path.join(__dirname, '..', '.env');
const SETTINGS_FILE = path.join(__dirname, '..', 'settings.json');

const EDITABLE_KEYS = [
  'BUSINESS_NAME',
  'OWNER_NAME',
  'OWNER_PHONE',
  'RINGS_BEFORE_AI',
  'WEEKS_OUT_TIMELINE',
  'CALLBACK_PROMISE',
  'EMERGENCY_KEYWORDS',
  'GOOGLE_CALENDAR_ENABLED',
  'APPOINTMENT_DURATION_MINUTES',
  'BASE_URL',
];

/**
 * GET /api/settings - Return current settings (safe subset)
 */
router.get('/', (req, res) => {
  const settings = {};
  EDITABLE_KEYS.forEach(key => {
    settings[key] = process.env[key] || '';
  });
  res.json(settings);
});

/**
 * POST /api/settings - Save settings to file and update process.env
 */
router.post('/', (req, res) => {
  const updates = req.body;

  // Only allow editable keys
  const filtered = {};
  EDITABLE_KEYS.forEach(key => {
    if (updates[key] !== undefined) {
      filtered[key] = updates[key];
    }
  });

  // Update process.env immediately (takes effect without restart for most settings)
  Object.entries(filtered).forEach(([key, val]) => {
    process.env[key] = val;
  });

  // Also save to settings.json for persistence across restarts
  let existing = {};
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      existing = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}

  const merged = { ...existing, ...filtered };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));

  console.log('⚙️  Settings updated:', Object.keys(filtered).join(', '));
  res.json({ ok: true, updated: Object.keys(filtered) });
});

/**
 * Load saved settings on startup
 */
function loadSavedSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      Object.entries(saved).forEach(([key, val]) => {
        if (EDITABLE_KEYS.includes(key) && !process.env[key]) {
          process.env[key] = val;
        }
      });
      console.log('⚙️  Loaded saved settings from settings.json');
    }
  } catch (err) {
    console.warn('Could not load settings.json:', err.message);
  }
}

module.exports = { router, loadSavedSettings };
