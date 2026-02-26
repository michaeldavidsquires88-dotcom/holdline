/**
 * Run this once to get your Google Calendar refresh token.
 * Usage: node scripts/get-google-token.js
 */

require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first');
  process.exit(1);
}

const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const authUrl = auth.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Authorize the app');
console.log('3. Paste the code from the redirect URL below:\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Code: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await auth.getToken(code);
    console.log('\n✅ Add this to your .env:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
});
