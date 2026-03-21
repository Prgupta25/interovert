import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const DIALOGFLOW_SCOPE = 'https://www.googleapis.com/auth/dialogflow';
const BACKEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveServiceAccountKeyPath(keyFile) {
  const trimmed = keyFile.trim();
  if (!trimmed) return '';
  if (path.isAbsolute(trimmed)) return trimmed;
  const inBackend = path.join(BACKEND_ROOT, trimmed);
  if (fs.existsSync(inBackend)) return inBackend;
  const fromCwd = path.resolve(process.cwd(), trimmed);
  return fromCwd;
}

function getGoogleAuthOptions() {
  const raw = globalThis.process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw?.trim()) {
    try {
      return { credentials: JSON.parse(raw), scopes: [DIALOGFLOW_SCOPE] };
    } catch {
      return null;
    }
  }
  const keyFile = globalThis.process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile?.trim()) {
    const resolved = resolveServiceAccountKeyPath(keyFile);
    if (resolved && fs.existsSync(resolved)) {
      return { keyFilename: resolved, scopes: [DIALOGFLOW_SCOPE] };
    }
    return null;
  }
  return null;
}

export function isDialogflowConfigured(projectId) {
  return Boolean(projectId?.trim() && getGoogleAuthOptions());
}

function fulfillmentFromQueryResult(queryResult) {
  if (!queryResult) return '';
  if (queryResult.fulfillmentText) return String(queryResult.fulfillmentText).trim();
  const parts = [];
  for (const m of queryResult.fulfillmentMessages || []) {
    if (m.text?.text?.length) {
      parts.push(m.text.text.join(' '));
    }
  }
  return parts.join('\n').trim();
}

export async function detectIntentText({ projectId, sessionId, text, languageCode = 'en' }) {
  const authOpts = getGoogleAuthOptions();
  if (!authOpts) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON');
  }

  const auth = new GoogleAuth(authOpts);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error('Could not obtain Google access token');
  }

  const safeSession = encodeURIComponent(sessionId);
  const url = `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/${safeSession}:detectIntent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      queryInput: {
        text: { text, languageCode },
      },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    let message = bodyText || res.statusText;
    try {
      const err = JSON.parse(bodyText);
      message = err.error?.message || message;
    } catch {
      /* keep bodyText */
    }
    throw new Error(message || `Dialogflow HTTP ${res.status}`);
  }

  const data = JSON.parse(bodyText);
  return fulfillmentFromQueryResult(data.queryResult);
}
