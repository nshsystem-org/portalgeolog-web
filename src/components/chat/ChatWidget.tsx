import { useState } from "react";
import { MessageCircle, X, Minimize2, Maximize2 } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/context/AuthContext";
import { useChatTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";
import {
  ConversationList,
  MessageList,
  ChatInput,
  UserList,
} from "./ChatComponents";

export function ChatWidget() {
  const { user } = useAuth();
  const t = useChatTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const {
    conversations,
    activeConversation,
    messages,
    loading,
    sending,
    creatingConversation,
    availableUsers,
    showUserList,
    setShowUserList,
    messagesEndRef,
    loadConversations,
    selectConversation,
    sendMessage,
    createDirectConversation,
    setActiveConversation,
  } = useChat();

  const unreadCount = conversations.reduce(
    (total, conv) => total + conv.unreadCount,
    0,
  );

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
      loadConversations();
    } else {
      setIsOpen(false);
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveConversation(null);
    setShowUserList(false);
  };

  const handleSelectUser = async (userId: string) => {
    try {
      setShowUserList(false);
      const conversationId = await createDirectConversation(userId);
      if (!conversationId) {
        toast.error("Não foi possível iniciar a conversa.");
        setShowUserList(true);
      } else {
        toast.success("Conversa iniciada.");
      }
    } catch (error) {
      console.error("Erro ao criar conversa:", error);
      toast.error("Erro ao iniciar a conversa.");
      setShowUserList(true);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={handleToggle}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
        aria-label={t?.widget.toggle_button || "Abrir chat"}
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <>
            <MessageCircle size={24} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <div
          className={`fixed bottom-24 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all ${
            isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
          }`}
        >
          {isMinimized ? (
            <div className="h-full bg-blue-600 text-white flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} />
                <span className="font-semibold">{t?.widget.chat_title || "Chat"}</span>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={handleMaximize}
                className="hover:bg-blue-700 p-1 rounded"
                title={t?.widget.maximize_button || "Maximizar"}
              >
                <Maximize2 size={20} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={20} />
                  <span className="font-semibold">
                    {activeConversation
                      ? t?.widget.conversation_title || "Conversa"
                      : `${t?.widget.conversations_title || "Conversas"} (${unreadCount})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMinimize}
                    className="hover:bg-blue-700 p-1 rounded"
                    title={t?.widget.minimize_button || "Minimizar"}
                  >
                    <Minimize2 size={20} />
                  </button>
                  <button
                    onClick={handleClose}
                    className="hover:bg-blue-700 p-1 rounded"
                    title={t?.widget.close_button || "Fechar"}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {showUserList ? (
                  <UserList
                    users={availableUsers}
                    onSelectUser={handleSelectUser}
                    onClose={() => setShowUserList(false)}
                    loading={creatingConversation}
                  />
                ) : !activeConversation ? (
                  <ConversationList
                    conversations={conversations}
                    activeConversation={activeConversation}
                    onSelectConversation={selectConversation}
                    currentUserId={user.id}
                    onNewConversation={() => setShowUserList(true)}
                  />
                ) : (
                  <div className="flex flex-col w-full">
                    <button
                      onClick={() => setActiveConversation(null)}
                      className="p-3 border-b border-slate-200 hover:bg-slate-50 text-left flex items-center gap-2 text-sm text-slate-600"
                    >
                      ← Voltar para conversas
                    </button>

                    <MessageList
                      messages={messages}
                      currentUserId={user.id}
                      messagesEndRef={messagesEndRef}
                      conversation={activeConversation}
                    />

                    <ChatInput
                      onSendMessage={sendMessage}
                      sending={sending}
                      disabled={loading}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
