import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MessageCircle, Users } from 'lucide-react';
import EventChatPanel from './EventChatPanel';
import apiClient from '../services/apiClient';

function chatRowLabel(chat) {
  if (chat.type === 'DIRECT') {
    return chat.otherUserName ? `Direct · ${chat.otherUserName}` : 'Direct message';
  }
  return 'Everyone (group)';
}

const Chat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const eventId = params.get('eventId');
  const requestedChatId = params.get('chatId');

  const [chats, setChats] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [chatId, setChatId] = useState(requestedChatId || '');
  const [isLoading, setIsLoading] = useState(false);

  const loadChats = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const { data } = await apiClient.get(`/api/community/events/${eventId}/chats`);
      const list = Array.isArray(data?.chats) ? data.chats : [];
      setChats(list);
      setTotalUnread(Number(data?.totalUnread) || 0);

      if (requestedChatId && list.some((c) => String(c.id) === String(requestedChatId))) {
        setChatId(requestedChatId);
      } else if (!requestedChatId) {
        const groupChat = list.find((c) => c.type === 'EVENT_GROUP');
        setChatId(groupChat?.id || list[0]?.id || '');
      } else if (requestedChatId) {
        setChatId(requestedChatId);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load chats');
      setChats([]);
      setChatId('');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, requestedChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    const t = setInterval(() => loadChats(), 40000);
    return () => clearInterval(t);
  }, [loadChats]);

  const selectChat = (id) => {
    setChatId(id);
    navigate(`/chat?eventId=${eventId}&chatId=${id}`, { replace: true });
  };

  useEffect(() => {
    if (!chatId) return undefined;
    const t = setTimeout(() => loadChats(), 900);
    return () => clearTimeout(t);
  }, [chatId, loadChats]);

  const activeChat = chats.find((c) => String(c.id) === String(chatId));
  const panelTitle = activeChat ? chatRowLabel(activeChat) : 'Chat';

  if (!eventId) {
    return (
      <div className="min-h-screen bg-gray-900 px-4 pt-28 text-white">
        <div className="mx-auto max-w-3xl rounded-xl bg-gray-800 p-6">
          <h1 className="mb-2 text-2xl font-bold">Event Chat</h1>
          <p className="mb-4 text-gray-300">Open chat from an event details page after joining the event.</p>
          <Link className="inline-block rounded-lg bg-indigo-600 px-4 py-2 hover:bg-indigo-700" to="/events">
            Go to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 pb-10 pt-24 text-white sm:pt-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link className="text-indigo-300 hover:text-indigo-200" to={`/event/${eventId}`}>
            ← Back to Event
          </Link>
          {totalUnread > 0 ? (
            <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/40">
              {totalUnread} unread total
            </span>
          ) : null}
        </div>

        {isLoading && !chats.length ? (
          <div className="rounded-xl bg-gray-800 p-6">Loading chats…</div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <aside className="w-full shrink-0 rounded-xl border border-gray-700 bg-gray-800/80 lg:w-72">
              <div className="border-b border-gray-700 p-3">
                <h2 className="text-sm font-semibold text-gray-200">Conversations</h2>
                <p className="text-xs text-gray-500">Group + direct threads for this event</p>
              </div>
              <ul className="max-h-[50vh] overflow-y-auto p-2 lg:max-h-[min(70vh,560px)]">
                {chats.map((c) => {
                  const n = Number(c.unreadCount ?? c.unread_count) || 0;
                  const msgTotal = Number(c.messageCount ?? c.message_count) || 0;
                  const names =
                    n > 0
                      ? (c.pendingSenderNames && c.pendingSenderNames.length
                          ? c.pendingSenderNames.join(', ')
                          : c.otherUserName || c.lastSenderName || 'Someone')
                      : '';
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectChat(c.id)}
                        className={`mb-1 flex w-full flex-col rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          String(chatId) === String(c.id)
                            ? 'bg-indigo-600/25 ring-1 ring-indigo-500/50'
                            : 'hover:bg-gray-700/60'
                        }`}
                      >
                        <span className="flex items-center gap-2 font-medium text-gray-100">
                          {c.type === 'EVENT_GROUP' ? (
                            <Users className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
                          ) : (
                            <MessageCircle className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1 truncate">{chatRowLabel(c)}</span>
                          {n > 0 ? (
                            <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {n > 99 ? '99+' : n}
                            </span>
                          ) : msgTotal > 0 ? (
                            <span className="shrink-0 rounded-full bg-zinc-600 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200">
                              {msgTotal}
                            </span>
                          ) : null}
                        </span>
                        {n > 0 && names ? (
                          <span className="mt-1 pl-6 text-[11px] text-amber-200/90">From {names}</span>
                        ) : null}
                        {msgTotal > 0 && n === 0 ? (
                          <span className="mt-0.5 pl-6 text-[11px] text-gray-500">
                            {msgTotal} {msgTotal === 1 ? 'message' : 'messages'}
                            {c.lastSenderName || c.last_sender_name
                              ? ` · Last: ${c.lastSenderName || c.last_sender_name}`
                              : ''}
                          </span>
                        ) : null}
                        {c.lastMessagePreview && n === 0 && !msgTotal ? (
                          <span className="mt-0.5 truncate pl-6 text-[11px] text-gray-500">
                            {c.lastMessagePreview}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className="min-h-[420px] flex-1">
              {chatId ? (
                <EventChatPanel eventId={eventId} chatId={chatId} chatTitle={panelTitle} />
              ) : (
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-400">
                  No chat room available. Join this event first.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
