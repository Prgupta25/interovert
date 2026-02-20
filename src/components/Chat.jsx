import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EventChatPanel from './EventChatPanel';
import apiClient from '../services/apiClient';

const Chat = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const eventId = params.get('eventId');
  const requestedChatId = params.get('chatId');

  const [chatId, setChatId] = useState(requestedChatId || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    const resolveChat = async () => {
      if (!eventId) {
        setChatId('');
        return;
      }

      if (requestedChatId) {
        setChatId(requestedChatId);
        return;
      }

      setIsLoading(true);
      try {
        const { data } = await apiClient.get(`/api/community/events/${eventId}/chats`);
        const groupChat = (data?.chats || []).find((chat) => chat.type === 'EVENT_GROUP');
        if (!ignore) {
          setChatId(groupChat?.id || data?.chats?.[0]?.id || '');
        }
      } catch (error) {
        if (!ignore) {
          toast.error(error.response?.data?.message || 'Unable to load event chat');
          setChatId('');
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    resolveChat();
    return () => {
      ignore = true;
    };
  }, [eventId, requestedChatId]);

  if (!eventId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white pt-28 px-4">
        <div className="max-w-3xl mx-auto bg-gray-800 rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-2">Event Chat</h1>
          <p className="text-gray-300 mb-4">Open chat from an event details page after joining the event.</p>
          <Link className="inline-block bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg" to="/events">
            Go to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-28 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link className="text-indigo-300 hover:text-indigo-200" to={`/event/${eventId}`}>
            ← Back to Event
          </Link>
        </div>
        {isLoading ? (
          <div className="bg-gray-800 rounded-xl p-6">Loading chat...</div>
        ) : chatId ? (
          <EventChatPanel eventId={eventId} chatId={chatId} />
        ) : (
          <div className="bg-gray-800 rounded-xl p-6">
            No chat room available. Join this event first.
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;

