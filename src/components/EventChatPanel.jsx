import React, { useMemo, useState } from 'react';
import { useEventChat } from '../hooks/useEventChat';
import { toast } from 'react-hot-toast';

export default function EventChatPanel({ eventId, chatId, chatTitle }) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { connected, connectionError, messagesReady, messages, sendMessage } = useEventChat(
    eventId,
    chatId
  );

  const showConnected = connected || messagesReady;

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at)),
    [messages]
  );

  const onSend = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    setIsSending(true);
    const response = await sendMessage(content);
    if (response?.ok) {
      setDraft('');
    } else {
      toast.error(response?.error || 'Message send failed');
    }
    setIsSending(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{chatTitle || 'Event chat'}</h3>
        </div>
        <span className={`shrink-0 text-xs ${showConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
          {showConnected ? 'Connected' : 'Connecting…'}
        </span>
      </div>
      {messagesReady && !connected && connectionError && (
        <p className="mb-2 text-xs text-amber-300">
          {connectionError}. Using fallback send mode.
        </p>
      )}

      <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto rounded-lg bg-slate-950 p-3 text-sm">
        {sortedMessages.length === 0 ? (
          <p className="py-8 text-center text-slate-500">No messages yet. Say hello!</p>
        ) : (
          sortedMessages.map((message) => {
            const mine = Boolean(message.is_mine);
            const label =
              mine ? 'You' : (message.sender_name || message.senderName || 'Someone').trim() || 'Someone';
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'}`}
              >
                <span className="px-1 text-[11px] font-medium text-slate-500">{label}</span>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    mine
                      ? 'rounded-br-md bg-indigo-600 text-white'
                      : 'rounded-bl-md border border-slate-600/80 bg-slate-800/90 text-slate-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-indigo-200' : 'text-slate-500'}`}>
                    {new Date(message.sent_at).toLocaleString()} · {message.status || 'SENT'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-100 placeholder:text-slate-500"
          placeholder="Type a message…"
        />
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
          type="submit"
          disabled={isSending}
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
