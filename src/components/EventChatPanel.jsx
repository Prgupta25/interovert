import React, { useMemo, useState } from 'react';
import { useEventChat } from '../hooks/useEventChat';
import { toast } from 'react-hot-toast';

export default function EventChatPanel({ eventId, chatId }) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { connected, connectionError, messages, sendMessage } = useEventChat(eventId, chatId);

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
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 text-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Event Chat</h3>
        <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
          {connected ? 'Connected' : 'Connecting...'}
        </span>
      </div>
      {!connected && connectionError && (
        <p className="mb-2 text-xs text-amber-300">
          {connectionError}. Using fallback send mode.
        </p>
      )}

      <div className="h-72 overflow-y-auto rounded-lg bg-slate-950 p-3 text-sm">
        {sortedMessages.map((message) => (
          <div key={message.id} className="mb-2">
            <p>{message.content}</p>
            <p className="text-xs text-slate-400">
              {new Date(message.sent_at).toLocaleString()} - {message.status}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 p-2"
          placeholder="Type a message..."
        />
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
          type="submit"
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
