// Spintax: {Oi|Olá|Oii} escolhe uma opção (aceita um dentro do outro). Usado no 1º contato e nas esteiras.
// ---------- Spintax: {Oi|Olá|Oii} escolhe uma opção ao acaso (aceita um dentro do outro) ----------
// As variáveis {{nome}}, {{saudacao}}... (chaves duplas) não são mexidas. A extensão usa a mesma regra.
const protegerVariaveis = (texto: string) => {
  const vars: string[] = [];
  const t = String(texto || "").replace(/\{\{[^{}]*\}\}/g, (m) => `\u0000${vars.push(m) - 1}\u0000`);
  return { t, voltar: (s: string) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => vars[+i]) };
};

/** Sorteio repetível: a mesma semente sempre escolhe as mesmas opções (a prévia é igual ao que vai). */
const sorteador = (semente?: string) => {
  if (!semente) return Math.random;
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
};

export function spin(texto: string, semente?: string) {
  const sortear = sorteador(semente);
  const p = protegerVariaveis(texto);
  let t = p.t;
  for (let i = 0; i < 20; i++) {
    const antes = t;
    t = t.replace(/\{([^{}]*)\}/g, (_, dentro: string) => {
      const opcoes = dentro.split("|");
      return opcoes[Math.floor(sortear() * opcoes.length)];
    });
    if (t === antes) break;
  }
  return p.voltar(t);
}

/** Quantas mensagens diferentes o spintax gera (aproximado, para mostrar na tela). */
export function contarVariacoes(texto: string) {
  const { t } = protegerVariaveis(texto);
  let total = 1;
  for (const m of t.matchAll(/\{([^{}]*)\}/g)) total *= Math.max(1, m[1].split("|").length);
  return total;
}

/** Spintax com chaves sobrando ou faltando? */
export function spintaxValido(texto: string) {
  const { t } = protegerVariaveis(texto);
  let nivel = 0;
  for (const c of t) {
    if (c === "{") nivel++;
    else if (c === "}") nivel--;
    if (nivel < 0) return false;
  }
  return nivel === 0;
}

// Sinônimos para gerar spintax a partir da sua mensagem (sem IA). O mais longo é trocado primeiro.
const SINONIMOS: string[][] = [
  ["para morar ou para investir", "para morar ou investir", "para moradia ou investimento"],
  ["vi seu cadastro", "recebi seu cadastro", "chegou aqui o seu cadastro"],
  ["vi que você", "percebi que você", "notei que você"],
  ["quero te ajudar", "posso te ajudar", "vou te ajudar"],
  ["posso te ajudar", "quero te ajudar", "vou te ajudar"],
  ["posso te mandar", "posso te enviar", "quer que eu te mande"],
  ["podemos conversar", "vamos conversar", "posso te explicar melhor"],
  ["fico no aguardo", "aguardo seu retorno", "fico à disposição"],
  ["você procura", "você está procurando", "você busca"],
  ["você está procurando", "você procura", "você busca"],
  ["tem interesse", "tem vontade", "pensa"],
  ["tudo bem", "tudo certo", "tudo bom", "como vai"],
  ["tudo bom", "tudo bem", "tudo certo"],
  ["aqui é", "quem fala é", "sou"],
  ["me conta", "me fala", "me diz"],
  ["informações", "detalhes"],
  ["obrigado", "valeu", "agradeço"],
  ["olá", "oi", "oii"],
  ["oi", "olá", "oii", "opa"],
];

const manterMaiuscula = (orig: string, alt: string) => (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase() ? alt.charAt(0).toUpperCase() + alt.slice(1) : alt);
const semAcentoSp = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Transforma a sua mensagem em spintax trocando expressões comuns por {opção|opção}. Você revisa e edita depois. */
export function gerarSpintax(texto: string) {
  const grupos: string[] = [];
  // não mexe no que já é spintax nem nas variáveis
  const guardar = (s: string) => `\u0001${grupos.push(s) - 1}\u0001`;
  let t = String(texto || "").replace(/\{\{[^{}]*\}\}/g, guardar);
  for (let i = 0; i < 5; i++) t = t.replace(/\{[^{}\u0001]*\}/g, guardar);
  const ordenados = [...SINONIMOS].sort((a, b) => b[0].length - a[0].length);
  for (const [base, ...alts] of ordenados) {
    const escapado = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}\\u0001])(${escapado})(?=$|[^\\p{L}])`, "giu");
    t = t.replace(re, (m, antes: string, achado: string) => {
      const opcoes = [achado, ...alts.map((a) => manterMaiuscula(achado, a))].filter((o, i, arr) => arr.findIndex((x) => semAcentoSp(x) === semAcentoSp(o)) === i);
      return antes + guardar(`{${opcoes.join("|")}}`);
    });
  }
  for (let i = 0; i < 10 && /\u0001\d+\u0001/.test(t); i++) t = t.replace(/\u0001(\d+)\u0001/g, (_, k) => grupos[+k]);
  return t;
}
