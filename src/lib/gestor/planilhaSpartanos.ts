// Importação da planilha "Spartanos" (Google Sheets) — lê o CSV público da aba e acha as colunas pelo texto do cabeçalho.
import type { Metas, RegistroDia } from "./metricas";

export function urlCsvDaPlanilha(link: string, gid?: string) {
  const id = (link.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || (/^[a-zA-Z0-9_-]{20,}$/.test(link.trim()) ? link.trim() : "");
  if (!id) throw new Error("Link da planilha inválido. Cole o link do Google Sheets (…/spreadsheets/d/…).");
  const g = (gid || "").trim() || (link.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${g}`;
}

/** CSV → linhas (aceita aspas, vírgulas e quebras de linha dentro das células). */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let cel = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { cel += '"'; i++; }
      else if (c === '"') aspas = false;
      else cel += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(cel); cel = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(cel); linhas.push(linha); linha = []; cel = "";
    } else cel += c;
  }
  if (cel !== "" || linha.length) { linha.push(cel); linhas.push(linha); }
  return linhas;
}

const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** "R$ 218.522,00" → 218522 · "1.234" → 1234 · "12,5%" → 12.5 · "" → 0 */
export function numeroBR(v: string): number {
  const s = String(v || "").replace(/[R$\s%]/g, "").trim();
  if (!s || s === "-") return 0;
  let t = s;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

type Campo =
  | "dia"
  | "leads_min"
  | "leads_total"
  | "lig_tent"
  | "lig_efet"
  | "int_meta" | "int_real"
  | "neg_meta" | "neg_real"
  | "vis_meta" | "vis_real"
  | "doc_meta" | "doc_real"
  | "ven_meta" | "ven_real"
  | "rs_meta" | "rs_real";

// regras: todas as palavras de "tem" e nenhuma de "nao"
const REGRAS: { campo: Campo; tem: RegExp[]; nao?: RegExp[] }[] = [
  { campo: "dia", tem: [/dia/, /mes/], nao: [/sem/] },
  { campo: "leads_min", tem: [/lead/, /minimo/] },
  { campo: "leads_total", tem: [/lead/, /total/] },
  { campo: "lig_tent", tem: [/liga/, /tentativ/] },
  { campo: "lig_efet", tem: [/liga/, /efetiv/] },
  { campo: "int_meta", tem: [/intera/, /meta/] },
  { campo: "int_real", tem: [/intera/, /realiz/] },
  { campo: "neg_meta", tem: [/negocia/, /meta/] },
  { campo: "neg_real", tem: [/negocia/, /realiz/] },
  { campo: "vis_meta", tem: [/visita/, /meta/] },
  { campo: "vis_real", tem: [/visita/, /realiz/] },
  { campo: "doc_meta", tem: [/doc|proposta/, /meta/] },
  { campo: "doc_real", tem: [/doc|proposta/, /realiz/] },
  { campo: "rs_meta", tem: [/venda/, /r\$|valor|reais/, /meta/] },
  { campo: "rs_real", tem: [/venda/, /r\$|valor|reais/, /realiz/] },
  { campo: "ven_meta", tem: [/venda/, /meta/], nao: [/r\$|valor|reais/] },
  { campo: "ven_real", tem: [/venda/, /realiz/], nao: [/r\$|valor|reais/] },
];

export interface ImportacaoPlanilha {
  metas: Partial<Metas>;
  registros: RegistroDia[];
  colunasAchadas: string[];
  avisos: string[];
}

/**
 * Acha a linha do cabeçalho (a que tem "DIA MÊS"), junta com a linha de cima (grupos como "Interações" sobre "META/REALIZADO"),
 * lê os dias até a linha TOTAL e as metas da linha TOTAL.
 */
export function interpretarPlanilha(linhas: string[][], mes: string): ImportacaoPlanilha {
  const avisos: string[] = [];
  const iCab = linhas.findIndex((l) => l.some((c) => /dia\s*m[eê]s/i.test(c) || /^dia$/i.test(c.trim())));
  if (iCab < 0) throw new Error('Não achei o cabeçalho (coluna "DIA MÊS") na aba. Confira o gid da sua aba.');
  const cab = linhas[iCab];
  const cima = iCab > 0 ? linhas[iCab - 1] : [];
  // grupo herdado da linha de cima (célula mesclada fica só na primeira coluna)
  let grupo = "";
  const nomes = cab.map((c, j) => {
    if ((cima[j] || "").trim()) grupo = cima[j];
    const proprio = norm(c);
    // se a própria célula já diz o grupo (ex.: "Interações (META)"), não repete
    return norm(`${/meta|realiz|desvio/.test(proprio) && !/intera|negocia|visita|doc|proposta|venda|lead|liga/.test(proprio) ? grupo : ""} ${c}`);
  });
  const col: Partial<Record<Campo, number>> = {};
  nomes.forEach((nome, j) => {
    if (!nome || /desvio/.test(nome)) return;
    for (const r of REGRAS) {
      if (col[r.campo] !== undefined) continue;
      if (r.tem.every((x) => x.test(nome)) && !(r.nao || []).some((x) => x.test(nome))) {
        col[r.campo] = j;
        break;
      }
    }
  });
  if (col.dia === undefined) col.dia = cab.findIndex((c) => /dia/i.test(c));
  const achadas = Object.keys(col);
  if (col.int_meta === undefined && col.int_real === undefined) avisos.push("Não achei as colunas de Interações.");

  const iTotal = linhas.findIndex((l, i) => i > iCab && l.some((c) => /^\s*total\s*$/i.test(c)));
  const val = (l: string[], c?: Campo) => (c !== undefined && col[c] !== undefined ? numeroBR(l[col[c] as number] || "") : 0);

  const metas: Partial<Metas> = {};
  if (iTotal >= 0) {
    const t = linhas[iTotal];
    metas.interacoes = val(t, "int_meta");
    metas.negociacoes = val(t, "neg_meta");
    metas.visitas = val(t, "vis_meta");
    metas.documentacoes = val(t, "doc_meta");
    metas.vendas_qtd = val(t, "ven_meta");
    metas.vendas_valor = val(t, "rs_meta");
    if (col.leads_min !== undefined) metas.leads = val(t, "leads_min");
  } else avisos.push("Não achei a linha TOTAL — as metas não foram lidas.");

  const fim = iTotal >= 0 ? iTotal : linhas.length;
  const [ano, m] = mes.split("-").map(Number);
  const registros: RegistroDia[] = [];
  for (let i = iCab + 1; i < fim; i++) {
    const l = linhas[i];
    const bruto = String(l[col.dia as number] || "").trim();
    const mDia = bruto.match(/^(\d{1,2})(?:[/\-.](\d{1,2}))?/);
    if (!mDia) continue;
    const dia = Number(mDia[1]);
    if (dia < 1 || dia > new Date(ano, m, 0).getDate()) continue;
    const r: RegistroDia = {
      data: `${ano}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
      interacoes: val(l, "int_real"),
      negociacoes: val(l, "neg_real"),
      visitas: val(l, "vis_real"),
      documentacoes: val(l, "doc_real"),
      vendas: val(l, "ven_real"),
      venda_valor: val(l, "rs_real"),
    };
    // só dias com algo preenchido (não cria registro zerado para dia futuro)
    if (r.interacoes || r.negociacoes || r.visitas || r.documentacoes || r.vendas || r.venda_valor) registros.push(r);
  }
  return { metas, registros, colunasAchadas: achadas, avisos };
}

export async function baixarPlanilha(link: string, gid?: string): Promise<string[][]> {
  const url = urlCsvDaPlanilha(link, gid);
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    throw new Error('Não consegui abrir a planilha. Ela precisa estar compartilhada como "Qualquer pessoa com o link pode ver".');
  }
  const texto = await resp.text();
  if (!resp.ok || /<html/i.test(texto.slice(0, 300))) {
    throw new Error('A planilha não liberou a leitura. Compartilhe como "Qualquer pessoa com o link pode ver" e confira o gid da sua aba.');
  }
  return lerCsv(texto);
}
