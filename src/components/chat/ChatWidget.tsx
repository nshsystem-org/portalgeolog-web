import { useState, useMemo, useEffect } from "react";
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
  const [isHovered, setIsHovered] = useState(false);

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
    sendImageMessage,
    createDirectConversation,
    setActiveConversation,
  } = useChat();

  const unreadCount = conversations.reduce(
    (total, conv) => total + conv.unreadCount,
    0,
  );

  // Conversa com a mensagem não lida mais recente (para preview estilo Instagram)
  const latestUnread = useMemo(() => {
    const unreadConvs = conversations.filter((c) => c.unreadCount > 0);
    if (unreadConvs.length === 0) return null;
    return unreadConvs.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
  }, [conversations]);

  const previewSender = useMemo(() => {
    if (!latestUnread || !latestUnread.participants) return null;
    const other = latestUnread.participants.find((p) => p.user_id !== user?.id);
    return (
      other?.user_name ||
      latestUnread.title ||
      t?.widget.conversation_title ||
      "Conversa"
    );
  }, [latestUnread, user?.id, t?.widget.conversation_title]);

  const previewBody = latestUnread?.lastMessage?.content?.trim() || null;
  const hasPreview = !isOpen && unreadCount > 0 && previewSender;

  // Escuta evento de notificação de chat para abrir a conversa
  // diretamente quando o usuário clica no toast ou na notificação desktop.
  useEffect(() => {
    const handleOpenChatConversation = (e: Event) => {
      const detail = (e as CustomEvent<{ conversationId: string }>).detail;
      if (!detail?.conversationId) return;

      setIsOpen(true);
      setIsMinimized(false);
      loadConversations().then((convs) => {
        const target = convs?.find((c) => c.id === detail.conversationId);
        if (target) {
          selectConversation(target);
        }
      });
    };

    window.addEventListener(
      "open-chat-conversation",
      handleOpenChatConversation as EventListener,
    );
    return () =>
      window.removeEventListener(
        "open-chat-conversation",
        handleOpenChatConversation as EventListener,
      );
  }, [loadConversations, selectConversation]);

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

  const badgeLabel = unreadCount > 9 ? "9+" : unreadCount;

  return (
    <>
      <div
        className="fixed bottom-6 right-6 z-50"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Preview tooltip (estilo Instagram) - só quando fechado e com não lidas */}
        {hasPreview && isHovered && (
          <div className="absolute bottom-full right-0 mb-3 w-72 animate-chat-preview-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-chat-dot-pulse absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest text-rose-600">
                  {unreadCount > 1
                    ? `${unreadCount} ${t?.widget.conversations_title || "novas mensagens"}`
                    : t?.widget.conversation_title || "nova mensagem"}
                </span>
              </div>
              <div className="px-4 pb-3 pt-1">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {previewSender}
                </p>
                {previewBody && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {previewBody}
                  </p>
                )}
              </div>
              {/* Setinha apontando para o botão */}
              <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-white border-r border-b border-slate-200" />
            </div>
          </div>
        )}

        <button
          onClick={handleToggle}
          aria-label={t?.widget.toggle_button || "Abrir chat"}
          className={`group relative flex items-center justify-center rounded-full transition-all duration-300 ease-out
            ${
              isOpen
                ? "h-14 w-14 bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-900/30"
                : "h-16 w-16 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 hover:from-blue-500 hover:via-blue-600 hover:to-indigo-700 shadow-xl shadow-blue-600/40 hover:shadow-2xl hover:shadow-blue-600/50 hover:scale-105"
            }
            ${!isOpen && unreadCount > 0 ? "animate-chat-glow" : ""}
          `}
        >
          {/* Anel pulsante (Instagram-style) quando há não lidas e o chat está fechado */}
          {!isOpen && unreadCount > 0 && (
            <span className="pointer-events-none absolute inset-0 rounded-full bg-blue-500 animate-chat-pulse-ring" />
          )}

          {/* Ícone com transição suave */}
          {isOpen ? (
            <X
              size={24}
              className="text-white animate-chat-icon-pop"
              strokeWidth={2.5}
            />
          ) : (
            <MessageCircle
              size={26}
              className={`text-white transition-transform duration-300 group-hover:scale-110 ${unreadCount > 0 ? "animate-chat-icon-pop" : ""}`}
              strokeWidth={2.25}
            />
          )}

          {/* Badge de não lidas - maior e com bounce */}
          {!isOpen && unreadCount > 0 && (
            <span
              className="animate-chat-badge-bounce absolute -top-1 -right-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1.5 text-[12px] font-black text-white shadow-lg shadow-red-600/40 ring-2 ring-white"
              aria-label={`${unreadCount} mensagens não lidas`}
            >
              {badgeLabel}
            </span>
          )}
        </button>
      </div>

      {isOpen && (
        <div
          className={`fixed bottom-24 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all max-w-[calc(100vw-3rem)] ${
            isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
          }`}
        >
          {isMinimized ? (
            <div className="h-full bg-blue-600 text-white flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <MessageCircle size={20} />
                <span className="font-semibold">
                  {t?.widget.chat_title || "Chat"}
                </span>
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
                      onSendImage={sendImageMessage}
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
