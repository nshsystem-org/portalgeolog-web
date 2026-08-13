import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseMoneyInput,
  formatMoneyDisplay,
  maskMoneyInput,
  calculateMoneyCursorPos,
} from "./money";

// ---------------------------------------------------------------------------
// parseMoneyInput
// ---------------------------------------------------------------------------
describe("parseMoneyInput", () => {
  it("parse '720' -> 720", () => {
    assert.equal(parseMoneyInput("720"), 720);
  });

  it("parse '720,50' -> 720.5 (vírgula como decimal)", () => {
    assert.equal(parseMoneyInput("720,50"), 720.5);
  });

  it("parse '1.234,56' -> 1234.56 (pt-BR completo)", () => {
    assert.equal(parseMoneyInput("1.234,56"), 1234.56);
  });

  it("parse '1234.56' -> 1234.56 (formato US)", () => {
    assert.equal(parseMoneyInput("1234.56"), 1234.56);
  });

  it("parse 'R$ 1.234,56' -> 1234.56 (com prefixo)", () => {
    assert.equal(parseMoneyInput("R$ 1.234,56"), 1234.56);
  });

  it("parse '  0,01  ' -> 0.01 (com espaços)", () => {
    assert.equal(parseMoneyInput("  0,01  "), 0.01);
  });

  it("parse '' -> null (vazio)", () => {
    assert.equal(parseMoneyInput(""), null);
  });

  it("parse 'abc' -> null (não numérico)", () => {
    assert.equal(parseMoneyInput("abc"), null);
  });

  it("parse '-10' -> null (negativo rejeitado)", () => {
    assert.equal(parseMoneyInput("-10"), null);
  });

  it("parse '0' -> 0", () => {
    assert.equal(parseMoneyInput("0"), 0);
  });

  it("parse '1.000.000,00' -> 1000000 (milhões)", () => {
    assert.equal(parseMoneyInput("1.000.000,00"), 1000000);
  });
});

// ---------------------------------------------------------------------------
// formatMoneyDisplay
// ---------------------------------------------------------------------------
describe("formatMoneyDisplay", () => {
  it("format 1234.5 -> '1.234,50'", () => {
    assert.equal(formatMoneyDisplay(1234.5), "1.234,50");
  });

  it("format 0 -> '0,00'", () => {
    assert.equal(formatMoneyDisplay(0), "0,00");
  });

  it("format 1000000 -> '1.000.000,00'", () => {
    assert.equal(formatMoneyDisplay(1000000), "1.000.000,00");
  });

  it("format 0.01 -> '0,01'", () => {
    assert.equal(formatMoneyDisplay(0.01), "0,01");
  });
});

// ---------------------------------------------------------------------------
// maskMoneyInput
// ---------------------------------------------------------------------------
describe("maskMoneyInput", () => {
  it("mask '1234' -> '1.234'", () => {
    assert.equal(maskMoneyInput("1234"), "1.234");
  });

  it("mask '1234,5' -> '1.234,5'", () => {
    assert.equal(maskMoneyInput("1234,5"), "1.234,5");
  });

  it("mask '1234,56' -> '1.234,56'", () => {
    assert.equal(maskMoneyInput("1234,56"), "1.234,56");
  });

  it("mask '1234567' -> '1.234.567'", () => {
    assert.equal(maskMoneyInput("1234567"), "1.234.567");
  });

  it("mask '0' -> '0'", () => {
    assert.equal(maskMoneyInput("0"), "0");
  });

  it("mask '0,5' -> '0,5'", () => {
    assert.equal(maskMoneyInput("0,5"), "0,5");
  });

  it("mask 'abc123' -> '123' (remove não-numéricos)", () => {
    assert.equal(maskMoneyInput("abc123"), "123");
  });

  it("mask '1,2,3' -> '1,23' (só uma vírgula)", () => {
    assert.equal(maskMoneyInput("1,2,3"), "1,23");
  });

  it("mask '1234,567' -> '1.234,56' (limita 2 decimais)", () => {
    assert.equal(maskMoneyInput("1234,567"), "1.234,56");
  });

  it("mask '001234' -> '1.234' (remove zeros à esquerda)", () => {
    assert.equal(maskMoneyInput("001234"), "1.234");
  });

  it("mask '5584,' -> '5.584,' (preserva vírgula recém-digitada sem decimais)", () => {
    assert.equal(maskMoneyInput("5584,"), "5.584,");
  });

  it("mask '0,' -> '0,' (vírgula isolada não é descartada)", () => {
    assert.equal(maskMoneyInput("0,"), "0,");
  });
});

// ---------------------------------------------------------------------------
// calculateMoneyCursorPos
// ---------------------------------------------------------------------------
describe("calculateMoneyCursorPos", () => {
  it("cursor no fim ao digitar 4º dígito (gera separador de milhar)", () => {
    // usuário digitou "5584", cursor no fim (pos 4)
    // máscara -> "5.584", cursor deve ir para o fim (pos 5)
    assert.equal(calculateMoneyCursorPos("5584", 4, "5.584"), 5);
  });

  it("cursor após vírgula recém-digitada", () => {
    // "5.584," cursor na pos 6 (após vírgula)
    assert.equal(calculateMoneyCursorPos("5.584,", 6, "5.584,"), 6);
  });

  it("cursor na parte decimal preserva offset da vírgula", () => {
    // "5.584,8" cursor na pos 7 -> "5.584,8" pos 7
    assert.equal(calculateMoneyCursorPos("5.584,8", 7, "5.584,8"), 7);
  });

  it("cursor no meio da parte inteira", () => {
    // "5584" cursor na pos 2 (entre "55" e "84") -> "5.584" após 2 dígitos = pos 3
    assert.equal(calculateMoneyCursorPos("5584", 2, "5.584"), 3);
  });

  it("cursor no início", () => {
    assert.equal(calculateMoneyCursorPos("5584", 0, "5.584"), 0);
  });

  it("remoção de zero à esquerda ajusta cursor", () => {
    // "0012" cursor no fim (pos 4) -> "12" cursor no fim (pos 2)
    assert.equal(calculateMoneyCursorPos("0012", 4, "12"), 2);
  });

  it("cursor além do fim (clamp)", () => {
    assert.equal(calculateMoneyCursorPos("5584", 99, "5.584"), 5);
  });

  it("vírgula removida pela máscara manda cursor ao fim", () => {
    // vírgula sem decimais pode ser removida em alguns fluxos
    assert.equal(calculateMoneyCursorPos("5,", 2, "5"), 1);
  });

  it("valor vazio", () => {
    assert.equal(calculateMoneyCursorPos("", 0, ""), 0);
  });
});
