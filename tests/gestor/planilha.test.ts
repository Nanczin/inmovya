import { describe, expect, it } from "bun:test";
import { interpretarPlanilha, lerCsv, numeroBR, urlCsvDaPlanilha } from "../../src/lib/gestor/planilhaSpartanos";

// Aba no formato da Spartanos: grupos na linha de cima, META/REALIZADO embaixo, um dia por linha e TOTAL no fim
const CAB_GRUPO = ["", "", "", "", "", "", "", "", "", "", "", "", "Interações", "", "", "", "Negociações", "", "", "", "Visitas", "", "", "", "Doc. Completa/Proposta", "", "", "", "Vendas Volume", "", "", "", "Vendas R$", ""];
const CAB = ["", "DIA MÊS", "DIA SEM.", "Daily", "Leads Midrah", "Leads Campanha Própria", "Leads Mínimo/dia", "Leads TOTAL", "Desvio", "Ligações (tentativas)", "Ligações (efetivas)", "Disparos enviados",
  "META", "REALIZADO", "Desvio", "Desvio%", "META", "REALIZADO", "Desvio", "Desvio%", "META", "REALIZADO", "Desvio", "Desvio%", "META", "REALIZADO", "Desvio", "Desvio%", "META", "REALIZADO", "Desvio", "Desvio%", "META", "REALIZADO"];
const linhaDia = (d: string, int: string, neg: string, vis: string) =>
  ["", d, "seg", "", "", "", "5", "", "", "10", "4", "", "11", int, "", "", "2", neg, "", "", "1", vis, "", "", "0", "", "", "", "0", "", "", "", "0", ""];
const csv = (linhas: string[][]) => linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");

const LINHAS = [
  ["Planilha Spartanos — Estevão"],
  [],
  ...Array.from({ length: 6 }, () => []),
  CAB_GRUPO,
  CAB,
  [],
  linhaDia("01/10", "12", "3", "1"),
  linhaDia("02/10", "8", "5", "0"),
  linhaDia("03/10", "", "", ""),
  ["", "TOTAL", "", "", "", "", "155", "", "", "", "", "", "334", "20", "", "", "51", "8", "", "", "32", "1", "", "", "6", "0", "", "", "1", "0", "", "", "R$ 218.522,00", "R$ 0,00"],
];

describe("planilha Spartanos", () => {
  it("monta o link do CSV", () => {
    expect(urlCsvDaPlanilha("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=123")).toBe(
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/gviz/tq?tqx=out:csv&gid=123"
    );
    expect(urlCsvDaPlanilha("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit", "77")).toContain("gid=77");
    expect(() => urlCsvDaPlanilha("abc")).toThrow();
  });
  it("lê números no formato brasileiro", () => {
    expect(numeroBR("R$ 218.522,00")).toBe(218522);
    expect(numeroBR("1.234")).toBe(1234);
    expect(numeroBR("12,5%")).toBe(12.5);
    expect(numeroBR("")).toBe(0);
  });
  it("lê CSV com aspas e vírgulas", () => {
    expect(lerCsv('"a","b,c"\n"1","2"')).toEqual([["a", "b,c"], ["1", "2"]]);
  });
  it("acha colunas pelo cabeçalho, metas no TOTAL e realizados por dia", () => {
    const r = interpretarPlanilha(lerCsv(csv(LINHAS)), "2026-10");
    expect(r.metas).toEqual({ interacoes: 334, negociacoes: 51, visitas: 32, documentacoes: 6, vendas_qtd: 1, vendas_valor: 218522, leads: 155 });
    expect(r.registros).toEqual([
      { data: "2026-10-01", interacoes: 12, negociacoes: 3, visitas: 1, documentacoes: 0, vendas: 0, venda_valor: 0 },
      { data: "2026-10-02", interacoes: 8, negociacoes: 5, visitas: 0, documentacoes: 0, vendas: 0, venda_valor: 0 },
    ]);
  });
  it("funciona com o cabeçalho numa linha só (\"Interações (META)\")", () => {
    const cab = ["DIA MÊS", "Interações (META)", "Interações (REALIZADO)", "Desvio", "Vendas Volume (META)", "Vendas Volume (REALIZADO)", "Vendas R$ (META)", "Vendas R$ (REALIZADO)"];
    const r = interpretarPlanilha([cab, ["5", "10", "7", "-3", "0", "1", "0", "R$ 300.000,00"], ["TOTAL", "300", "7", "", "2", "1", "R$ 500.000,00", "R$ 300.000,00"]], "2026-10");
    expect(r.metas.interacoes).toBe(300);
    expect(r.metas.vendas_qtd).toBe(2);
    expect(r.metas.vendas_valor).toBe(500000);
    expect(r.registros[0]).toEqual({ data: "2026-10-05", interacoes: 7, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 1, venda_valor: 300000 });
  });
  it("erro claro sem cabeçalho", () => {
    expect(() => interpretarPlanilha([["x"]], "2026-10")).toThrow(/DIA MÊS/);
  });
});
