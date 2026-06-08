import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchChatMessages,
  createChatConversation,
  createChatMessage,
  updateChatParticipantLastRead,
  getUserConversationsWithUnread,
  fetchChatUsers,
  fetchUsersByIds,
  findExistingDirectConversation,
} from "@/lib/supabase/queries";
import type { ChatConversation, ChatMessage } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

function deduplicateDirectConversations(
  conversations: Array<ChatConversation & { unreadCount: number }>,
  currentUserId: string,
): Array<ChatConversation & { unreadCount: number }> {
  const directConversations = conversations.filter((c) => c.type === "direct");
  const groupConversations = conversations.filter((c) => c.type === "group");

  // Criar mapa de conversas diretas pelos participantes
  const conversationsByParticipants = new Map<
    string,
    ChatConversation & { unreadCount: number }
  >();

  directConversations.forEach((conv) => {
    if (!conv.participants || conv.participants.length !== 2) return;

    // Criar chave única baseada nos IDs dos participantes (ordenados)
    const participantIds = conv.participants
      .map((p) => p.user_id)
      .sort()
      .join("-");

    const existing = conversationsByParticipants.get(participantIds);

    // Se não existe conversa com esses participantes, ou se a atual é mais recente
    if (
      !existing ||
      new Date(conv.updated_at) > new Date(existing.updated_at)
    ) {
      conversationsByParticipants.set(participantIds, conv);
    }
  });

  // Retornar conversas deduplicadas (diretas + grupos)
  return [
    ...Array.from(conversationsByParticipants.values()),
    ...groupConversations,
  ].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function useChat() {
  const { user } = useAuth();
  const supabase = createClient();
  const [conversations, setConversations] = useState<
    (ChatConversation & { unreadCount: number })[]
  >([]);
  const [activeConversation, setActiveConversation] =
    useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; avatar?: string }>
  >([]);
  const [showUserList, setShowUserList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getUserConversationsWithUnread(user.id);

      // Buscar nomes dos participantes
      const allParticipantIds = new Set<string>();
      data.forEach((conv) => {
        conv.participants?.forEach((p) => {
          allParticipantIds.add(p.user_id);
        });
      });

      if (allParticipantIds.size > 0) {
        const usersMap = await fetchUsersByIds(Array.from(allParticipantIds));

        // Enriquecer conversas com nomes dos participantes
        const enrichedConversations = data.map((conv) => ({
          ...conv,
          participants: conv.participants?.map((p) => ({
            ...p,
            user_name: usersMap.get(p.user_id)?.name,
            user_avatar: usersMap.get(p.user_id)?.avatar,
          })),
        }));

        // Deduplicar conversas diretas (mesmos participantes)
        const deduplicatedConversations = deduplicateDirectConversations(
          enrichedConversations,
          user.id,
        );

        setConversations(deduplicatedConversations);
        return deduplicatedConversations;
      }

      setConversations(data);
      return data;
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadAvailableUsers = useCallback(async () => {
    if (!user) return;

    try {
      const users = await fetchChatUsers(user.id);
      setAvailableUsers(users);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  }, [user]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        setLoading(true);
        const data = await fetchChatMessages(conversationId);
        setMessages(data);

        if (user) {
          await updateChatParticipantLastRead(conversationId, user.id);
        }

        setTimeout(scrollToBottom, 100);
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
      } finally {
        setLoading(false);
      }
    },
    [user, scrollToBottom],
  );

  const selectConversation = useCallback(
    (conversation: ChatConversation) => {
      setActiveConversation(conversation);
      loadMessages(conversation.id);
    },
    [loadMessages],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversation || !user || !content.trim()) return;

      try {
        setSending(true);
        await createChatMessage(
          activeConversation.id,
          user.id,
          content.trim(),
          "text",
        );

        await updateChatParticipantLastRead(activeConversation.id, user.id);
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
      } finally {
        setSending(false);
      }
    },
    [activeConversation, user, scrollToBottom],
  );

  const createDirectConversation = useCallback(
    async (otherUserId: string) => {
      if (!user) return null;

      try {
        setCreatingConversation(true);

        // Verificar se já existe uma conversa direta entre os dois usuários
        const existingConversationId = await findExistingDirectConversation(
          user.id,
          otherUserId,
        );

        let conversationId: string;

        if (existingConversationId) {
          conversationId = existingConversationId;
        } else {
          conversationId = await createChatConversation(
            "direct",
            undefined,
            [user.id, otherUserId],
            user.id,
          );
        }

        const updatedConversations = await loadConversations();
        const newConversation = updatedConversations?.find(
          (c) => c.id === conversationId,
        );

        if (newConversation) {
          selectConversation(newConversation);
        } else {
          setActiveConversation({
            id: conversationId,
            type: "direct",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          await loadMessages(conversationId);
        }

        return conversationId;
      } catch (error) {
        console.error("Erro ao criar conversa:", error);
        return null;
      } finally {
        setCreatingConversation(false);
      }
    },
    [user, loadConversations, selectConversation],
  );

  useEffect(() => {
    if (user) {
      loadConversations();
      loadAvailableUsers();

      const channel = supabase
        .channel("chat_messages_changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
          },
          (payload) => {
            const newMessage = payload.new as ChatMessage;

            if (activeConversation?.id === newMessage.conversation_id) {
              setMessages((prev) => [...prev, newMessage]);
              setTimeout(scrollToBottom, 100);

              if (user) {
                updateChatParticipantLastRead(activeConversation.id, user.id);
              }
            }

            loadConversations();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [
    user,
    activeConversation,
    loadConversations,
    loadAvailableUsers,
    scrollToBottom,
    supabase,
  ]);

  return {
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
    loadAvailableUsers,
    selectConversation,
    sendMessage,
    createDirectConversation,
    setActiveConversation,
  };
}
