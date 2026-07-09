import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  determineReminderPhase,
  normalizePhone,
  utcFromLocalDateTime,
  getReminder12hMinutes,
  getStartButtonMinutes,
  getPreStartMinutes,
  getPostStartMinutes,
  getCriticalDelayMinutes,
  type ReminderFlags,
  type PhaseDecisionInput,
} from "./os-reminders-logic";

// ---------------------------------------------------------------------------
// Helpers para construir inputs de teste
// ---------------------------------------------------------------------------

const ALL_FLAGS_ON: ReminderFlags = {
  global: true,
  reminder12h: true,
  startButton: true,
  delayAlert: true,
};

function makeInput(overrides: Partial<PhaseDecisionInput>): PhaseDecisionInput {
  return {
    diffMin: 0,
    messageSentAt: null,
    reminder12hSent: false,
    startButtonSent: false,
    preStartSent: false,
    post5Sent: false,
    post30Sent: false,
    flags: ALL_FLAGS_ON,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Testes: determineReminderPhase — lógica de janelas de tempo
// ---------------------------------------------------------------------------

describe("determineReminderPhase — janelas de tempo", () => {
  it("Fase 1 (12h): diffMin = -500 deve retornar reminder_12h", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: -500 }));
    assert.equal(decision.phase, "reminder_12h");
  });

  it("Fase 1 (12h): diffMin = -720 (limite) deve retornar reminder_12h", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: -720 }));
    assert.equal(decision.phase, "reminder_12h");
  });

  it("Fase 1 (12h): diffMin = -721 (fora da janela) deve retornar skip", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: -721 }));
    assert.equal(decision.phase, "skip");
  });

  it("Fase 1 (12h): já enviado deve avançar para fase 2 (dentro da janela 1h)", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: -30, reminder12hSent: true }),
    );
    assert.equal(decision.phase, "start_button");
  });

  it("Fase 2 (1h): diffMin = -30 deve retornar start_button", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: -30, reminder12hSent: true }),
    );
    assert.equal(decision.phase, "start_button");
  });

  it("Fase 2 (1h): diffMin = -60 (limite) deve retornar start_button", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: -60, reminder12hSent: true }),
    );
    assert.equal(decision.phase, "start_button");
  });

  it("Fase 2 (1h): diffMin = -61 (fora) com 12h enviado deve retornar skip", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: -61, reminder12hSent: true }),
    );
    assert.equal(decision.phase, "skip");
  });

  it("Fase 3 (15min): diffMin = -10 com message_sent_at deve retornar pre_start", () => {
    const decision = determineReminderPhase(
      makeInput({
        diffMin: -10,
        reminder12hSent: true,
        startButtonSent: true,
        messageSentAt: "2026-07-09T10:00:00Z",
      }),
    );
    assert.equal(decision.phase, "pre_start");
  });

  it("Fase 3 (15min): sem message_sent_at deve retornar skip", () => {
    const decision = determineReminderPhase(
      makeInput({
        diffMin: -10,
        reminder12hSent: true,
        startButtonSent: true,
        messageSentAt: null,
      }),
    );
    assert.equal(decision.phase, "skip");
  });

  it("Fase 3 (15min): já enviado deve retornar skip", () => {
    const decision = determineReminderPhase(
      makeInput({
        diffMin: -10,
        reminder12hSent: true,
        startButtonSent: true,
        preStartSent: true,
        messageSentAt: "2026-07-09T10:00:00Z",
      }),
    );
    assert.equal(decision.phase, "skip");
  });
});

// ---------------------------------------------------------------------------
// Testes: determineReminderPhase — após o horário (atraso)
// ---------------------------------------------------------------------------

describe("determineReminderPhase — alertas de atraso", () => {
  it("T+5: diffMin = 5 deve retornar post_start_5", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: 5 }));
    assert.equal(decision.phase, "post_start_5");
    assert.equal(decision.minutesLate, 5);
  });

  it("T+5: diffMin = 29 deve retornar post_start_5", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: 29 }));
    assert.equal(decision.phase, "post_start_5");
    assert.equal(decision.minutesLate, 29);
  });

  it("T+30: diffMin = 30 deve retornar post_start_30 (skip T+5)", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: 30 }));
    assert.equal(decision.phase, "post_start_30");
    assert.equal(decision.minutesLate, 30);
  });

  it("T+30: diffMin = 45 com T+5 não enviado ainda deve retornar post_start_30", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 45, post5Sent: false }),
    );
    assert.equal(decision.phase, "post_start_30");
  });

  it("T+30 já enviado deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 60, post30Sent: true }),
    );
    assert.equal(decision.phase, "idle");
  });

  it("T+3 (antes de T+5) deve retornar idle", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: 3 }));
    assert.equal(decision.phase, "idle");
  });

  it("T+5 já enviado (diffMin = 10) deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 10, post5Sent: true }),
    );
    assert.equal(decision.phase, "idle");
  });
});

// ---------------------------------------------------------------------------
// Testes: determineReminderPhase — isToday (não notifica OS de dias anteriores)
// ---------------------------------------------------------------------------

describe("determineReminderPhase — isToday (OS antigas)", () => {
  it("T+5 de OS de ontem (isToday=false) deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 5, isToday: false }),
    );
    assert.equal(decision.phase, "idle");
  });

  it("T+30 de OS de ontem (isToday=false) deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 30, isToday: false }),
    );
    assert.equal(decision.phase, "idle");
  });

  it("T+1200 de OS antiga (isToday=false) deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 1200, isToday: false }),
    );
    assert.equal(decision.phase, "idle");
  });

  it("T+300 de OS antiga (isToday=false) deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 300, isToday: false }),
    );
    assert.equal(decision.phase, "idle");
  });

  it("T+5 de OS de hoje (isToday=true) deve retornar post_start_5", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 5, isToday: true }),
    );
    assert.equal(decision.phase, "post_start_5");
  });

  it("T+30 de OS de hoje (isToday=true) deve retornar post_start_30", () => {
    const decision = determineReminderPhase(
      makeInput({ diffMin: 30, isToday: true }),
    );
    assert.equal(decision.phase, "post_start_30");
  });

  it("isToday default (não informado) mantém comportamento anterior", () => {
    const decision = determineReminderPhase(makeInput({ diffMin: 10 }));
    assert.equal(decision.phase, "post_start_5");
  });
});

// ---------------------------------------------------------------------------
// Testes: determineReminderPhase — feature flags
// ---------------------------------------------------------------------------

describe("determineReminderPhase — feature flags", () => {
  it("Flag 12h desligado: diffMin = -30 deve pular fase 1 e ir para fase 2", () => {
    const decision = determineReminderPhase(
      makeInput({
        diffMin: -30,
        flags: { ...ALL_FLAGS_ON, reminder12h: false },
      }),
    );
    assert.equal(decision.phase, "start_button");
  });

  it("Flag start_button desligado: diffMin = -30 deve pular fase 2", () => {
    const decision = determineReminderPhase(
      makeInput({
        diffMin: -30,
        reminder12hSent: true,
        flags: { ...ALL_FLAGS_ON, startButton: false },
      }),
    );
    // diffMin = -30 está dentro da janela de pre_start (-15)? Não, -30 < -15
    assert.equal(decision.phase, "skip");
  });

  it("Flag delay_alert desligado: T+10 deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({
        diffMin: 10,
        flags: { ...ALL_FLAGS_ON, delayAlert: false },
      }),
    );
    assert.equal(decision.phase, "idle");
  });

  it("Flag delay_alert desligado: T+45 deve retornar idle", () => {
    const decision = determineReminderPhase(
      makeInput({
        diffMin: 45,
        flags: { ...ALL_FLAGS_ON, delayAlert: false },
      }),
    );
    assert.equal(decision.phase, "idle");
  });

  it("Todos os flags de fase desligados: qualquer diffMin → skip ou idle", () => {
    const flagsOff: ReminderFlags = {
      global: true,
      reminder12h: false,
      startButton: false,
      delayAlert: false,
    };
    // Antes do horário
    assert.equal(
      determineReminderPhase(makeInput({ diffMin: -500, flags: flagsOff }))
        .phase,
      "skip",
    );
    // Após o horário
    assert.equal(
      determineReminderPhase(makeInput({ diffMin: 45, flags: flagsOff })).phase,
      "idle",
    );
  });
});

// ---------------------------------------------------------------------------
// Testes: normalizePhone
// ---------------------------------------------------------------------------

describe("normalizePhone", () => {
  it("adiciona 55 se não tiver DDI", () => {
    assert.equal(normalizePhone("11999999999"), "5511999999999");
  });

  it("mantém 55 se já tiver DDI", () => {
    assert.equal(normalizePhone("5511999999999"), "5511999999999");
  });

  it("remove caracteres não numéricos", () => {
    assert.equal(normalizePhone("+55 (11) 99999-9999"), "5511999999999");
  });

  it("retorna null para telefone nulo", () => {
    assert.equal(normalizePhone(null), null);
  });

  it("retorna null para telefone muito curto", () => {
    assert.equal(normalizePhone("12345"), null);
  });
});

// ---------------------------------------------------------------------------
// Testes: utcFromLocalDateTime
// ---------------------------------------------------------------------------

describe("utcFromLocalDateTime", () => {
  it("converte data/hora local Brasília para UTC corretamente", () => {
    const result = utcFromLocalDateTime(
      "2026-07-09",
      "14:00",
      "America/Sao_Paulo",
    );
    assert.ok(result);
    // Brasília é UTC-3, então 14:00 local = 17:00 UTC
    assert.equal(result!.getUTCHours(), 17);
    assert.equal(result!.getUTCMinutes(), 0);
  });

  it("retorna null para data nula", () => {
    assert.equal(
      utcFromLocalDateTime(null, "14:00", "America/Sao_Paulo"),
      null,
    );
  });

  it("retorna null para hora nula", () => {
    assert.equal(
      utcFromLocalDateTime("2026-07-09", null, "America/Sao_Paulo"),
      null,
    );
  });

  it("retorna null para data inválida", () => {
    assert.equal(
      utcFromLocalDateTime("invalid", "14:00", "America/Sao_Paulo"),
      null,
    );
  });
});

// ---------------------------------------------------------------------------
// Testes: configurações de minutos (env vars com defaults)
// ---------------------------------------------------------------------------

describe("configurações de minutos (defaults)", () => {
  it("getReminder12hMinutes deve retornar 720 por padrão", () => {
    assert.equal(getReminder12hMinutes(), 720);
  });

  it("getStartButtonMinutes deve retornar 60 por padrão", () => {
    assert.equal(getStartButtonMinutes(), 60);
  });

  it("getPreStartMinutes deve retornar 15 por padrão", () => {
    assert.equal(getPreStartMinutes(), 15);
  });

  it("getPostStartMinutes deve retornar 5 por padrão", () => {
    assert.equal(getPostStartMinutes(), 5);
  });

  it("getCriticalDelayMinutes deve retornar 30 por padrão", () => {
    assert.equal(getCriticalDelayMinutes(), 30);
  });
});
