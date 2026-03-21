import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X } from 'lucide-react';
import apiClient from '../services/apiClient';

/**
 * @param {object} props
 * @param {() => void} [props.onClose] — When set, renders compact floating panel (for Layout FAB). Omit for full-page mode (/chatbot).
 */
function ChatBot({ onClose }) {
  const floating = typeof onClose === 'function';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const dialogflowSessionIdRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `df-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  );

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const payloadMessages = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data } = await apiClient.post('/api/chat', {
        messages: payloadMessages,
        sessionId: dialogflowSessionIdRef.current,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: data.content ?? '' }]);
    } catch (error) {
      console.error('Error:', error);
      const friendlyMessage = error.message || 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: friendlyMessage }]);
    }

    setIsLoading(false);
  };

  const card = (
    <div
      className={`overflow-hidden shadow-lg ${
        floating
          ? 'rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/40 ring-1 ring-white/5'
          : 'rounded-2xl bg-white shadow-lg'
      }`}
    >
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Bot className="h-6 w-6 shrink-0" />
          AI Assistant
        </h1>
        {floating && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white transition-colors hover:bg-white/15"
            aria-label="Close assistant"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div
        ref={chatContainerRef}
        className={`space-y-4 overflow-y-auto p-4 ${
          floating ? 'h-[min(50vh,420px)] bg-zinc-950/60' : 'h-[600px]'
        }`}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  floating ? 'bg-indigo-500/20' : 'bg-indigo-100'
                }`}
              >
                <Bot className={`h-5 w-5 ${floating ? 'text-indigo-300' : 'text-indigo-600'}`} />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl p-3 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : floating
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              {message.content}
            </div>
            {message.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                <User className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className={`flex items-center gap-2 ${floating ? 'text-zinc-500' : 'text-gray-500'}`}>
            <div className="h-2 w-2 animate-bounce rounded-full bg-current" />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-current"
              style={{ animationDelay: '0.2s' }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-current"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
        )}
      </div>

      <div className={`border-t p-4 ${floating ? 'border-zinc-700 bg-zinc-900' : ''}`}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message…"
            className={`flex-1 rounded-lg border p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
              floating
                ? 'border-zinc-600 bg-zinc-800 text-white placeholder:text-zinc-500'
                : 'border-gray-200 focus:ring-indigo-600'
            }`}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="rounded-lg bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  if (floating) {
    return card;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10 pt-20">
      <div className="mx-auto max-w-4xl px-4">{card}</div>
    </div>
  );
}

export default ChatBot;
