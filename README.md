# 📞 HoldLine

**AI-powered phone answering service for contractors.** Answers missed calls, handles emergencies, captures leads, and texts you instantly.

---

## How It Works

1. Your Twilio number rings your cell for 4–6 rings (your choice)
2. If you don't answer → AI picks up
3. AI greets the caller as your scheduling assistant
4. Detects emergency vs. quote request
5. Collects their info, gives them a promise
6. Texts you immediately with the details

---

## Quick Start (15 minutes)

### 1. Clone & Install

```bash
git clone <your-repo>
cd holdline
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your details:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+14165551234   # Your Twilio number
OPENAI_API_KEY=sk-xxxxxxxx
BUSINESS_NAME=Mike's Plumbing
OWNER_NAME=Mike
OWNER_PHONE=+14165559999           # YOUR cell for SMS alerts
RINGS_BEFORE_AI=4
BASE_URL=https://your-app.onrender.com
```

### 3. Deploy to Render (Recommended)

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Add all environment variables from `.env`
5. Deploy — get your URL (e.g. `https://holdline-abc123.onrender.com`)
6. Set `BASE_URL` to that URL in Render env vars

### 4. Configure Twilio

1. Go to [console.twilio.com](https://console.twilio.com)
2. Phone Numbers → Manage → Your Number
3. Under **Voice & Fax**:
   - **A call comes in**: Webhook → `https://your-app.onrender.com/voice/incoming`
   - Method: **HTTP POST**
4. Save

### 5. Test It

Call your Twilio number. Don't answer. The AI will pick up after 4 rings!

---

## SMS Alerts You'll Receive

**Emergency:**
```
🚨 EMERGENCY CALL
From: Sarah Johnson (+14165551234)
Issue: "pipe burst in basement, water everywhere"
Address: 123 Oak Street
Time: Feb 21 3:42 PM

AI told customer: "Mike will call you within 30 minutes."
----
Reply CALL to connect
```

**New Lead:**
```
📋 NEW LEAD
From: John Smith (+14165559876)
Service: kitchen faucet replacement
Timeline: next 2 weeks
Address: 456 Maple Ave
AI Promise: You'll call by 6pm, 3 weeks out
Time: Feb 21 2:15 PM
```

---

## Settings Dashboard

Visit `https://your-app.onrender.com` to update settings without touching code.

You can change:
- Business name and owner name
- Rings before AI (4, 5, or 6)
- Booking timeline ("3 weeks")
- Callback promise ("by 6pm today")
- Emergency keywords

---

## Tier 2: Google Calendar Scheduling

When enabled, the AI can see your calendar and offer specific appointment slots.

### Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google Calendar API**
3. Create **OAuth 2.0 credentials** (Web Application)
4. Add authorized redirect URI: `http://localhost:3000/auth/callback`
5. Download credentials

### Get a Refresh Token

```bash
# Install google-auth-library
npm install google-auth-library

# Run the auth helper
node scripts/get-google-token.js
```

Follow the printed URL, authorize, paste the code. You'll get a `refresh_token`.

6. Add to `.env`:
```env
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_CALENDAR_ID=primary
APPOINTMENT_DURATION_MINUTES=60
```

---

## Local Development

```bash
# Install ngrok for tunneling
npm install -g ngrok

# Terminal 1: Start server
npm run dev

# Terminal 2: Tunnel to internet
ngrok http 3000
```

Set your Twilio webhook to the ngrok URL: `https://xxxx.ngrok.io/voice/incoming`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | ✅ | From Twilio console |
| `TWILIO_AUTH_TOKEN` | ✅ | From Twilio console |
| `TWILIO_PHONE_NUMBER` | ✅ | Your Twilio number (+E.164) |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key (console.anthropic.com) |
| `OWNER_PHONE` | ✅ | Your cell for SMS (+E.164) |
| `BASE_URL` | ✅ | Your deployed URL (no trailing slash) |
| `BUSINESS_NAME` | ✅ | e.g. "Mike's Plumbing" |
| `OWNER_NAME` | ✅ | Your first name |
| `RINGS_BEFORE_AI` | ✅ | 4, 5, or 6 |
| `WEEKS_OUT_TIMELINE` | ✅ | e.g. "3 weeks" |
| `CALLBACK_PROMISE` | ✅ | e.g. "by 6pm today" |
| `EMERGENCY_KEYWORDS` | ✅ | Comma-separated list |
| `GOOGLE_CALENDAR_ENABLED` | ❌ | "true" to enable Tier 2 |
| `GOOGLE_CLIENT_ID` | Tier 2 | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Tier 2 | Google OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Tier 2 | OAuth refresh token |
| `GOOGLE_CALENDAR_ID` | Tier 2 | Calendar ID (default: "primary") |
| `APPOINTMENT_DURATION_MINUTES` | Tier 2 | 30, 60, 120, or 240 |

---

## Failsafe

If OpenAI fails for any reason, the system automatically falls back to:
> "I'm sorry, I'm experiencing a technical issue. Please leave a message after the tone."

Twilio then records a voicemail and sends you an SMS with the recording link.

---

## Tech Stack

- **Node.js + Express** — Backend server
- **Twilio** — Phone number, call routing, SMS
- **Claude (Anthropic)** — Conversation AI (claude-haiku-4-5-20251001)
- **Google Calendar API** — Appointment scheduling (Tier 2)
- **Render** — Recommended deployment platform

---

## Troubleshooting

**AI not picking up?**
- Check Twilio webhook URL is exactly `{BASE_URL}/voice/incoming`
- Verify `BASE_URL` env var matches your deployment URL

**Not receiving SMS?**
- Confirm `OWNER_PHONE` is in +E.164 format (e.g. `+14165551234`)
- Check Twilio account has SMS enabled

**AI giving wrong business name?**
- Update `BUSINESS_NAME` in env vars and restart

**Calls going straight to AI (not ringing you first)?**
- Confirm `OWNER_PHONE` is set correctly
- Check `RINGS_BEFORE_AI` is set to 4, 5, or 6
