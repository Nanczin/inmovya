import { describe, expect, it } from "bun:test";
import { calcularMes, desempenhoPorDiaSemana, leadsParados, type LeadParaGestor } from "../../src/lib/gestor/metricas";
import { gerarInsights, gerarPlanoHoje } from "../../src/lib/gestor/insights";
import { HOJE, METAS_OUT, REG_OUT } from "./metricas.test";

const dia = (n: number, base = HOJE) => new Date(base.getTime() - n * 86400000).toISOString();
const LEADS: LeadParaGestor[] = [
  { id: "n1", nome: "Ana", etapa: "70", ultimaInteracao: dia(1), temLembreteAberto: true, avanco: 3 },
  { id: "n2", nome: "Bruno", etapa: "70", ultimaInteracao: dia(0), temLembreteAberto: true, avanco: 3 },
  { id: "n3", nome: "Carla", etapa: "50", ultimaInteracao: dia(6), temLembreteAberto: false, avanco: 2 },
  { id: "d1", nome: "Davi", etapa: "documentacao", ultimaInteracao: dia(2), temLembreteAberto: true, avanco: 4 },
  { id: "z1", nome: "Zé", etapa: "20", ultimaInteracao: dia(1), temLembreteAberto: false, avanco: 1 },
];

function montar(hoje = HOJE, extra: Partial<Parameters<typeof gerarInsights>[0]> = {}) {
  const r = calcularMes({ mes: "2026-10", hoje, metas: METAS_OUT, registros: REG_OUT, leadsNoMes: 0, ligacoesNoMes: 0 });
  return gerarInsights({
    metricas: r.metricas,
    conversoes: r.conversoes,
    gargalo: r.gargalo,
    diasRestantes: r.dias.restantes,
    leads: LEADS,
    parados: leadsParados(LEADS, hoje),
    semana: desempenhoPorDiaSemana(REG_OUT),
    diasSemRegistro: [],
    oferta: { taxaInteresse: null, taxaInteresseAnterior: null, variacaoTaxa: null, ligacoes: 0 },
    ...extra,
  });
}

describe("insights (outubro)", () => {
  const ins = montar();
  it("primeiro o gargalo negociação → visita, com os números e os leads em 70% mais recentes", () => {
    expect(ins[0].id).toBe("gargalo");
    expect(ins[0].texto).toContain("negociação → visita");
    expect(ins[0].texto).toContain("70 negociações viraram 8 visitas");
    expect(ins[0].texto).toContain("11%");
    expect(ins[0].texto).toContain("63%");
    expect(ins[0].acoes.map((a) => a.label)).toEqual(["Bruno", "Ana", "Carla"]);
  });
  it("ritmo com faltas e média", () => {
    const r = ins.find((i) => i.id === "ritmo")!;
    expect(r.prioridade).toBe("alta");
    expect(r.texto).toContain("Faltam 185 interações. Você precisa de 15,4 por dia; sua média é 7,8.");
    expect(r.texto).toContain("Faltam 24 visitas");
  });
  it("meta de negociações batida sugere converter em visitas", () => {
    const b = ins.find((i) => i.id === "batida")!;
    expect(b.texto).toContain("70 de 51 negociações");
    expect(b.texto).toContain("converter em visitas");
  });
  it("leads parados por etapa", () => {
    expect(ins.find((i) => i.id === "parados-50")!.acoes[0].leadIds).toEqual(["n3"]);
  });
  it("sem foco de venda com 12 dias restantes; com 10 dias, sim (mais avançados primeiro)", () => {
    expect(ins.find((i) => i.id === "venda")).toBeUndefined();
    const v = montar(new Date(2026, 9, 22, 10)).find((i) => i.id === "venda")!;
    expect(v.acoes.map((a) => a.label)).toEqual(["Davi", "Bruno", "Ana"]);
  });
  it("no máximo 6 e ordenado por prioridade", () => {
    const muitos = montar(new Date(2026, 9, 22, 10), {
      diasSemRegistro: ["2026-10-01", "2026-10-02"],
      oferta: { taxaInteresse: 10, taxaInteresseAnterior: 30, variacaoTaxa: -0.67, ligacoes: 50 },
    });
    expect(muitos.length).toBeLessThanOrEqual(6);
    const peso = { alta: 0, media: 1, baixa: 2 };
    for (let i = 1; i < muitos.length; i++) expect(peso[muitos[i].prioridade]).toBeGreaterThanOrEqual(peso[muitos[i - 1].prioridade]);
  });
  it("Oferta Ativa e registro faltando", () => {
    const x = montar(HOJE, {
      diasSemRegistro: ["2026-10-01"],
      oferta: { taxaInteresse: 10, taxaInteresseAnterior: 30, variacaoTaxa: -0.67, ligacoes: 50 },
    });
    expect(x.some((i) => i.id === "oferta")).toBe(true);
    expect(x.find((i) => i.id === "registro")?.texto).toContain("01/10");
  });
  it("dia da semana: segundas 2x as sextas", () => {
    const reg = [
      { data: "2026-10-05", interacoes: 20, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0, venda_valor: 0 },
      { data: "2026-10-12", interacoes: 20, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0, venda_valor: 0 },
      { data: "2026-10-02", interacoes: 10, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0, venda_valor: 0 },
      { data: "2026-10-09", interacoes: 10, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0, venda_valor: 0 },
    ];
    const s = gerarInsights({
      metricas: [],
      conversoes: [],
      gargalo: null,
      diasRestantes: 12,
      leads: [],
      parados: { "20": [], "50": [], "70": [] },
      semana: desempenhoPorDiaSemana(reg),
      diasSemRegistro: [],
      oferta: { taxaInteresse: null, taxaInteresseAnterior: null, variacaoTaxa: null, ligacoes: 0 },
    });
    expect(s[0].texto).toContain("Suas segundas rendem 2x mais interações que as sextas");
  });
});

describe("plano de hoje", () => {
  it("transforma ritmo e gargalo em tarefas", () => {
    const r = calcularMes({ mes: "2026-10", hoje: HOJE, metas: METAS_OUT, registros: REG_OUT, leadsNoMes: 0, ligacoesNoMes: 0 });
    const plano = gerarPlanoHoje(r.metricas, montar());
    const textos = plano.map((p) => p.texto);
    expect(textos).toContain("Fazer 16 interações");
    expect(textos).toContain("Marcar 2 visitas");
    expect(textos.some((t) => t.startsWith("Chamar: Bruno, Ana"))).toBe(true);
    expect(plano.find((p) => p.id === "meta-interacoes")!.campo).toBe("interacoes");
    expect(textos.some((t) => /negocia/.test(t))).toBe(false); // meta batida não vira tarefa
  });
});
