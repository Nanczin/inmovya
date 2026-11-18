// planilha-leitor.js — lê a lista de contatos do Disparo a partir de vários formatos de arquivo:
// Excel (.xlsx, .xlsm), LibreOffice/Google (.ods), CSV/TSV/TXT, contatos do celular (.vcf) e .json.
// Devolve texto com uma pessoa por linha (colunas separadas por TAB), que o Disparo já sabe ler.
// Sem bibliotecas: o .xlsx/.ods é um ZIP; o Chrome descompacta com DecompressionStream.
(() => {
  window.IS = window.IS || {};
  if (window.IS.lerArquivoContatos) return;

  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

  async function inflar(dados) {
    const ds = new DecompressionStream('deflate-raw');
    const saida = new Blob([dados]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(saida).arrayBuffer());
  }

  /** Lista os arquivos de dentro do ZIP: { nome: () => Promise<texto> }. */
  function abrirZip(buf) {
    const b = new Uint8Array(buf);
    let fim = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
      if (u32(b, i) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) throw new Error('arquivo não é um Excel/ODS válido');
    const total = u16(b, fim + 10);
    let p = u32(b, fim + 16);
    const arquivos = {};
    const dec = new TextDecoder('utf-8');
    for (let n = 0; n < total; n++) {
      if (u32(b, p) !== 0x02014b50) break;
      const metodo = u16(b, p + 10);
      const tamComp = u32(b, p + 20);
      const lenNome = u16(b, p + 28);
      const lenExtra = u16(b, p + 30);
      const lenComent = u16(b, p + 32);
      const offLocal = u32(b, p + 42);
      const nome = dec.decode(b.subarray(p + 46, p + 46 + lenNome));
      p += 46 + lenNome + lenExtra + lenComent;
      arquivos[nome] = async () => {
        const ln = u16(b, offLocal + 26);
        const le = u16(b, offLocal + 28);
        const ini = offLocal + 30 + ln + le;
        const dados = b.subarray(ini, ini + tamComp);
        const bruto = metodo === 0 ? dados : metodo === 8 ? await inflar(dados) : null;
        if (!bruto) throw new Error('compactação não suportada');
        return dec.decode(bruto);
      };
    }
    return arquivos;
  }

  const xml = t => new DOMParser().parseFromString(t, 'application/xml');
  const porTag = (no, tag) => Array.from(no.getElementsByTagNameNS('*', tag));
  const textoDe = no => porTag(no, 't').map(t => t.textContent).join('') || '';
  const colunaIdx = ref => {
    const letras = String(ref || '').replace(/[^A-Z]/gi, '').toUpperCase();
    let n = 0;
    for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
    return Math.max(0, n - 1);
  };
  // 5.51199E+12 → 5511999999999 (telefone salvo como número)
  const numeroInteiro = v => (/^-?\d+(\.\d+)?e\+?\d+$/i.test(v) ? Number(v).toFixed(0) : v.replace(/\.0+$/, ''));

  async function lerXlsx(buf) {
    const z = abrirZip(buf);
    const compartilhadas = z['xl/sharedStrings.xml'] ? porTag(xml(await z['xl/sharedStrings.xml']()), 'si').map(textoDe) : [];
    // 1ª aba da planilha (pela ordem do workbook; se não der, a sheet1)
    let caminho = 'xl/worksheets/sheet1.xml';
    try {
      const wb = xml(await z['xl/workbook.xml']());
      const rid = porTag(wb, 'sheet')[0]?.getAttribute('r:id') || porTag(wb, 'sheet')[0]?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const rels = xml(await z['xl/_rels/workbook.xml.rels']());
      const alvo = porTag(rels, 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target');
      if (alvo) caminho = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, '')}`;
    } catch (_) { /* usa a sheet1 */ }
    if (!z[caminho]) caminho = Object.keys(z).filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
    if (!caminho) throw new Error('a planilha está vazia');
    const folha = xml(await z[caminho]());
    return porTag(folha, 'row').map(row => {
      const linha = [];
      for (const c of porTag(row, 'c')) {
        const tipo = c.getAttribute('t');
        const v = porTag(c, 'v')[0]?.textContent ?? '';
        let valor = '';
        if (tipo === 's') valor = compartilhadas[Number(v)] ?? '';
        else if (tipo === 'inlineStr') valor = textoDe(c);
        else valor = numeroInteiro(String(v));
        linha[colunaIdx(c.getAttribute('r'))] = String(valor).trim();
      }
      return Array.from(linha, x => x || '');
    });
  }

  async function lerOds(buf) {
    const z = abrirZip(buf);
    if (!z['content.xml']) throw new Error('arquivo ODS sem conteúdo');
    const doc = xml(await z['content.xml']());
    const tabela = porTag(doc, 'table')[0];
    if (!tabela) return [];
    const NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
    const TNS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
    const linhas = [];
    for (const row of porTag(tabela, 'table-row')) {
      const linha = [];
      for (const cel of porTag(row, 'table-cell')) {
        const rep = Math.min(50, Number(cel.getAttributeNS(TNS, 'number-columns-repeated')) || 1);
        const val = cel.getAttributeNS(NS, 'value');
        const txt = porTag(cel, 'p').map(p => p.textContent).join(' ').trim();
        const valor = val != null && val !== '' && /^[\d.e+-]+$/i.test(val) && digitosDe(val).length >= 10 ? numeroInteiro(val) : txt;
        for (let i = 0; i < rep; i++) linha.push(valor);
      }
      while (linha.length && !linha[linha.length - 1]) linha.pop(); // sem as colunas vazias do fim
      if (linha.some(Boolean)) linhas.push(linha);
    }
    return linhas;
  }

  const digitosDe = t => String(t || '').replace(/\D/g, '');

  function lerVcf(texto) {
    const linhas = [];
    // junta as linhas "dobradas" do vCard (continuação começa com espaço)
    const t = String(texto).replace(/\r?\n[ \t]/g, '');
    for (const card of t.split(/BEGIN:VCARD/i).slice(1)) {
      const nome = (card.match(/^FN[^:\n]*:(.*)$/im) || card.match(/^N[^:\n]*:(.*)$/im) || [])[1] || '';
      const tel = (card.match(/^(?:item\d+\.)?TEL[^:\n]*:(.*)$/im) || [])[1] || '';
      if (tel) linhas.push([nome.replace(/;+/g, ' ').trim(), tel.trim()]);
    }
    return linhas;
  }

  function lerJson(texto) {
    let dados = JSON.parse(texto);
    if (!Array.isArray(dados)) dados = Object.values(dados).find(Array.isArray) || [];
    return dados.map(o => {
      if (Array.isArray(o)) return o.map(String);
      if (!o || typeof o !== 'object') return [String(o)];
      const chaves = Object.keys(o);
      const kTel = chaves.find(k => /tel|fone|phone|celular|whats|numero|número/i.test(k));
      const kNome = chaves.find(k => /nome|name|cliente|contato/i.test(k));
      return [kNome ? String(o[kNome] ?? '') : '', kTel ? String(o[kTel] ?? '') : ''];
    });
  }

  /** Lê o arquivo e devolve texto "Nome<TAB>Telefone…" uma pessoa por linha. */
  window.IS.lerArquivoContatos = async file => {
    const nome = String(file?.name || '').toLowerCase();
    const ext = (nome.match(/\.([a-z0-9]+)$/) || [])[1] || '';
    let linhas;
    if (ext === 'xlsx' || ext === 'xlsm') linhas = await lerXlsx(await file.arrayBuffer());
    else if (ext === 'ods') linhas = await lerOds(await file.arrayBuffer());
    else if (ext === 'xls') throw new Error('o formato .xls (Excel antigo) não dá para ler. No Excel, vá em Arquivo → Salvar como → .xlsx e abra de novo.');
    else if (ext === 'vcf') linhas = lerVcf(await file.text());
    else if (ext === 'json') linhas = lerJson(await file.text());
    else return await file.text(); // csv, tsv, txt: o Disparo já lê
    return linhas.map(l => l.map(c => String(c ?? '').replace(/[\t\r\n]+/g, ' ').trim()).join('\t')).join('\n');
  };
})();
