import { describe, expect, it } from "bun:test";
import {
  acharGargalo,
  calcularConversoes,
  calcularMes,
  contarDias,
  desempenhoPorDiaSemana,
  diasPassados,
  leadsParados,
  ofertaAtiva,
  type Metas,
  type RegistroDia,
} from "../../src/lib/gestor/metricas";

// Outubro do Estevão: metas e realizado até 19/10
export const METAS_OUT: Metas = {
  interacoes: 334,
  negociacoes: 51,
  visitas: 32,
  documentacoes: 6,
  vendas_qtd: 1,
  vendas_valor: 218522,
  leads: 0,
  ligacoes: 0,
  so_dias_uteis: false,
};
export const REG_OUT: RegistroDia[] = [
  { data: "2026-10-06", interacoes: 80, negociacoes: 40, visitas: 5, documentacoes: 1, vendas: 0, venda_valor: 0 },
  { data: "2026-10-19", interacoes: 69, negociacoes: 30, visitas: 3, documentacoes: 0, vendas: 0, venda_valor: 0 },
  { data: "2026-09-30", interacoes: 999, negociacoes: 999, visitas: 999, documentacoes: 9, vendas: 9, venda_valor: 9 }, // outro mês: ignora
];
export const HOJE = new Date(2026, 9, 20, 10, 0);

describe("dias do mês", () => {
  it("conta decorridos (antes de hoje) e restantes (de hoje até o fim)", () => {
    expect(contarDias("2026-10", HOJE, false)).toEqual({ decorridos: 19, restantes: 12, total: 31 });
  });
  it("só dias úteis", () => {
    const d = contarDias("2026-10", HOJE, true);
    expect(d.total).toBe(22);
    expect(d.decorridos + d.restantes).toBe(22);
    expect(d.decorridos).toBe(13); // 1/10/2026 é quinta
  });
  it("dias úteis passados", () => {
    expect(diasPassados("2026-10", HOJE)).toHaveLength(13);
    expect(diasPassados("2026-10", HOJE)[0]).toBe("2026-10-01");
  });
});

describe("meta x realizado (outubro)", () => {
  const r = calcularMes({ mes: "2026-10", hoje: HOJE, metas: METAS_OUT, registros: REG_OUT, leadsNoMes: 0, ligacoesNoMes: 0 });
  const m = (id: string) => r.metricas.find((x) => x.id === id)!;

  it("soma só o mês escolhido", () => {
    expect(r.realizado.interacoes).toBe(149);
    expect(r.realizado.negociacoes).toBe(70);
    expect(r.realizado.visitas).toBe(8);
    expect(r.realizado.documentacoes).toBe(1);
    expect(r.realizado.vendas_qtd).toBe(0);
  });
  it("interações: falta, ritmo, média, projeção e status", () => {
    const i = m("interacoes");
    expect(i.falta).toBe(185);
    expect(i.ritmoNecessario).toBeCloseTo(185 / 12, 5);
    expect(i.mediaDiaria).toBeCloseTo(149 / 19, 5);
    expect(i.projecao).toBeCloseTo(149 + (149 / 19) * 12, 5);
    expect(i.pctAtingido).toBeCloseTo(44.61, 1);
    expect(i.status).toBe("fora");
  });
  it("negociações acima da meta = batida", () => {
    expect(m("negociacoes").status).toBe("batida");
    expect(m("negociacoes").falta).toBe(0);
  });
  it("visitas fora do ritmo", () => {
    const v = m("visitas");
    expect(v.falta).toBe(24);
    expect(v.ritmoNecessario).toBe(2);
    expect(v.status).toBe("fora");
  });
  it("atenção entre 80% e 100% da projeção", () => {
    const x = calcularMes({ mes: "2026-10", hoje: HOJE, metas: { ...METAS_OUT, interacoes: 270 }, registros: REG_OUT, leadsNoMes: 0, ligacoesNoMes: 0 });
    expect(x.metricas.find((y) => y.id === "interacoes")!.status).toBe("atencao"); // projeção 243 / 270 = 90%
  });
  it("sem meta", () => {
    expect(m("leads").status).toBe("sem_meta");
  });
});

describe("conversões e gargalo", () => {
  const c = calcularConversoes({ interacoes: 149, negociacoes: 70, visitas: 8, documentacoes: 1, vendas_qtd: 0 }, METAS_OUT);
  it("taxas reais e da meta", () => {
    expect(c[1].taxaReal).toBeCloseTo((8 / 70) * 100, 5);
    expect(c[1].taxaMeta).toBeCloseTo((32 / 51) * 100, 5);
  });
  it("gargalo é negociação → visita (proposta → venda tem amostra pequena)", () => {
    const g = acharGargalo(c)!;
    expect(g.de).toBe("negociacoes");
    expect(g.para).toBe("visitas");
    expect(c[3].amostraSuficiente).toBe(false);
  });
  it("sem gargalo quando tudo está acima da meta", () => {
    expect(acharGargalo(calcularConversoes({ interacoes: 100, negociacoes: 50, visitas: 40, documentacoes: 10, vendas_qtd: 5 }, METAS_OUT))).toBeNull();
  });
});

describe("dia da semana", () => {
  it("média por dia da semana", () => {
    const s = desempenhoPorDiaSemana([
      { data: "2026-10-05", interacoes: 20, negociacoes: 0, visitas: 2, documentacoes: 0, vendas: 0, venda_valor: 0 }, // segunda
      { data: "2026-10-12", interacoes: 10, negociacoes: 0, visitas: 0, documentacoes: 0, vendas: 0, venda_valor: 0 }, // segunda
      { data: "2026-10-09", interacoes: 5, negociacoes: 0, visitas: 1, documentacoes: 0, vendas: 0, venda_valor: 0 }, // sexta
    ]);
    expect(s[1].mediaInteracoes).toBe(15);
    expect(s[1].mediaVisitas).toBe(1);
    expect(s[5].mediaInteracoes).toBe(5);
  });
});

describe("Oferta Ativa", () => {
  it("ligações/dia e queda do % de interessados", () => {
    const lig = [
      ...Array.from({ length: 10 }, (_, i) => ({ data: new Date(2026, 9, 12, 10, i).toISOString(), interessado: i < 4 })), // anterior: 40%
      ...Array.from({ length: 20 }, (_, i) => ({ data: new Date(2026, 9, 18, 10, i).toISOString(), interessado: i < 4 })), // atual: 20%
    ];
    const o = ofertaAtiva(lig, new Date(2026, 9, 14), new Date(2026, 9, 21), new Date(2026, 9, 7));
    expect(o.ligacoes).toBe(20);
    expect(o.porDia).toBeCloseTo(20 / 7, 5);
    expect(o.taxaInteresse).toBe(20);
    expect(o.taxaInteresseAnterior).toBe(40);
    expect(o.variacaoTaxa).toBeCloseTo(-0.5, 5);
  });
});

describe("leads parados", () => {
  it("usa o limite de cada etapa e ignora quem tem lembrete", () => {
    const dia = (n: number) => new Date(HOJE.getTime() - n * 86400000).toISOString();
    const p = leadsParados(
      [
        { id: "a", nome: "A", etapa: "20", ultimaInteracao: dia(3), temLembreteAberto: false, avanco: 1 },
        { id: "b", nome: "B", etapa: "20", ultimaInteracao: dia(1), temLembreteAberto: false, avanco: 1 },
        { id: "c", nome: "C", etapa: "50", ultimaInteracao: dia(5), temLembreteAberto: true, avanco: 2 },
        { id: "d", nome: "D", etapa: "70", ultimaInteracao: null, temLembreteAberto: false, avanco: 3 },
        { id: "e", nome: "E", etapa: "documentacao", ultimaInteracao: dia(30), temLembreteAberto: false, avanco: 4 },
      ],
      HOJE
    );
    expect(p["20"].map((x) => x.id)).toEqual(["a"]);
    expect(p["50"]).toHaveLength(0);
    expect(p["70"].map((x) => x.id)).toEqual(["d"]);
  });
});
