// get-token.js
// Guides you through Google OAuth and writes GMAIL_REFRESH_TOKEN to ../.env.production

const fs = require('fs');
const http = require('http');
const open = require('open');
const path = require('path');
const { google } = require('googleapis');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
let REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Scopes: Gmail send + Calendar events
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events'
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in ../.env.production');
  process.exit(1);
}

// Helper: update .env.production
function upsertEnvVar(filePath, key, value) {
  const line = `${key}=${value}`;
  let text = '';
  try { text = fs.readFileSync(filePath, 'utf8'); } catch { text = ''; }
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) {
    text = text.replace(re, line);
  } else {
    if (text && !text.endsWith('\n')) text += '\n';
    text += line + '\n';
  }
  fs.writeFileSync(filePath, text, 'utf8');
}

// Try local server flow if redirect is localhost; otherwise fall back to manual paste
async function run() {
  const envFile = path.resolve(__dirname, '../.env.production');

  const useLocalhost =
    REDIRECT_URI &&
    (REDIRECT_URI.startsWith('http://localhost:') || REDIRECT_URI.startsWith('https://localhost:'));

  if (!useLocalhost) {
    console.log('\nNOTE: GOOGLE_REDIRECT_URI is not a localhost URL. Falling back to manual code paste.');
    console.log('If you prefer an automatic flow, add a redirect like http://localhost:53682/oauth2callback in Google Cloud Console and set it in .env.production.\n');
  }

  if (useLocalhost) {
    // Parse port and path
    const url = new URL(REDIRECT_URI);
    const port = parseInt(url.port || '80', 10);
    const callbackPath = url.pathname;

    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES
    });

    // Start local server to catch the code
    const server = http.createServer(async (req, res) => {
      if (req.url.startsWith(callbackPath)) {
        const u = new URL(req.url, `http://localhost:${port}`);
        const code = u.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Auth complete</h1>You can close this window and return to the terminal.');

        try {
          const { tokens } = await oauth2Client.getToken(code);
          if (!tokens.refresh_token) {
            console.error('No refresh_token received. Make sure you checked "consent" and access_type=offline.');
            process.exit(1);
          }
          upsertEnvVar(envFile, 'GMAIL_REFRESH_TOKEN', tokens.refresh_token);
          console.log('\n✅ Wrote GMAIL_REFRESH_TOKEN to ../.env.production');
        } catch (e) {
          console.error('Token exchange failed:', e.message || e);
          process.exit(1);
        } finally {
          server.close();
        }
      } else {
        res.writeHead(404); res.end();
      }
    });

    server.listen(port, () => {
      console.log('Opening browser for Google consent...');
      open(authUrl);
    });

  } else {
    // Manual flow using "urn:ietf:wg:oauth:2.0:oob" legacy-style fallback
    const REDIRECT_OOB = 'urn:ietf:wg:oauth:2.0:oob';
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_OOB);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES
    });
    console.log('\nOpen this URL in your browser:');
    console.log(authUrl);
    console.log('\nAfter accepting, you will get a code. Paste it here and press Enter:\n');

    process.stdout.write('Code: ');
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', async (code) => {
      code = code.trim();
      try {
        const { tokens } = await oauth2Client.getToken(code);
        if (!tokens.refresh_token && tokens.access_token) {
          console.log('\nGoogle did not return a refresh token. You may need to revoke the app and try again with prompt=consent.');
        }
        if (tokens.refresh_token) {
          upsertEnvVar(envFile, 'GMAIL_REFRESH_TOKEN', tokens.refresh_token);
          console.log('\n✅ Wrote GMAIL_REFRESH_TOKEN to ../.env.production');
        } else {
          console.error('❌ No refresh token obtained.');
        }
      } catch (e) {
        console.error('Token exchange failed:', e.message || e);
        process.exit(1);
      } finally {
        process.exit(0);
      }
    });
  }
}

run().catch(err => { console.error(err); process.exit(1); });
