import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config/config';
import { getAuthToken } from '../utils/session';
import apiClient from '../services/apiClient';

function normId(v) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/-/g, '');
}

export function useEventChat(eventId, chatId) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [messagesReady, setMessagesReady] = useState(false);
  const viewerIdRef = useRef('');

  const upsertMessage = (incoming) => {
    if (!incoming?.id) return;
    const vid = viewerIdRef.current;
    const isMine =
      incoming.is_mine !== undefined
        ? incoming.is_mine
        : Boolean(vid && normId(incoming.sender_id) === normId(vid));
    const normalized = { ...incoming, is_mine: Boolean(isMine) };
    setMessages((prev) => {
      const exists = prev.some((m) => String(m.id) === String(normalized.id));
      return exists ? prev : [...prev, normalized];
    });
  };

  const socket = useMemo(() => {
    const token = getAuthToken();
    if (!token || !eventId || !chatId) return null;
    return io(API_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 8000,
    });
  }, [eventId, chatId]);

  useEffect(() => {
    if (!chatId) return undefined;
    return () => {
      apiClient.post(`/api/community/chats/${encodeURIComponent(chatId)}/read`).catch(() => {});
    };
  }, [chatId]);

  useEffect(() => {
    let ignore = false;
    setMessagesReady(false);
    const loadMessages = async () => {
      if (!chatId) {
        if (!ignore) setMessagesReady(true);
        return;
      }
      try {
        const { data } = await apiClient.get(`/api/community/chats/${chatId}/messages?limit=100`);
        if (!ignore) {
          const list = Array.isArray(data?.messages) ? data.messages : [];
          const vid = String(data?.viewerId || data?.viewer_id || '');
          if (vid) viewerIdRef.current = vid;
          setMessages(
            list.map((m) => ({
              ...m,
              is_mine:
                m.is_mine !== undefined
                  ? m.is_mine
                  : Boolean(vid && normId(m.sender_id) === normId(vid)),
            }))
          );
        }
      } catch {
        if (!ignore) setMessages([]);
      } finally {
        if (!ignore) setMessagesReady(true);
      }
    };
    loadMessages();
    return () => {
      ignore = true;
    };
  }, [chatId]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on('connect', () => {
      setConnected(true);
      setConnectionError('');
      socket.emit('chat:join', { eventId, chatId });
    });
    socket.on('reconnect_attempt', () => {
      setConnectionError('Reconnecting...');
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (error) => {
      setConnected(false);
      setConnectionError(error?.message || 'Socket connection failed');
    });

    socket.on('message:new', (message) => {
      if (String(message.chat_id) !== String(chatId)) return;
      upsertMessage(message);
    });
    socket.on('message:status', ({ messageId, status }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status } : m)));
    });

    return () => {
      socket.disconnect();
    };
  }, [socket, eventId, chatId]);

  const postByHttp = async (content) => {
    try {
      const { data } = await apiClient.post(
        `/api/community/chats/${encodeURIComponent(chatId)}/messages`,
        { content }
      );
      const message = data?.message;
      if (message) upsertMessage(message);
      return { ok: true, message, via: 'http' };
    } catch (error) {
      return { ok: false, error: error.response?.data?.message || 'Message send failed' };
    }
  };

  const sendMessage = async (content) => {
    if (!socket || !connected) {
      return postByHttp(content);
    }

    return new Promise((resolve) => {
      let settled = false;

      const fallbackTimer = setTimeout(async () => {
        if (settled) return;
        settled = true;
        const fallback = await postByHttp(content);
        resolve(fallback);
      }, 2500);

      socket.emit('message:send', { chatId, content }, async (response) => {
        if (settled) return;
        clearTimeout(fallbackTimer);

        if (response?.ok) {
          settled = true;
          if (response.message) upsertMessage(response.message);
          resolve(response);
          return;
        }

        settled = true;
        const fallback = await postByHttp(content);
        resolve(fallback);
      });
    });
  };

  const markSeen = (messageId) => {
    if (!socket) return;
    socket.emit('message:seen', { chatId, messageId });
  };

  return {
    connected,
    connectionError,
    messagesReady,
    messages,
    sendMessage,
    markSeen,
  };
}
