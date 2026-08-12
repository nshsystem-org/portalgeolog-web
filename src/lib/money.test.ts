import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMoneyInput, formatMoneyDisplay, maskMoneyInput } from "./money";

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
});
