export type OSLogMetadata = Record<string, unknown>;

export type OSLogType =
  | "create"
  | "update"
  | "status_change"
  | "archive"
  | "unarchive"
  | "driver_accept"
  | "driver_start"
  | "driver_finish"
  | "driver_notify"
  | "driver_delivered"
  | "passenger_notify"
  | "passenger_confirm"
  | "comment"
  | (string & {});

type OSLogTone = {
  label: string;
  badgeClass: string;
  dotClass: string;
  avatarClass: string;
};

const OS_LOG_TONES: Record<string, OSLogTone> = {
  create: {
    label: "Criação",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    avatarClass: "from-emerald-500 to-emerald-600",
  },
  update: {
    label: "Atualização",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    avatarClass: "from-blue-500 to-blue-600",
  },
  status_change: {
    label: "Status atualizado",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
    avatarClass: "from-amber-500 to-amber-600",
  },
  archive: {
    label: "Arquivamento",
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
    avatarClass: "from-slate-500 to-slate-600",
  },
  unarchive: {
    label: "Reabertura",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    avatarClass: "from-emerald-500 to-emerald-600",
  },
  driver_accept: {
    label: "Aceite do motorista",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dotClass: "bg-indigo-500",
    avatarClass: "from-indigo-500 to-indigo-600",
  },
  driver_start: {
    label: "Início da rota",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    dotClass: "bg-sky-500",
    avatarClass: "from-sky-500 to-sky-600",
  },
  driver_finish: {
    label: "Fim da rota",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    avatarClass: "from-emerald-500 to-emerald-600",
  },
  driver_notify: {
    label: "Mensagem enviada",
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dotClass: "bg-cyan-500",
    avatarClass: "from-cyan-500 to-cyan-600",
  },
  driver_delivered: {
    label: "Mensagem entregue",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    dotClass: "bg-teal-500",
    avatarClass: "from-teal-500 to-teal-600",
  },
  passenger_notify: {
    label: "Envio ao passageiro",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    dotClass: "bg-purple-500",
    avatarClass: "from-purple-500 to-purple-600",
  },
  passenger_confirm: {
    label: "Confirmação",
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    dotClass: "bg-green-500",
    avatarClass: "from-green-500 to-green-600",
  },
  comment: {
    label: "Comentário",
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
    avatarClass: "from-slate-500 to-slate-600",
  },
};

export const formatPortugueseList = (items: string[]): string => {
  const normalized = items.map((item) => item.trim()).filter(Boolean);

  if (normalized.length === 0) return "";
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} e ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")} e ${normalized.at(-1)}`;
};

export const getOSLogTone = (type: OSLogType): OSLogTone => {
  return (
    OS_LOG_TONES[type] ?? {
      label: type,
      badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
      dotClass: "bg-slate-400",
      avatarClass: "from-slate-500 to-slate-600",
    }
  );
};

export type OSLogHighlightTag = {
  label: string;
  category: "action" | "cycle" | "state" | "field" | "km" | "section";
};

export const TAG_CATEGORY_STYLES: Record<
  OSLogHighlightTag["category"],
  { badge: string; icon: string }
> = {
  action: {
    badge:
      "bg-amber-50 text-amber-700 border-amber-100",
    icon: "RefreshCw",
  },
  cycle: {
    badge:
      "bg-indigo-50 text-indigo-700 border-indigo-100",
    icon: "Route",
  },
  state: {
    badge:
      "bg-slate-50 text-slate-600 border-slate-200",
    icon: "Activity",
  },
  field: {
    badge:
      "bg-blue-50 text-blue-700 border-blue-100",
    icon: "Edit3",
  },
  km: {
    badge:
      "bg-orange-50 text-orange-700 border-orange-100",
    icon: "Gauge",
  },
  section: {
    badge:
      "bg-purple-50 text-purple-700 border-purple-100",
    icon: "Layers",
  },
};

export const getOSLogHighlightTags = (
  type: OSLogType,
  metadata: OSLogMetadata,
): OSLogHighlightTag[] => {
  if (!metadata || typeof metadata !== "object") return [];

  if (type === "update") {
    const fieldChanges = Array.isArray(metadata.field_changes)
      ? metadata.field_changes
      : [];

    if (fieldChanges.length > 0) {
      return fieldChanges
        .map((change): OSLogHighlightTag | null => {
          if (!change || typeof change !== "object") return null;
          const c = change as Record<string, unknown>;
          const field = typeof c.field === "string" ? c.field : "";
          const from = typeof c.from === "string" ? c.from : "";
          const to = typeof c.to === "string" ? c.to : "";
          const action = typeof c.action === "string" ? c.action : "";

          if (!field) return null;

          if (action === "added") {
            return {
              label: to ? `${field}: ${to}` : `${field} adicionado`,
              category: "field" as const,
            };
          }
          if (action === "removed") {
            return {
              label: from ? `${field}: ${from}` : `${field} removido`,
              category: "field" as const,
            };
          }
          if (from && to) {
            return {
              label: `${field}: ${from} → ${to}`,
              category: "field" as const,
            };
          }
          return { label: `${field} alterado`, category: "field" as const };
        })
        .filter((t): t is OSLogHighlightTag => t !== null);
    }

    const sections = Array.isArray(metadata.changed_sections)
      ? metadata.changed_sections.filter(
          (section): section is string =>
            typeof section === "string" && section.trim().length > 0,
        )
      : [];
    return sections.map((s) => ({ label: s, category: "section" }));
  }

  if (type === "status_change") {
    const tags: OSLogHighlightTag[] = [];
    const updates = metadata.updates as
      | { operacional?: unknown; financeiro?: unknown }
      | undefined;

    if (
      typeof updates?.operacional === "string" &&
      updates.operacional.trim()
    ) {
      tags.push({
        label: `Operacional: ${updates.operacional.trim()}`,
        category: "action",
      });
    }

    if (typeof updates?.financeiro === "string" && updates.financeiro.trim()) {
      tags.push({
        label: `Financeiro: ${updates.financeiro.trim()}`,
        category: "action",
      });
    }

    if (tags.length === 0) {
      const action =
        typeof metadata.action === "string" ? metadata.action : null;
      if (action === "finish_all") {
        tags.push({ label: "Finalização total", category: "action" });
      } else if (action === "finish_cycle") {
        tags.push({ label: "Ciclo finalizado", category: "action" });
      } else if (action === "revert_to_pending") {
        tags.push({ label: "Reversão para pendente", category: "action" });
      } else if (action === "revert_to_accept") {
        tags.push({ label: "Reversão para aceite", category: "action" });
      }
    }

    if (
      typeof metadata.cycle_title === "string" &&
      metadata.cycle_title.trim()
    ) {
      tags.push({ label: metadata.cycle_title.trim(), category: "cycle" });
    }

    if (typeof metadata.new_state === "string" && metadata.new_state.trim()) {
      tags.push({
        label: metadata.new_state.trim(),
        category: "state",
      });
    }

    return tags;
  }

  if (type === "driver_start" || type === "driver_finish") {
    const tags: OSLogHighlightTag[] = [];
    const cycleIndex = metadata.cycle_index;
    const kmValue =
      type === "driver_start" ? metadata.km_initial : metadata.km_final;

    if (typeof cycleIndex === "number") {
      tags.push({ label: `Ciclo ${cycleIndex + 1}`, category: "cycle" });
    }

    if (typeof kmValue === "number") {
      tags.push({
        label: `KM ${kmValue.toLocaleString("pt-BR")}`,
        category: "km",
      });
    }

    return tags;
  }

  if (type === "driver_accept") {
    const cycleIndex = metadata.cycle_index;
    return typeof cycleIndex === "number"
      ? [{ label: `Ciclo ${cycleIndex + 1}`, category: "cycle" }]
      : [];
  }

  if (type === "driver_notify") {
    const tags: OSLogHighlightTag[] = [];
    const cycleIndex = metadata.cycle_index;
    if (typeof cycleIndex === "number") {
      tags.push({ label: `Ciclo ${cycleIndex + 1}`, category: "cycle" });
    }
    return tags;
  }

  if (type === "driver_delivered") {
    const tags: OSLogHighlightTag[] = [];
    const cycleIndex = metadata.cycle_index;
    const deliveryStatus = metadata.delivery_status;
    if (typeof cycleIndex === "number") {
      tags.push({ label: `Ciclo ${cycleIndex + 1}`, category: "cycle" });
    }
    if (typeof deliveryStatus === "string") {
      tags.push({
        label: deliveryStatus === "read" ? "Visualizado" : "Entregue",
        category: "state",
      });
    }
    return tags;
  }

  return [];
};

// Mantido para compatibilidade legada — preferir getOSLogHighlightTags
export const getOSLogMetadataHighlights = (
  type: OSLogType,
  metadata: OSLogMetadata,
): string[] => {
  return getOSLogHighlightTags(type, metadata).map((t) => t.label);
};

/**
 * Classifica o ator de um log em "user" (operador logado no sistema) ou
 * "driver" (motorista agindo via flow do WhatsApp). A distinção é feita
 * pela combinação de `type` e `actor_id`:
 *   - driver_start / driver_finish / driver_accept → sempre motorista
 *   - status_change / update / create / etc. com actor_id preenchido → usuário
 *   - status_change sem actor_id → pode ser "Sistema" (auto) ou motorista
 *     em fluxos legados; tratamos como sistema para segurança.
 */
export type OSLogActorKind = "user" | "driver" | "system";

export const getOSLogActorKind = (
  type: OSLogType,
  actorId: string | null,
): OSLogActorKind => {
  if (
    type === "driver_start" ||
    type === "driver_finish" ||
    type === "driver_accept"
  ) {
    return "driver";
  }
  if (actorId) return "user";
  return "system";
};

/**
 * Gera a frase descritiva do ator no formato:
 *   - Usuário:  "Acacio Vieira atualizou o status do atendimento"
 *   - Motorista: "Motorista Marcelo de Mattos Agra iniciou a rota"
 *   - Sistema:  "Sistema atualizou o status do atendimento"
 *
 * O verbo é derivado do `type` do log.
 */
export const getOSLogActorPhrase = (
  type: OSLogType,
  actorName: string,
  actorId: string | null,
): string => {
  const kind = getOSLogActorKind(type, actorId);
  const name = actorName || "Sistema";

  const verbs: Partial<Record<OSLogType, string>> = {
    create: "criou o atendimento",
    update: "editou os dados do atendimento",
    status_change: "atualizou o status do atendimento",
    archive: "arquivou o atendimento",
    unarchive: "reabriu o atendimento",
    driver_accept: "visualizou o atendimento",
    driver_start: "iniciou a rota",
    driver_finish: "finalizou a rota",
    driver_notify: "enviou uma mensagem de serviço",
    driver_delivered: "recebeu a nova mensagem de atendimento",
    passenger_notify: "notificou passageiros",
    passenger_confirm: "confirmou presença",
    comment: "adicionou um comentário",
  };

  const verb = verbs[type] ?? "atualizou o atendimento";

  if (type === "driver_notify") {
    return `${name} ${verb}`;
  }
  if (type === "driver_delivered") {
    return `Motorista ${name} ${verb}`;
  }
  if (kind === "driver") {
    return `Motorista ${name} ${verb}`;
  }
  return `${name} ${verb}`;
};
