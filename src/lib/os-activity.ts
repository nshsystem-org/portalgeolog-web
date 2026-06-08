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

export const getOSLogMetadataHighlights = (
  type: OSLogType,
  metadata: OSLogMetadata,
): string[] => {
  if (!metadata || typeof metadata !== "object") return [];

  if (type === "update") {
    const fieldChanges = Array.isArray(metadata.field_changes)
      ? metadata.field_changes
      : [];

    if (fieldChanges.length > 0) {
      return fieldChanges
        .map((change) => {
          if (!change || typeof change !== "object") return null;
          const c = change as Record<string, unknown>;
          const field = typeof c.field === "string" ? c.field : "";
          const from = typeof c.from === "string" ? c.from : "";
          const to = typeof c.to === "string" ? c.to : "";
          const action = typeof c.action === "string" ? c.action : "";

          if (!field) return null;

          if (action === "added") {
            return to ? `${field}: ${to} adicionado` : `${field} adicionado`;
          }
          if (action === "removed") {
            return from
              ? `${field}: ${from} removido`
              : `${field} removido`;
          }
          if (from && to) {
            return `${field}: ${from} → ${to}`;
          }
          return `${field} alterado`;
        })
        .filter((s): s is string => Boolean(s));
    }

    const sections = Array.isArray(metadata.changed_sections)
      ? metadata.changed_sections.filter(
          (section): section is string =>
            typeof section === "string" && section.trim().length > 0,
        )
      : [];
    return sections;
  }

  if (type === "status_change") {
    const updates = metadata.updates as
      | { operacional?: unknown; financeiro?: unknown }
      | undefined;
    const highlights: string[] = [];

    if (
      typeof updates?.operacional === "string" &&
      updates.operacional.trim()
    ) {
      highlights.push(`Operacional: ${updates.operacional.trim()}`);
    }

    if (typeof updates?.financeiro === "string" && updates.financeiro.trim()) {
      highlights.push(`Financeiro: ${updates.financeiro.trim()}`);
    }

    if (highlights.length === 0) {
      const action =
        typeof metadata.action === "string" ? metadata.action : null;
      if (action === "finish_all") {
        highlights.push("Finalização total");
      } else if (action === "finish_cycle") {
        highlights.push("Ciclo finalizado");
      } else if (action === "revert_to_pending") {
        highlights.push("Reversão para pendente");
      } else if (action === "revert_to_accept") {
        highlights.push("Reversão para aceite");
      }
    }

    if (
      typeof metadata.cycle_title === "string" &&
      metadata.cycle_title.trim()
    ) {
      highlights.push(metadata.cycle_title.trim());
    }

    if (typeof metadata.new_state === "string" && metadata.new_state.trim()) {
      highlights.push(`Estado: ${metadata.new_state.trim()}`);
    }

    return highlights;
  }

  if (type === "driver_start" || type === "driver_finish") {
    const highlights: string[] = [];
    const cycleIndex = metadata.cycle_index;
    const kmValue =
      type === "driver_start" ? metadata.km_initial : metadata.km_final;

    if (typeof cycleIndex === "number") {
      highlights.push(`Ciclo ${cycleIndex + 1}`);
    }

    if (typeof kmValue === "number") {
      highlights.push(`KM ${kmValue.toLocaleString("pt-BR")}`);
    }

    return highlights;
  }

  if (type === "driver_accept") {
    const cycleIndex = metadata.cycle_index;
    return typeof cycleIndex === "number" ? [`Ciclo ${cycleIndex + 1}`] : [];
  }

  return [];
};
