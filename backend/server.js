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
import addressRoutes from './routes/addresses.js';
import notificationRoutes from './routes/notifications.js';
import webhookRoutes from './routes/webhooks.js';
import { getUserRoom, setIO } from './services/socketService.js';
import communityRoutes from './routes/community.js';
import { getPgPool, hasPostgresConfig } from './config/pg.js';
import { registerCommunitySocketHandlers } from './services/communitySocket.js';
import { ensureIndex as ensureElasticIndex } from './services/elasticService.js';
import { ensureSignalsIndex } from './services/recommendationService.js';
import { processDueRecurrences } from './services/recurringService.js';
import { detectIntentText, isDialogflowConfigured } from './services/dialogflowChat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
validateStartupEnv();

const app = express();
const server = http.createServer(app);


function isAllowedOrigin(_) {
    return true;
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
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
app.use(express.json({ limit: '10mb' }));

if (env.mongoUri) {
  mongoose.connect(env.mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      globalThis.process.exit(1);
    });
}

ensureElasticIndex().catch((err) =>
  console.warn('[elastic] index setup skipped:', err.message)
);
ensureSignalsIndex().catch((err) =>
  console.warn('[recommend] signals index setup skipped:', err.message)
);

// ── Recurring events cron ────────────────────────────────────────────────────
// Run once 10s after startup (catches any missed while server was down),
// then every hour to auto-spawn next occurrences.
setTimeout(() => {
  processDueRecurrences().catch(() => {});
}, 10_000);
setInterval(() => {
  processDueRecurrences().catch(() => {});
}, 60 * 60 * 1000); // every hour

if (hasPostgresConfig()) {
  const pgPool = getPgPool();
  pgPool.query('SELECT 1')
    .then(() => console.log('Connected to PostgreSQL'))
    .catch((err) => {
      console.error('PostgreSQL connection error:', err.message);
      console.warn('Community features (PostgreSQL) will be unavailable.');
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
app.use('/api/addresses', addressRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/community', communityRoutes);

// AI chat: Dialogflow (if configured) -> Gemini -> OpenAI
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

    const lastUserMessage = [...openaiMessages].reverse().find((m) => m.role === 'user')?.content?.trim() || '';

    const dfProject = env.dialogflowProjectId.trim();
    if (lastUserMessage && dfProject && isDialogflowConfigured(dfProject)) {
      const rawSession = typeof req.body?.sessionId === 'string' && req.body.sessionId.trim()
        ? req.body.sessionId.trim()
        : 'web-anon';
      const sessionId = rawSession.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'web-session';
      try {
        const dfText = await detectIntentText({
          projectId: dfProject,
          sessionId,
          text: lastUserMessage,
          languageCode: env.dialogflowLanguageCode,
        });
        if (dfText) {
          return sendJson(200, { content: dfText });
        }
      } catch (dfErr) {
        console.error('Dialogflow error:', dfErr?.message || dfErr);
        const hasFallback = Boolean(env.geminiApiKey || env.openAiApiKey);
        if (!hasFallback) {
          return sendJson(502, { message: `Dialogflow: ${dfErr?.message || 'request failed'}` });
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
        message:
          'No chat API configured. Add DIALOGFLOW_PROJECT_ID + Google service account credentials, and/or GEMINI_API_KEY or OPENAI_API_KEY in backend .env',
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

