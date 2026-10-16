// content/content.js
window.IS = window.IS || {};

window.IS.init = async function() {
  window.IS.log("Inicializando Inmovya Scale Extension...");
  
  const settings = await window.IS.Storage.getSettings();
  
  if (window.IS.Observer) window.IS.Observer.init();
  if (window.IS.Panel) window.IS.Panel.init();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.IS.init);
} else {
  window.IS.init();
}

// Lidar com mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle_panel') {
    if (window.IS.Panel) window.IS.Panel.toggle();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'insert_message') {
    (async () => {
      const contactName = window.IS.WhatsAppDOM.getCurrentChatName();
      const finalMessage = await window.IS.Variables.parseMessage(request.message, contactName);
      await window.IS.WhatsAppDOM.insertSequenceAndAttachments(finalMessage, request.attachments);
      sendResponse({ success: true });
    })();
    return true; 
  }

  // Só colar (esteiras do Inmovya): abre a conversa do lead NESTA aba (pelo nome; se não achar, pelo número),
  // cola o texto sem enviar. O WhatsApp guarda como rascunho; você confere e aperta Enter.
  if (request.action === 'paste_one_tab') {
    (async () => {
      const dom = window.IS.WhatsAppDOM;
      const scraper = window.IS.Scraper;
      const item = request.item || {};
      try {
        for (let i = 0; i < 120 && !document.querySelector('#pane-side'); i++) await dom.delay(500);
        if (!document.querySelector('#pane-side')) throw new Error('O WhatsApp Web não carregou.');
        let digits = String(item.phone || '').replace(/\D/g, '');
        const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
        const contact = { name: String(item.name || '').trim(), chatId: digits };
        const tituloAtual = () => String(dom.getCurrentChatName() || document.querySelector('#main header')?.innerText || '').trim();

        const clicar = async (row) => {
          const alvo = row.querySelector('span[title]') || row;
          const r = alvo.getBoundingClientRect();
          const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + 10, clientY: r.top + 8, button: 0 };
          alvo.dispatchEvent(new PointerEvent('pointerdown', o));
          alvo.dispatchEvent(new MouseEvent('mousedown', o));
          alvo.dispatchEvent(new PointerEvent('pointerup', o));
          alvo.dispatchEvent(new MouseEvent('mouseup', o));
          alvo.dispatchEvent(new MouseEvent('click', o));
        };
        const linhasDaBusca = () => scraper.getChatRows().filter(r => !r.closest('#main'));
        const buscar = async (texto) => {
          if (!await scraper.clearContactSearch()) return [];
          const campo = scraper.findSearchInput();
          if (!campo || !await scraper.setContactSearchQuery(campo, texto)) return [];
          await dom.delay(1200);
          return linhasDaBusca();
        };
        const abrir = async (row) => {
          const antes = tituloAtual();
          const nomeLinha = scraper.normalizeText(scraper.getContactName(row));
          await clicar(row);
          for (let k = 0; k < 25; k++) {
            await dom.delay(200);
            const agora = scraper.normalizeText(tituloAtual());
            if (dom.findMessageInput() && agora && (agora !== scraper.normalizeText(antes) || (nomeLinha && agora.includes(nomeLinha)))) return true;
          }
          return !!dom.findMessageInput() && scraper.normalizeText(tituloAtual()).includes(nomeLinha);
        };

        let aberto = false;
        if (request.jaAberto) {
          // aberto pelo link do número: espera a conversa (ou o aviso de número sem WhatsApp)
          for (let i = 0; i < 80 && !aberto; i++) {
            if (dom.findMessageInput()) { aberto = true; break; }
            const invalido = Array.from(document.querySelectorAll('[role="dialog"], [data-animate-modal-popup="true"]'))
              .some(el => /inv[aá]lid|n[aã]o est[aá] no whatsapp|isn.t on whatsapp/i.test(el.innerText || ''));
            if (invalido) throw new Error('Este número não tem WhatsApp.');
            await dom.delay(500);
          }
          if (!aberto) throw new Error('A conversa não abriu pelo número.');
        }
        // 1) pelo nome (exato)
        if (!aberto && contact.name) {
          const linhas = await buscar(contact.name);
          const alvo = linhas.find(r => scraper.normalizeText(scraper.getContactName(r)) === scraper.normalizeText(contact.name));
          if (alvo) aberto = await abrir(alvo);
        }
        // 2) pelo número (sem o 55; depois só os 9 últimos dígitos)
        if (!aberto && local.length >= 8) {
          for (const q of Array.from(new Set([local, local.slice(-9)]))) {
            const linhas = await buscar(q);
            if (linhas.length) { aberto = await abrir(linhas[0]); if (aberto) break; }
          }
        }
        if (!request.jaAberto) { try { await scraper.clearContactSearch(); } catch (_) { /* ignore */ } }
        if (!aberto) { sendResponse({ ok: false, naoAchou: true, error: 'Conversa não encontrada pela busca.' }); return; }
        let input = await dom.waitForMessageInput(8000);
        if (!input) throw new Error('A caixa de mensagem não abriu.');
        // mídias do passo: vão ENVIADAS na hora (o WhatsApp não guarda arquivo como rascunho); o texto fica colado
        const arquivos = (Array.isArray(item.attachments) ? item.attachments : []).filter(a => a && a.data).map(a => ({
          id: a.id || window.IS.generateUUID(),
          name: a.name || 'anexo',
          type: a.type || 'application/octet-stream',
          size: a.size || 0,
          data: a.data,
          caption: '',
          messageIndex: 0,
          useCaption: false
        }));
        if (arquivos.length) {
          dom.ultimoErro = '';
          const enviados = await dom.insertSequenceAndAttachments('', arquivos, { sendSingleText: true });
          if (!enviados) throw new Error(dom.ultimoErro || 'Os arquivos não foram enviados.');
          // espera terminar de subir antes de colar o texto
          const pendentes = () => document.querySelectorAll('#main [data-icon="msg-time"], #main [data-icon="media-cancel"], #main [data-icon="msg-time-light"]').length;
          const limite = Date.now() + 120000;
          let livres = 0;
          while (Date.now() < limite && livres < 3) { await dom.delay(700); livres = pendentes() ? 0 : livres + 1; }
          input = await dom.waitForMessageInput(8000);
          if (!input) throw new Error('Arquivos enviados, mas a caixa de mensagem não voltou.');
        }
        const ok = await dom.insertMessage(String(item.text || ''));
        if (!ok) throw new Error('O WhatsApp não aceitou o texto.');
        await dom.delay(500);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'campaign_auto_send') {
    (async () => {
      try {
        window.IS.WhatsAppDOM.ultimoErro = '';
        let input = await window.IS.WhatsAppDOM.waitForMessageInput(30000);
        if (!input) throw new Error('A conversa do WhatsApp não ficou pronta.');
        input.focus();
        await window.IS.WhatsAppDOM.delay(1200);
        input = window.IS.WhatsAppDOM.findMessageInput();
        if (!input) throw new Error('A conversa do WhatsApp ainda está carregando.');

        const attachments = request.attachment?.nativePath
          ? [{
            id: window.IS.generateUUID(),
            name: request.attachment.name || 'imagem-campanha.jpg',
            type: request.attachment.type || 'image/jpeg',
            size: request.attachment.size || 0,
            nativePath: request.attachment.nativePath,
            messageIndex: 0,
            useCaption: !!String(request.text || '').trim()
          }]
          : [];
        // anexos das esteiras do Inmovya: PDF, vídeo, imagem, áudio, documentos (vão depois do texto)
        (Array.isArray(request.attachments) ? request.attachments : []).forEach(item => {
          if (!item || !item.data) return;
          attachments.push({
            id: item.id || window.IS.generateUUID(),
            name: item.name || 'anexo',
            type: item.type || 'application/octet-stream',
            size: item.size || 0,
            data: item.data,
            caption: String(item.caption || ''),
            // depois de qual mensagem (parte separada por ===) o anexo vai
            ...(Number.isInteger(item.messageIndex) ? { messageIndex: item.messageIndex } : {}),
            useCaption: !!item.useCaption
          });
        });
        const sent = await window.IS.WhatsAppDOM.insertSequenceAndAttachments(
          request.text || '',
          attachments,
          {
            sendSingleText: true,
            gapMinMs: Number(request.gapMinMs) || 0,
            gapMaxMs: Number(request.gapMaxMs) || 0
          }
        );
        if (!sent) throw new Error(window.IS.WhatsAppDOM.ultimoErro || 'O WhatsApp não confirmou o envio da campanha.');

        // Espera o WhatsApp terminar de mandar (relógio/upload sumir) antes de a aba ser fechada;
        // com algo pendente o WhatsApp pede "Sair do site?" e a esteira travava.
        const pendentes = () =>
          document.querySelectorAll('#main [data-icon="msg-time"], #main [data-icon="media-cancel"], #main [data-icon="msg-time-light"]').length;
        const limite = Date.now() + 120000;
        let livres = 0;
        while (Date.now() < limite && livres < 3) {
          await window.IS.WhatsAppDOM.delay(700);
          livres = pendentes() ? 0 : livres + 1;
        }

        sendResponse({ ok: true });
      } catch (error) {
        window.IS.error('Falha no disparo da campanha', error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
  
  // ---------- Agente da esteira ----------
  // Lê as mensagens carregadas da conversa aberta: direção (in = o lead, out = você), data/hora e texto.
  if (request.action === 'agent_read_chat_tab') {
    (async () => {
      try {
        const dom = window.IS.WhatsAppDOM;
        const input = await dom.waitForMessageInput(30000);
        if (!input) throw new Error('A conversa do WhatsApp não abriu (número sem WhatsApp?).');
        const main = document.querySelector('#main');
        const painel = main.querySelector('[data-testid="conversation-panel-messages"]') || main;
        const contar = () => main.querySelectorAll('[data-testid^="conv-msg-"]').length;
        // as mensagens aparecem aos poucos: espera a contagem parar de crescer
        const esperarEstabilizar = async (maxMs = 12000) => {
          let ultimo = -1, iguais = 0;
          const fim = Date.now() + maxMs;
          while (Date.now() < fim) {
            const n = contar();
            iguais = n === ultimo ? iguais + 1 : 0;
            ultimo = n;
            if (n > 0 && iguais >= 4) break; // ~2s sem mudar
            await dom.delay(500);
          }
        };
        await esperarEstabilizar();
        // sobe a conversa para carregar o histórico (até ~60 mensagens)
        const acharRolagem = () => {
          let el = main.querySelector('[data-testid^="conv-msg-"]');
          while (el && el !== document.body) {
            const st = getComputedStyle(el);
            if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 20) return el;
            el = el.parentElement;
          }
          return null;
        };
        for (let i = 0; i < 4; i++) {
          const rolagem = acharRolagem();
          if (!rolagem || contar() >= 60) break;
          const antes = contar();
          rolagem.scrollTop = 0;
          await dom.delay(1200);
          await esperarEstabilizar(4000);
          if (contar() === antes) break;
        }
        const pr = painel.getBoundingClientRect();
        const msgs = [];
        let ultimaData = null;
        main.querySelectorAll('[data-testid^="conv-msg-"]').forEach(m => {
          const caixa = m.querySelector('[data-testid="msg-container"]') || m;
          const r = caixa.getBoundingClientRect();
          let dir;
          if (m.querySelector('[data-testid="tail-in"],[data-icon="tail-in"]')) dir = 'in';
          else if (m.querySelector('[data-testid="tail-out"],[data-icon="tail-out"]')) dir = 'out';
          else dir = (r.left - pr.left) > (pr.right - r.right) ? 'out' : 'in';
          const pre = m.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
          const quando = (pre.match(/^\[([^\]]+)\]/) || [])[1] || null; // "16:23, 11/10/2026"
          if (quando) ultimaData = quando.split(',')[1]?.trim() || ultimaData;
          const hora = quando ? quando.split(',')[0].trim() : ((m.querySelector('[data-testid="msg-meta"]')?.innerText || '').match(/\d{1,2}:\d{2}/) || [])[0] || null;
          const texto = Array.from(m.querySelectorAll('.selectable-text')).map(e => e.innerText).join('\n').trim();
          const tipo = texto ? 'texto' : (m.querySelector('[data-testid*="audio" i],[data-icon*="audio" i],[data-icon*="ptt" i]') ? 'áudio'
            : m.querySelector('[data-testid*="video" i]') ? 'vídeo' : m.querySelector('img') ? 'imagem/figurinha' : 'mídia');
          msgs.push({ dir, data: quando ? ultimaData : ultimaData, hora, texto: texto.slice(0, 1500), tipo });
        });
        sendResponse({ ok: true, mensagens: msgs.slice(-40) });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  // Marca/desmarca etiquetas (listas) da conversa aberta pelo botão do cabeçalho.
  if (request.action === 'agent_set_labels_tab') {
    (async () => {
      try {
        const dom = window.IS.WhatsAppDOM;
        const input = await dom.waitForMessageInput(30000);
        if (!input) throw new Error('A conversa do WhatsApp não abriu.');
        await dom.delay(1200);
        sendResponse(await agenteTrocarEtiquetas(request.add, request.remove));
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  // 1º contato automático: salva o contato com o nome do lead (se ainda não estiver salvo) e marca a etiqueta da origem.
  if (request.action === 'agent_save_and_label_tab') {
    (async () => {
      try {
        const dom = window.IS.WhatsAppDOM;
        const input = await dom.waitForMessageInput(30000);
        if (!input) throw new Error('A conversa do WhatsApp não abriu.');
        await dom.delay(1500);
        const contato = request.nome ? await agenteSalvarContato(request.nome) : { salvo: false, motivo: 'sem nome' };
        await dom.delay(800);
        const etiqueta = request.etiqueta ? await agenteTrocarEtiquetas([request.etiqueta], []) : { ok: true, alteracoes: [] };
        sendResponse({ ok: true, final: true, contato, etiqueta });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  // Lote do agente: numa única janela do WhatsApp, procura cada contato pela busca (sem recarregar).
  //  op "scan":   lê na lista de conversas se a última mensagem é sua (tique) ou do lead, e o texto dela
  //  op "labels": abre a conversa e troca as etiquetas
  if (request.action === 'agent_batch_item') {
    (async () => {
      try {
        sendResponse(await agenteItemDoLote(request));
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'start_scraper') {
    (async () => {
      const data = await window.IS.Scraper.run();
      sendResponse({ data });
    })();
    return true;
  }
});

// ---------- Agente: funções do lote ----------
const agenteDelay = ms => new Promise(r => setTimeout(r, ms));
const agenteNorm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

async function agenteTrocarEtiquetas(add = [], remove = []) {
  const botao = document.querySelector('#main [data-testid="label-chat-header-button"]')
    || Array.from(document.querySelectorAll('#main header button')).find(b => /lista|etiqueta|label/i.test(b.getAttribute('aria-label') || ''));
  if (!botao) return { ok: false, final: true, error: 'Não achei o botão de etiquetas no WhatsApp.' };
  botao.click();
  await agenteDelay(900);
  const aviso = Array.from(document.querySelectorAll('[data-testid="confirm-popup"] button')).find(b => /continuar|continue|ok/i.test(b.innerText));
  if (aviso) { aviso.click(); await agenteDelay(900); }
  const lista = () => document.querySelector('[data-testid="label-chat-header-dropdown-items"]');
  if (!lista()) return { ok: false, error: 'A lista de etiquetas não abriu.' };
  const itens = () => Array.from(lista().querySelectorAll('li[data-testid^="label_item_"], li'));
  const marcada = li => !!li.querySelector('input[type="checkbox"]')?.checked;
  const adicionar = (add || []).map(agenteNorm);
  const remover = (remove || []).map(agenteNorm);
  const feitas = [];
  for (const nome of [...adicionar, ...remover]) {
    const li = itens().find(l => agenteNorm(l.innerText) === nome);
    if (!li) { if (adicionar.includes(nome)) feitas.push(`etiqueta "${nome}" não existe`); continue; }
    const querMarcada = adicionar.includes(nome);
    if (marcada(li) !== querMarcada) {
      li.click();
      await agenteDelay(800);
      feitas.push(`${querMarcada ? '+' : '-'}${li.innerText.trim()}`);
    }
  }
  const final = itens().filter(marcada).map(l => l.innerText.trim());
  botao.click(); // fecha a lista
  await agenteDelay(300);
  return { ok: true, alteracoes: feitas, etiquetas: final };
}

// ---------- 1º contato: salvar o contato no WhatsApp ----------
// O WhatsApp Web muda os botões com frequência: procura pelo texto/rótulo (português e inglês).
const agenteVisivel = el => !!el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
const agenteRotulo = el => `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.innerText || ''}`.replace(/\s+/g, ' ').trim();

function agenteAcharBotao(regex, raiz = document) {
  const alvos = Array.from(raiz.querySelectorAll('button, [role="button"], [role="menuitem"], li[tabindex], div[tabindex]'));
  return alvos.find(el => agenteVisivel(el) && el.closest('#inmovya-scale-root') === null && regex.test(agenteRotulo(el)) && agenteRotulo(el).length < 60) || null;
}

async function agenteEsperarBotao(regex, ms = 4000, raiz = document) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const b = agenteAcharBotao(regex, raiz);
    if (b) return b;
    await agenteDelay(250);
  }
  return null;
}

function agenteTituloConversa() {
  const h = document.querySelector('#main [data-testid="conversation-info-header-chat-title"]') || document.querySelector('#main header span[dir="auto"]');
  return (h?.innerText || h?.getAttribute('title') || '').replace(/[‪-‮]/g, '').trim();
}

function agentePreencher(campo, valor) {
  campo.focus();
  if (campo.isContentEditable) {
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, valor);
    return;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter ? setter.call(campo, valor) : (campo.value = valor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  campo.dispatchEvent(new Event('change', { bubbles: true }));
}

async function agenteSalvarContato(nomeCompleto) {
  const nome = String(nomeCompleto || '').replace(/\s+/g, ' ').trim();
  if (!nome) return { salvo: false, motivo: 'lead sem nome' };
  // cabeçalho com letras = já é um contato salvo
  const titulo = agenteTituloConversa();
  // (o "~Nome" do perfil, que aparece em número não salvo, não conta)
  if (/[a-zà-ÿ]/i.test(titulo) && !titulo.startsWith('~')) return { salvo: true, jaEstava: true, motivo: `já salvo como "${titulo}"` };

  const ADICIONAR = /^(adicionar( aos?)? contatos?|adicionar contato|novo contato|salvar contato|add( to)? contacts?|add contact|new contact|save contact)$/i;
  // 1) botão na própria conversa (aviso de número desconhecido) ou no menu ⋮ do cabeçalho
  let botao = agenteAcharBotao(ADICIONAR, document.querySelector('#main') || document);
  if (!botao) {
    const menu = document.querySelector('#main header [data-icon="menu"], #main header [data-icon="kebab-menu"]')?.closest('button, [role="button"]')
      || Array.from(document.querySelectorAll('#main header button, #main header [role="button"]')).find(b => /mais op|menu|more options/i.test(agenteRotulo(b)));
    if (menu) {
      menu.click();
      botao = await agenteEsperarBotao(ADICIONAR, 2500);
      if (!botao) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
  }
  // 2) dados do contato (clicar no cabeçalho)
  if (!botao) {
    const cabecalho = document.querySelector('#main header [data-testid="conversation-info-header"], #main header [role="button"]') || document.querySelector('#main header');
    cabecalho?.click();
    botao = await agenteEsperarBotao(ADICIONAR, 4000);
  }
  if (!botao) return { salvo: false, motivo: 'não achei o botão "Adicionar contato" no WhatsApp Web' };
  botao.click();
  await agenteDelay(1200);

  // formulário: Nome / Sobrenome (às vezes um campo só)
  const campos = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), [contenteditable="true"][role="textbox"]'))
    .filter(c => agenteVisivel(c) && !c.closest('#main footer') && !c.closest('#side') && !c.closest('#inmovya-scale-root'));
  const rotuloCampo = c => `${c.getAttribute('aria-label') || ''} ${c.getAttribute('placeholder') || ''} ${c.closest('label')?.innerText || ''}`.toLowerCase();
  const campoNome = campos.find(c => /nome|first|name/.test(rotuloCampo(c)) && !/sobrenome|last|telefone|phone/.test(rotuloCampo(c))) || campos[0];
  const campoSobrenome = campos.find(c => /sobrenome|last/.test(rotuloCampo(c)));
  if (!campoNome) return { salvo: false, motivo: 'o formulário de contato não abriu' };
  const partes = nome.split(' ');
  if (campoSobrenome && partes.length > 1) {
    agentePreencher(campoNome, partes[0]);
    await agenteDelay(300);
    agentePreencher(campoSobrenome, partes.slice(1).join(' '));
  } else {
    agentePreencher(campoNome, nome);
  }
  await agenteDelay(600);
  const salvar = await agenteEsperarBotao(/^(salvar|save|concluir|done|ok)$/i, 3000);
  if (!salvar) return { salvo: false, motivo: 'não achei o botão Salvar do contato' };
  salvar.click();
  await agenteDelay(2500);
  // fecha painéis abertos e confere o nome no cabeçalho
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await agenteDelay(800);
  const depois = agenteTituloConversa();
  const primeiro = agenteNorm(partes[0]);
  return agenteNorm(depois).includes(primeiro)
    ? { salvo: true, motivo: `salvo como "${depois}"` }
    : { salvo: false, motivo: 'cliquei em Salvar, mas o nome não apareceu no cabeçalho — confira no celular' };
}

const agenteLinhasVisiveis = () => Array.from(document.querySelectorAll('[role="row"]'))
  .filter(r => !r.closest('#main') && !r.closest('#inmovya-scale-root') && r.querySelector('[role="gridcell"]') && r.querySelector('span[title]'))
  .filter(r => { const b = r.getBoundingClientRect(); return b.height > 40 && b.top >= 0 && b.top < window.innerHeight; });

async function agenteBuscar(phone) {
  const campo = document.querySelector('input[role="textbox"][data-tab="3"]')
    || Array.from(document.querySelectorAll('input, [contenteditable="true"]')).find(e => /pesquisar|search/i.test(e.getAttribute('aria-label') || e.getAttribute('placeholder') || ''));
  if (!campo) throw new Error('Não achei a busca do WhatsApp.');
  // busca pelos 8 últimos dígitos: acha o contato com ou sem o 9 e com qualquer formatação
  const digitos = String(phone || '').replace(/\D/g, '');
  const primeiraAntes = () => (agenteLinhasVisiveis()[0]?.querySelector('span[title]')?.getAttribute('title') || '');
  const antes = primeiraAntes();
  campo.focus();
  if (campo.select) campo.select(); else document.execCommand('selectAll');
  document.execCommand('insertText', false, digitos.slice(-8));
  // espera a lista filtrar: a 1ª linha muda (ou some), mínimo 1,2 s e no máximo 5 s
  const inicio = Date.now();
  while (Date.now() - inicio < 5000) {
    await agenteDelay(300);
    if (Date.now() - inicio < 1200) continue;
    const agora = primeiraAntes();
    if (agora !== antes || Date.now() - inicio > 3000) break;
  }
  await agenteDelay(300);
  return agenteLinhasVisiveis();
}

function agenteLerLinha(linha) {
  const titulos = Array.from(linha.querySelectorAll('span[title]')).map(s => s.getAttribute('title'));
  const status = linha.querySelector('[data-testid="last-msg-status"]');
  const icone = status?.querySelector('svg title')?.textContent || status?.querySelector('[data-icon]')?.getAttribute('data-icon') || '';
  // tique (enviada/entregue/lida/relógio) = a última mensagem é SUA
  const ultimaSua = /read|deliver|sent|check|pending|clock|time|ack/i.test(icone);
  const quando = (linha.querySelector('[data-testid="cell-frame-primary-detail"]')?.innerText || '').trim();
  const naoLidas = parseInt((Array.from(linha.querySelectorAll('[aria-label]')).map(e => e.getAttribute('aria-label')).find(a => /n[aã]o lida|unread/i.test(a)) || '').replace(/\D/g, ''), 10) || 0;
  const etiquetas = (linha.querySelector('[data-testid="chatlist-tertiary-pills-row"]')?.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
  return { nome: titulos[0] || '', ultimaMensagem: (titulos[1] || '').replace(/[\u202a\u202c]/g, ''), ultimaSua, icone, quando, naoLidas, etiquetas };
}

async function agenteAbrirLinha(linha) {
  const alvo = linha.querySelector('span[title]') || linha;
  const r = alvo.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + 10, clientY: r.top + 8, button: 0 };
  alvo.dispatchEvent(new PointerEvent('pointerdown', o));
  alvo.dispatchEvent(new MouseEvent('mousedown', o));
  alvo.dispatchEvent(new PointerEvent('pointerup', o));
  alvo.dispatchEvent(new MouseEvent('mouseup', o));
  alvo.dispatchEvent(new MouseEvent('click', o));
  // espera abrir ESTA conversa (o cabeçalho mostra o mesmo nome da linha)
  const nome = agenteNorm(linha.querySelector('span[title]')?.getAttribute('title'));
  const aberta = () => {
    const h = agenteNorm(document.querySelector('#main [data-testid="conversation-info-header-chat-title"]')?.innerText
      || document.querySelector('#main header span[dir="auto"]')?.innerText);
    return !!document.querySelector('#main footer') && (!nome || h === nome || h.includes(nome) || nome.includes(h));
  };
  for (let i = 0; i < 30 && !aberta(); i++) await agenteDelay(200);
  return aberta();
}

async function agenteItemDoLote(request) {
  // espera o WhatsApp carregar (1ª vez)
  for (let i = 0; i < 90 && !document.querySelector('#pane-side'); i++) await agenteDelay(500);
  if (!document.querySelector('#pane-side')) return { ok: false, error: 'O WhatsApp Web não carregou.' };
  const linhas = await agenteBuscar(request.phone);
  if (!linhas.length) return { ok: true, encontrado: false };
  const linha = linhas[0];
  const info = agenteLerLinha(linha);
  if (request.op === 'labels') {
    if (!(await agenteAbrirLinha(linha))) return { ok: false, final: true, error: 'Não consegui abrir a conversa.' };
    await agenteDelay(800);
    const r = await agenteTrocarEtiquetas(request.add, request.remove);
    return { ...r, encontrado: true, info };
  }
  return { ok: true, encontrado: true, info };
}
