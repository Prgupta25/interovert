/* eslint-env node */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env, { validateStartupEnv } from './config/env.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import notificationRoutes from './routes/notifications.js';
import webhookRoutes from './routes/webhooks.js';
import { getUserRoom, setIO } from './services/socketService.js';
import communityRoutes from './routes/community.js';
import { getPgPool, hasPostgresConfig } from './config/pg.js';
import { registerCommunitySocketHandlers } from './services/communitySocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
validateStartupEnv();

const app = express();
const server = http.createServer(app);
const localhostOriginRegex = /^https?:\/\/localhost(:\d+)?$/;
const vercelPreviewOriginRegex = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/;
const normalizedFrontendUrl = (env.frontendUrl || '').replace(/\/$/, '');

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/$/, '');
  return localhostOriginRegex.test(normalizedOrigin)
    || vercelPreviewOriginRegex.test(normalizedOrigin)
    || (normalizedFrontendUrl && normalizedOrigin === normalizedFrontendUrl);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST'],
  },
});
setIO(io);

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

if (env.mongoUri) {
  mongoose.connect(env.mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      globalThis.process.exit(1);
    });
}

if (hasPostgresConfig()) {
  const pgPool = getPgPool();
  pgPool.query('SELECT 1')
    .then(() => console.log('Connected to PostgreSQL'))
    .catch((err) => {
      console.error('PostgreSQL connection error:', err.message);
      globalThis.process.exit(1);
    });
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.warn('[socket] auth failed: token missing');
      return next(new Error('Unauthorized socket'));
    }
    const decoded = jwt.verify(token, env.jwtSecret);
    socket.userId = decoded.userId;
    console.log('[socket] auth ok:', String(socket.userId));
    next();
  } catch (error) {
    console.warn('[socket] auth failed:', error?.message || 'invalid token');
    next(new Error('Unauthorized socket'));
  }
});

io.on('connection', (socket) => {
  console.log('[socket] connected:', socket.id, 'user:', String(socket.userId));
  socket.join(getUserRoom(socket.userId));
  registerCommunitySocketHandlers(io, socket);
  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', socket.id, 'reason:', reason);
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running properly' });
});

app.use('/api', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/community', communityRoutes);

function extractAskyText(payload) {
  const seen = new Set();
  const pick = (value, depth = 0) => {
    if (value == null || depth > 4) return '';
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return '';
      // Avoid returning obvious metadata-only values.
      if (/^[A-Za-z0-9_-]{24,}$/.test(text) && !/\s/.test(text)) return '';
      return text;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return '';
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = pick(item, depth + 1);
        if (found) return found;
      }
      return '';
    }
    if (typeof value === 'object') {
      if (seen.has(value)) return '';
      seen.add(value);

      const priorityKeys = ['content', 'response', 'answer', 'text', 'message', 'output', 'result'];
      for (const key of priorityKeys) {
        if (Object.hasOwn(value, key)) {
          const found = pick(value[key], depth + 1);
          if (found) return found;
        }
      }

      for (const key of Object.keys(value)) {
        const found = pick(value[key], depth + 1);
        if (found) return found;
      }
    }
    return '';
  };

  return pick(payload);
}

// Ask AI chat - Asky -> Gemini -> OpenAI fallback
app.post('/api/chat', async (req, res) => {
  const sendJson = (status, body) => {
    if (!res.headersSent) res.status(status).json(body);
  };

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return sendJson(400, { message: 'messages array is required' });
    }

    const openaiMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const askyKey = env.askyApiKey;
    const askyAuthToken = env.askyAuthToken;
    if (askyKey || askyAuthToken) {
      const endpoint = env.askyChatEndpoint
        || `${env.askyBaseUrl.replace(/\/$/, '')}/chat/completions`;
      const isAskyChatWebEndpoint = /askaichat\.app\/api\/chat\/message\/send/i.test(endpoint);
      const lastUserMessage = [...openaiMessages].reverse().find((m) => m.role === 'user')?.content || '';

      if (isAskyChatWebEndpoint && !askyAuthToken) {
        if (!env.geminiApiKey && !env.openAiApiKey) {
          return sendJson(502, { message: 'ASKY_AUTH_TOKEN is required for askaichat.app endpoint' });
        }
      }

      const authHeaderValue = askyAuthToken || `Bearer ${askyKey}`;
      try {
        const requestBody = isAskyChatWebEndpoint
          ? {
              message: lastUserMessage,
              model: env.askyModel || 'gpt-5-nano',
              temporaryChat: env.askyTemporaryChat,
              ...(env.askyModelVersion ? { modelVersion: env.askyModelVersion } : {}),
            }
          : {
              model: env.askyModel,
              messages: openaiMessages,
            };

        const askyResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            authorization: authHeaderValue,
            ...(isAskyChatWebEndpoint
              ? {
                  origin: 'https://askaichat.app',
                  referer: 'https://askaichat.app/chat',
                  'user-agent': 'Mozilla/5.0',
                }
              : {}),
          },
          body: JSON.stringify(requestBody),
        });

        const askyRaw = await askyResponse.text();
        let askyData = {};
        try {
          askyData = askyRaw ? JSON.parse(askyRaw) : {};
        } catch {
          askyData = { raw: askyRaw };
        }

        if (askyResponse.ok) {
          const content = extractAskyText(askyData);
          if (content) {
            return sendJson(200, { content });
          }

          if (!env.geminiApiKey && !env.openAiApiKey) {
            return sendJson(502, {
              message: `Asky returned empty response (status ${askyResponse.status}). Check ASKY_AUTH_TOKEN and endpoint format.`,
              askyPreview: askyRaw.slice(0, 300),
            });
          }
        }

        const askyMessage = askyData?.error?.message
          || askyData?.message
          || askyResponse.statusText
          || 'Asky request failed';

        if (!env.geminiApiKey && !env.openAiApiKey) {
          return sendJson(502, { message: `Asky request failed: ${askyMessage}` });
        }
      } catch (askyError) {
        if (!env.geminiApiKey && !env.openAiApiKey) {
          return sendJson(502, { message: `Asky network error: ${askyError.message}` });
        }
      }
    }

    const geminiKey = env.geminiApiKey;
    if (geminiKey) {
      // Use Gemini (free API) - only user/model, non-empty text
      const contents = messages
        .filter((m) => m.content && String(m.content).trim())
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content).trim() }],
        }));

      if (contents.length === 0) {
        return sendJson(400, { message: 'No valid messages to send' });
      }

      // Try current Gemini model names; Google AI Studio may expose different models
      const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
      const apiVersions = ['v1beta', 'v1'];
      let lastError = '';
      for (const version of apiVersions) {
        for (const model of modelsToTry) {
          const response = await fetch(
          `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          }
        );
        const body = await response.text();
        if (response.ok) {
          const data = JSON.parse(body);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          const blockReason = data.candidates?.[0]?.finishReason;
          if (blockReason && blockReason !== 'STOP' && blockReason !== 'MAX_TOKENS') {
            return sendJson(502, { message: 'Response was blocked or unavailable' });
          }
          return sendJson(200, { content: text || '' });
        }
        try {
          const err = JSON.parse(body);
          lastError = err.error?.message || err.message || body;
        } catch {
          lastError = body || response.statusText;
        }
        if (!lastError.includes('not found') && !lastError.includes('is not supported')) break;
        }
      }
      const isQuotaError = /quota|exceeded|rate.limit|retry\s+in/i.test(lastError);
      if (isQuotaError && env.openAiApiKey) {
        // Fall through to OpenAI when Gemini quota is exceeded
      } else if (isQuotaError) {
        return sendJson(429, {
          message: 'Gemini free tier quota exceeded. Wait a minute and try again, or add OPENAI_API_KEY to .env to use OpenAI when quota is exceeded. See https://ai.google.dev/gemini-api/docs/rate-limits',
        });
      } else {
        return sendJson(502, { message: lastError || 'Gemini request failed. Check your API key at https://aistudio.google.com/apikey' });
      }
    }

    // OpenAI (primary if no Gemini key, or fallback when Gemini quota exceeded)
    const apiKey = env.openAiApiKey;
    if (!apiKey) {
      return sendJson(500, {
        message: 'No chat API key configured. Add ASKY_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY to backend .env',
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: openaiMessages,
      }),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      let errMessage = response.statusText || 'OpenAI request failed';
      try {
        const err = JSON.parse(rawBody);
        errMessage = err.error?.message || errMessage;
      } catch { /* ignore */ }
      return sendJson(response.status >= 500 ? 502 : response.status, { message: errMessage });
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return sendJson(502, { message: 'Invalid response from OpenAI' });
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    return sendJson(200, { content });
  } catch (error) {
    console.error('Chat API error:', error);
    if (!res.headersSent) res.status(500).json({ message: error.message || 'Chat failed' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    message: 'Something went wrong!',
    error: env.nodeEnv === 'development' ? err.message : undefined,
  });
});

const port = env.port;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

