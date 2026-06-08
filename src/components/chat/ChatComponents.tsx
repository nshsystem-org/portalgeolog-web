import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Send,
  X,
  MoreVertical,
  UserPlus,
  Search,
  MessageCircle,
  Loader2,
} from "lucide-react";
import type { ChatConversation, ChatMessage } from "@/context/DataContext";
import { useChatTranslation } from "@/hooks/useTranslation";

interface ConversationListProps {
  conversations: Array<ChatConversation & { unreadCount: number }>;
  activeConversation: ChatConversation | null;
  onSelectConversation: (conversation: ChatConversation) => void;
  currentUserId: string;
  onNewConversation?: () => void;
}

export function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation,
  currentUserId,
  onNewConversation,
}: ConversationListProps) {
  const t = useChatTranslation();

  const getConversationTitle = (conv: ChatConversation): string => {
    if (conv.type === "group" && conv.title) {
      return conv.title;
    }

    const otherParticipants = conv.participants?.filter(
      (p) => p.user_id !== currentUserId,
    );

    if (otherParticipants && otherParticipants.length > 0) {
      return otherParticipants.map((p) => p.user_name || "Usuário").join(", ");
    }

    return "Conversa";
  };

  const getConversationAvatar = (conv: ChatConversation): string => {
    if (conv.type === "group") {
      return "👥";
    }

    const otherParticipants = conv.participants?.filter(
      (p) => p.user_id !== currentUserId,
    );

    if (otherParticipants && otherParticipants.length > 0) {
      return otherParticipants[0].user_avatar || "👤";
    }

    return "👤";
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {t?.widget.conversations_title || "Conversas"}
          </h2>
          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Nova conversa"
            >
              <UserPlus size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            {t?.conversation_list.no_conversations || "Nenhuma conversa ainda"}
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className={`w-full p-4 border-b border-slate-100 hover:bg-slate-100 transition-colors text-left ${
                activeConversation?.id === conv.id ? "bg-blue-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                  {getConversationAvatar(conv).startsWith("http") ? (
                    <img
                      src={getConversationAvatar(conv)}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">
                      {getConversationAvatar(conv)}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800 truncate">
                      {getConversationTitle(conv)}
                    </p>
                    <span className="text-xs text-slate-500">
                      {format(new Date(conv.updated_at), "HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  {conv.unreadCount > 0 && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-blue-600 font-medium">
                        {conv.unreadCount}{" "}
                        {conv.unreadCount > 1
                          ? t?.conversation_list.unread_messages_plural ||
                            "mensagens"
                          : t?.conversation_list.unread_messages || "mensagem"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversation?: ChatConversation | null;
}

export function MessageList({
  messages,
  currentUserId,
  messagesEndRef,
  conversation,
}: MessageListProps) {
  const t = useChatTranslation();

  const formatMessageTime = (dateString: string): string => {
    return format(new Date(dateString), "HH:mm", { locale: ptBR });
  };

  const formatMessageDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return t?.message_list.today || "Hoje";
    }

    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const isMessageRead = (message: ChatMessage): boolean => {
    if (!conversation || message.sender_id !== currentUserId) return false;
    return (
      conversation.participants?.some(
        (p) =>
          p.user_id !== currentUserId &&
          p.last_read_at &&
          new Date(p.last_read_at) >= new Date(message.created_at),
      ) ?? false
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          {t?.message_list.no_messages ||
            "Nenhuma mensagem ainda. Comece a conversar!"}
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isOwn = message.sender_id === currentUserId;
            const showDate =
              index === 0 ||
              formatMessageDate(messages[index - 1].created_at) !==
                formatMessageDate(message.created_at);

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="text-center text-xs text-slate-500 my-4">
                    {formatMessageDate(message.created_at)}
                  </div>
                )}

                <div
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-800 border border-slate-200"
                    }`}
                  >
                    {!isOwn && message.sender_name && (
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {message.sender_name}
                      </p>
                    )}

                    <p className="text-sm">{message.content}</p>

                    <div
                      className={`flex items-center gap-1 mt-1 text-xs ${
                        isOwn ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      <span>{formatMessageTime(message.created_at)}</span>
                      {message.is_edited && (
                        <span>({t?.message_list.edited || "editada"})</span>
                      )}
                      {isMessageRead(message) && (
                        <span>
                          • {t?.message_list.visualized || "Visualizado"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  sending: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSendMessage,
  sending,
  disabled = false,
}: ChatInputProps) {
  const t = useChatTranslation();
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !sending) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <div className="p-4 bg-white border-t border-slate-200">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t?.chat_input.placeholder || "Digite uma mensagem..."}
          disabled={disabled || sending}
          className="flex-1 px-4 py-2 bg-slate-100 rounded-full border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!message.trim() || sending || disabled}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={t?.chat_input.send_button || "Enviar"}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

import { useState } from "react";

interface UserListProps {
  users: Array<{ id: string; name: string; avatar?: string }>;
  onSelectUser: (userId: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export function UserList({
  users,
  onSelectUser,
  onClose,
  loading = false,
}: UserListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800">Nova Conversa</h3>
          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 size={16} className="animate-spin" />
                <span>Criando conversa...</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={loading}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuário..."
            className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            {searchTerm
              ? "Nenhum usuário encontrado"
              : "Nenhum usuário disponível"}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => !loading && onSelectUser(user.id)}
              disabled={loading}
              className={`w-full p-4 border-b border-slate-100 text-left flex items-center gap-3 cursor-pointer group transition-colors ${
                loading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-slate-50 hover:bg-blue-50"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg overflow-hidden group-hover:ring-2 group-hover:ring-blue-500 transition-all">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "👤"
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 group-hover:text-blue-600 transition-colors">
                  Clicar para iniciar conversa
                </p>
              </div>
              <div className="text-slate-400 group-hover:text-blue-600 transition-colors">
                <MessageCircle size={16} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
