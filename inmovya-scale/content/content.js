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

  // Captura do Midrah: o número tem WhatsApp? (conversa abre = sim; aviso de número inválido = não)
  if (request.action === 'checar_whatsapp_tab') {
    (async () => {
      const dom = window.IS.WhatsAppDOM;
      const fim = Date.now() + 45000;
      while (Date.now() < fim) {
        if (dom.findMessageInput()) { sendResponse({ ok: true, temWhatsapp: true }); return; }
        const invalido = Array.from(document.querySelectorAll('[role="dialog"], [data-animate-modal-popup="true"]'))
          .some(el => /inv[aá]lid|n[aã]o est[aá] no whatsapp|isn.t on whatsapp|not on whatsapp/i.test(el.innerText || ''));
        if (invalido) { sendResponse({ ok: true, temWhatsapp: false }); return; }
        await dom.delay(500);
      }
      sendResponse({ ok: false, final: true, error: 'O WhatsApp Web não carregou para conferir o número.' });
    })();
    return true;
  }

  if (request.action === 'campaign_auto_send') {
    (async () => {
      // Trava anti-duplicado: a mesma mensagem (envioId) nunca sai duas vezes nesta aba, mesmo se o
      // background tentar de novo depois de um erro de confirmação.
      const chaveEnvio = request.envioId ? `inmovya_envio_${request.envioId}` : '';
      const jaFoi = () => { try { return !!(chaveEnvio && sessionStorage.getItem(chaveEnvio)); } catch (_) { return false; } };
      const marcarEnviado = () => {
        if (!chaveEnvio) return;
        try { sessionStorage.setItem(chaveEnvio, '1'); } catch (_) { /* ignore */ }
        try { chrome.runtime.sendMessage({ action: 'campaign_sent_mark', envioId: request.envioId }); } catch (_) { /* ignore */ }
      };
      if (jaFoi()) { sendResponse({ ok: true, jaEnviado: true }); return; }
      const saidas = () => document.querySelectorAll('#main .message-out').length;
      let saidasAntes = null;
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
        saidasAntes = saidas();
        let sent = false;
        try {
          sent = await window.IS.WhatsAppDOM.insertSequenceAndAttachments(
            request.text || '',
            attachments,
            {
              sendSingleText: true,
              gapMinMs: Number(request.gapMinMs) || 0,
              gapMaxMs: Number(request.gapMaxMs) || 0
            }
          );
        } finally {
          await window.IS.WhatsAppDOM.delay(800);
          // saiu mensagem nova na conversa? então FOI enviada (mesmo que a confirmação tenha falhado): não reenvia
          if (sent || saidas() > saidasAntes) marcarEnviado();
        }
        if (!sent && saidas() > saidasAntes) sent = true;
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
        if (jaFoi()) { sendResponse({ ok: true, jaEnviado: true, aviso: error.message }); return; }
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
        await esperarEstabilizar(request.rapido ? 6000 : 12000);
        // sobe a conversa para carregar o histórico (até ~60 mensagens) — o robô (rapido) não precisa
        const acharRolagem = () => {
          let el = main.querySelector('[data-testid^="conv-msg-"]');
          while (el && el !== document.body) {
            const st = getComputedStyle(el);
            if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 20) return el;
            el = el.parentElement;
          }
          return null;
        };
        for (let i = 0; i < (request.rapido ? 0 : 4); i++) {
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
        sendResponse({ ok: true, mensagens: msgs.slice(-40), titulo: agenteTituloConversa() });
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
        // etiqueta PRIMEIRO: depois de salvar o contato o WhatsApp tira a conversa da tela
        const etiqueta = request.etiqueta ? await agenteEtiquetar([request.etiqueta], []) : { ok: true, alteracoes: [] };
        await dom.delay(800);
        const contato = request.nome ? await agenteSalvarContato(request.nome, request.phone) : { salvo: false, motivo: 'sem nome' };
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

  // Robô de anúncios: lê a lista de conversas (sem abrir nenhuma) e devolve as que têm mensagem não lida
  // de número NÃO salvo (o título da conversa é o próprio número).
  if (request.action === 'robo_listar_conversas') {
    try {
      if (!document.querySelector('#pane-side')) return sendResponse({ ok: false, error: 'O WhatsApp Web ainda não carregou.' });
      const linhas = agenteLinhasVisiveis().map(agenteLerLinha).map(info => {
        const soNumero = /^\+?[\d\s().-]{10,22}$/.test(String(info.nome || '').replace(/[‪-‮‎‏]/g, '').trim());
        const telefone = soNumero ? String(info.nome).replace(/\D/g, '') : '';
        return { ...info, telefone };
      });
      sendResponse({
        ok: true,
        linhas: linhas.filter(l => l.telefone && l.naoLidas > 0 && !l.ultimaSua),
        // modo teste: o número de teste pode estar salvo (título = nome); só nome e marcadores, sem o texto
        todas: linhas.filter(l => l.naoLidas > 0 && !l.ultimaSua).map(l => ({ nome: l.nome, telefone: l.telefone, naoLidas: l.naoLidas, ultimaSua: l.ultimaSua }))
      });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
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

// ---------- 1º contato: ajudas para achar botões que mudam de versão em versão ----------
// Lista curta do que existe na tela (vai no aviso quando algo não é achado, para ajustar sem adivinhar).
function agenteDescreverBotoes(raiz = document, max = 15) {
  const vistos = [];
  Array.from((raiz || document).querySelectorAll('button, [role="button"], [role="menuitem"], [role="checkbox"], li[tabindex]'))
    .filter(el => agenteVisivel(el) && !el.closest('#inmovya-scale-root'))
    .forEach(el => {
      const icone = el.querySelector('[data-icon]')?.getAttribute('data-icon') || el.getAttribute('data-icon') || '';
      const t = (agenteRotulo(el).slice(0, 30) || (icone ? `ícone:${icone}` : '')).trim();
      if (t && !vistos.includes(t)) vistos.push(t);
    });
  return vistos.slice(0, max).join(' | ') || 'nenhum';
}

// sobe do campo até o painel/diálogo que tem os botões do formulário
function agentePainelDoCampo(campo) {
  let el = campo;
  for (let i = 0; i < 12 && el && el !== document.body; i++) {
    el = el.parentElement;
    if (!el) break;
    if (el.matches('[role="dialog"], [data-animate-modal-body], section') || el.querySelectorAll('button, [role="button"]').length >= 2) {
      if (el.querySelector('[data-icon*="checkmark" i], [data-icon*="check" i], button, [role="button"]')) return el;
    }
  }
  return document;
}

// botão de confirmar: texto Salvar/Save/Concluir/OK ou só o ícone ✓
function agenteBotaoConfirmar(raiz) {
  if (!raiz) return null;
  const porTexto = agenteAcharBotao(/^(salvar|save|salvar contato|save contact|concluir|done|ok|confirmar|confirm|aplicar|apply)$/i, raiz);
  if (porTexto) return porTexto;
  // o ícone em si pode não ter tamanho: confere o botão em volta dele
  const icone = Array.from(raiz.querySelectorAll('[data-icon*="checkmark" i], [data-icon="done"], [data-icon*="check-filled" i], [data-icon="send"]'))
    .find(i => {
      const alvo = i.closest('button, [role="button"]') || i;
      return agenteVisivel(alvo) && !i.closest('#main footer') && !i.closest('#inmovya-scale-root') && !i.closest('[role="checkbox"]') && !i.closest('li');
    });
  return icone ? icone.closest('button, [role="button"]') || icone : null;
}

// Menu ⋮ da CONVERSA aberta (não o da barra lateral): o ícone de menu mais alto dentro do painel da conversa.
function agenteMenuDaConversa() {
  const main = document.querySelector('#main');
  if (!main) return null;
  const topo = main.getBoundingClientRect().top + 160;
  const candidatos = Array.from(main.querySelectorAll('[data-icon], button[aria-label], [role="button"][aria-label]'))
    .map(el => (el.matches('[data-icon]') ? el.closest('button, [role="button"]') || el : el))
    .filter(el => el && agenteVisivel(el) && el.getBoundingClientRect().top < topo);
  const ehMenu = el => {
    const icone = (el.getAttribute('data-icon') || el.querySelector('[data-icon]')?.getAttribute('data-icon') || '').toLowerCase();
    return /menu|kebab|more|dots/.test(icone) || /mais op|more options|menu|opções da conversa/i.test(el.getAttribute('aria-label') || el.getAttribute('title') || '');
  };
  const menus = candidatos.filter(ehMenu);
  // o mais à direita (o ⋮ fica no canto direito do cabeçalho)
  return menus.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0] || null;
}

// Guarda uma "foto" dos botões/campos da tela no armazenamento da extensão (sem textos das mensagens),
// para ajustar os caminhos quando o WhatsApp muda.
async function agenteGuardarDiagnostico(etapa, raiz) {
  try {
    const desc = el => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        aria: (el.getAttribute('aria-label') || '').slice(0, 50),
        title: (el.getAttribute('title') || '').slice(0, 50),
        icon: el.getAttribute('data-icon') || el.querySelector('[data-icon]')?.getAttribute('data-icon') || '',
        texto: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        tipo: el.getAttribute('type') || '',
        ph: (el.getAttribute('placeholder') || '').slice(0, 40),
        des: el.disabled || el.getAttribute('aria-disabled') === 'true' ? 1 : 0,
        vis: agenteVisivel(el) ? 1 : 0,
        pos: `${Math.round(r.left)},${Math.round(r.top)}`
      };
    };
    const main = document.querySelector('#main');
    const topoMain = main ? Array.from(main.querySelectorAll('button, [role="button"], [data-icon], header, [aria-label]'))
      .filter(el => el.getBoundingClientRect().top < main.getBoundingClientRect().top + 160).slice(0, 40).map(desc) : [];
    const abertos = Array.from(document.querySelectorAll('[role="dialog"], [role="menu"], [role="application"], [data-animate-modal-body], ul'))
      .filter(agenteVisivel).filter(el => !el.closest('#pane-side') && !el.closest('#main [role="application"]'))
      .slice(0, 6).map(el => ({ ...desc(el), itens: Array.from(el.querySelectorAll('button, [role="button"], [role="menuitem"], li, input, [contenteditable="true"], [data-icon]')).slice(0, 40).map(desc) }));
    const daRaiz = raiz && raiz !== document ? Array.from(raiz.querySelectorAll('button, [role="button"], input, [contenteditable="true"], [data-icon], [tabindex]')).slice(0, 50).map(desc) : [];
    const { agenteDiagnosticos = [] } = await chrome.storage.local.get('agenteDiagnosticos');
    agenteDiagnosticos.unshift({ em: new Date().toISOString(), etapa, temMain: !!main, temHeader: !!document.querySelector('#main header'), topoMain, abertos, daRaiz });
    await chrome.storage.local.set({ agenteDiagnosticos: agenteDiagnosticos.slice(0, 6) });
  } catch (_) { /* diagnóstico é só ajuda */ }
}

// Etiqueta: 1) botão de etiqueta no cabeçalho (WhatsApp antigo); 2) menu ⋮ → "Etiquetar conversa" (atual)
async function agenteEtiquetar(add = [], remove = []) {
  const antigo = await agenteTrocarEtiquetas(add, remove);
  if (antigo.ok || !/não achei o botão de etiquetas/i.test(antigo.error || '')) return antigo;

  const ITEM = /^(etiquetar( conversa)?|label( chat)?|adicionar etiqueta|add label|editar etiquetas|edit labels|etiquetas|labels)$/i;
  const abrirMenu = async () => {
    const menu = agenteMenuDaConversa();
    if (!menu) return null;
    menu.click();
    return agenteEsperarBotao(ITEM, 2500);
  };
  // alternativa: botão direito na conversa selecionada da lista (também tem "Etiquetar conversa")
  const abrirPeloBotaoDireito = async () => {
    const linha = document.querySelector('#pane-side [aria-selected="true"]') || document.querySelector('#pane-side [role="row"] [aria-selected="true"]');
    if (!linha) return null;
    const r = linha.getBoundingClientRect();
    linha.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: r.left + 40, clientY: r.top + r.height / 2, button: 2 }));
    return agenteEsperarBotao(ITEM, 2500);
  };
  let item = await abrirMenu();
  if (!item) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await agenteDelay(400);
    item = await abrirPeloBotaoDireito();
  }
  if (!item) {
    await agenteGuardarDiagnostico('etiqueta: item "Etiquetar conversa" não encontrado');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return { ok: false, error: 'não achei "Etiquetar conversa" (nem no menu ⋮ da conversa nem com o botão direito). Guardei os detalhes da tela para ajuste.' };
  }
  item.click();
  await agenteDelay(1200);

  // diálogo com a lista de etiquetas (cada uma com caixinha)
  const dialogo = Array.from(document.querySelectorAll('[role="dialog"], [data-animate-modal-body]')).find(agenteVisivel) || document;
  const opcoes = () =>
    Array.from(dialogo.querySelectorAll('li, [role="checkbox"], [role="option"], [role="listitem"], label, [role="button"]'))
      .filter(el => agenteVisivel(el) && agenteRotulo(el).length > 0 && agenteRotulo(el).length < 40);
  const marcada = el => {
    const cb = el.matches('input[type="checkbox"]') ? el : el.querySelector('input[type="checkbox"]');
    if (cb) return cb.checked;
    const aria = el.getAttribute('aria-checked') ?? el.querySelector('[aria-checked]')?.getAttribute('aria-checked') ?? el.getAttribute('aria-selected');
    if (aria != null) return aria === 'true';
    return !!el.querySelector('[data-icon*="checkbox-checked" i], [data-icon*="checkmark" i]');
  };
  const nomes = opcoes().map(o => agenteRotulo(o));
  const feitas = [];
  for (const nome of [...add, ...remove]) {
    const alvo = agenteNorm(nome);
    const op = opcoes().find(o => agenteNorm(agenteRotulo(o)) === alvo);
    if (!op) {
      if (add.includes(nome)) feitas.push(`etiqueta "${nome}" não existe (opções: ${nomes.slice(0, 12).join(', ') || 'nenhuma'})`);
      continue;
    }
    const quer = add.includes(nome);
    if (marcada(op) !== quer) {
      (op.querySelector('input[type="checkbox"], [role="checkbox"]') || op).click();
      await agenteDelay(600);
      feitas.push(`${quer ? '+' : '-'}${nome}`);
    }
  }
  const salvar = agenteBotaoConfirmar(dialogo === document ? document : dialogo);
  if (salvar) {
    salvar.click();
    await agenteDelay(1200);
  } else if (feitas.some(f => /^[+-]/.test(f))) {
    return { ok: false, error: `marquei a etiqueta mas não achei o botão Salvar. Botões: ${agenteDescreverBotoes(dialogo)}`, alteracoes: feitas };
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { ok: true, alteracoes: feitas };
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

// Liga a chave "Sincronizar contato com o telefone" do formulário de novo contato (se estiver desligada).
// Devolve 'ligou' | 'ja_ligada' | null (não achou a chave).
function agenteLigarSincronizacao() {
  const rotulo = /sincroniz|sync/i;
  const visivel = el => {
    const alvo = el.matches('input') ? el.closest('label') || el.parentElement || el : el;
    return alvo.getClientRects().length > 0 && getComputedStyle(alvo).visibility !== 'hidden';
  };
  const chaves = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]'))
    .filter(el => visivel(el) && !el.closest('#inmovya-scale-root') && !el.closest('#pane-side') && !el.closest('#main footer') && !el.closest('li'));
  for (const chave of chaves) {
    // o texto da opção fica na MESMA linha da chave (bloco pequeno: pai/avô), nunca na página inteira
    const textoDe = el => `${el.innerText || ''} ${el.getAttribute?.('aria-label') || ''}`;
    let bloco = chave;
    for (let i = 0; i < 3 && bloco && !rotulo.test(textoDe(bloco)); i++) bloco = bloco.parentElement;
    if (!bloco || !rotulo.test(textoDe(bloco)) || (bloco.innerText || '').length > 120) continue;
    const ligada = chave.matches('input') ? chave.checked : chave.getAttribute('aria-checked') === 'true';
    if (ligada) return 'ja_ligada';
    (chave.matches('input') ? chave.closest('label') || chave : chave).click();
    return 'ligou';
  }
  return null;
}

// qualquer botão (mesmo fora da tela, lá embaixo do formulário) com "Salvar"/"Save" no texto
function agenteBotaoSalvarPorTexto() {
  return Array.from(document.querySelectorAll('button, [role="button"], div[tabindex]'))
    .filter(el => !el.closest('#inmovya-scale-root') && !el.closest('#main footer') && !el.closest('#pane-side'))
    .find(el => /^(salvar|save|salvar contato|save contact)$/i.test((el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()) && el.getBoundingClientRect().width > 0) || null;
}

async function agenteSalvarContato(nomeCompleto, telefone) {
  const nome = String(nomeCompleto || '').replace(/\s+/g, ' ').trim();
  if (!nome) return { salvo: false, motivo: 'lead sem nome' };
  // Não dá para confiar no nome do topo: em número NÃO salvo o WhatsApp pode mostrar o nome do perfil do lead.
  // O que vale é existir o botão "Adicionar contato" (na conversa, no menu ⋮ ou nos dados do contato).
  const titulo = agenteTituloConversa();

  const ADICIONAR = /^(adicionar( aos?)? contatos?|adicionar contato|novo contato|salvar contato|add( to)? contacts?|add contact|new contact|save contact)$/i;
  // 1) botão na própria conversa (aviso de número desconhecido) ou no menu ⋮ do cabeçalho
  let botao = agenteAcharBotao(ADICIONAR, document.querySelector('#main') || document);
  if (!botao) {
    const menu = agenteMenuDaConversa();
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
  if (!botao) {
    await agenteGuardarDiagnostico(`contato: sem botão "Adicionar contato" (topo da conversa: "${titulo}")`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // sem botão de adicionar e com nome no topo: é contato salvo de verdade
    if (/[a-zà-ÿ]/i.test(titulo) && !titulo.startsWith('~')) return { salvo: true, jaEstava: true, motivo: `já estava salvo como "${titulo}"` };
    return { salvo: false, motivo: 'não achei o botão "Adicionar contato" no WhatsApp Web. Guardei os detalhes da tela para ajuste.' };
  }
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

  // telefone: o formulário às vezes abre com o número vazio (e o Salvar só aparece com ele preenchido)
  const campoTel = Array.from(document.querySelectorAll('input[type="tel"], input[inputmode="tel"], input[type="text"], input:not([type])'))
    .filter(c => agenteVisivel(c) && !c.closest('#main footer') && !c.closest('#side') && !c.closest('#inmovya-scale-root') && c !== campoNome && c !== campoSobrenome)
    .find(c => c.type === 'tel' || c.inputMode === 'tel' || /telefone|phone|número|numero|celular/.test(rotuloCampo(c)));
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (campoTel && !String(campoTel.value || '').replace(/\D/g, '') && digitos) {
    // com o país "BR +55" já escolhido, vai só DDD + número
    agentePreencher(campoTel, digitos.startsWith('55') && digitos.length >= 12 ? digitos.slice(2) : digitos);
    await agenteDelay(800);
  }

  // "Sincronizar contato com o telefone": precisa estar LIGADO, senão o contato fica só no WhatsApp e não vai para a agenda do celular
  const sincronizacao = agenteLigarSincronizacao();
  if (sincronizacao) await agenteDelay(500);

  // o botão de salvar fica no mesmo painel do formulário (às vezes mais abaixo, ou só um ícone ✓)
  const painel = agentePainelDoCampo(campoNome);
  if (!sincronizacao) await agenteGuardarDiagnostico('contato: opção "sincronizar com o telefone" não encontrada', painel.parentElement || painel);
  let salvar = null;
  const fim = Date.now() + 4000;
  while (!salvar && Date.now() < fim) {
    salvar = agenteBotaoConfirmar(painel) || agenteBotaoConfirmar(document) || agenteBotaoSalvarPorTexto();
    if (!salvar) await agenteDelay(400);
  }
  if (!salvar) {
    await agenteGuardarDiagnostico('contato: botão Salvar não encontrado', painel);
    return { salvo: false, motivo: `não achei o botão Salvar do contato (botões vistos: ${agenteDescreverBotoes(painel)}). Guardei os detalhes da tela para ajuste.` };
  }
  salvar.scrollIntoView?.({ block: 'center' });
  await agenteDelay(300);
  salvar.click();
  // confirmação: o aviso "Fulano foi adicionado(a) à sua lista de contatos" ou o nome no cabeçalho
  const primeiro = agenteNorm(partes[0]);
  const fimConf = Date.now() + 6000;
  let confirmado = '';
  while (!confirmado && Date.now() < fimConf) {
    await agenteDelay(400);
    const aviso = Array.from(document.querySelectorAll('[role="status"], [role="alert"], li, span'))
      .map(el => (el.innerText || '').trim())
      .find(t => t.length < 160 && /(adicionad[oa]\(?a?\)? à sua lista de contatos|added to your contacts|contato salvo|contact saved)/i.test(t));
    if (aviso) confirmado = aviso;
    else if (agenteNorm(agenteTituloConversa()).includes(primeiro)) confirmado = `salvo como "${agenteTituloConversa()}"`;
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await agenteDelay(500);
  const sinc = sincronizacao === 'ligou' ? ' (liguei "sincronizar com o telefone")'
    : sincronizacao === 'ja_ligada' ? ' (sincroniza com o telefone)'
    : ' (não achei a opção de sincronizar com o telefone — guardei os detalhes do formulário para ajuste)';
  return confirmado
    ? { salvo: true, motivo: confirmado + sinc, sincronizado: !!sincronizacao }
    : { salvo: false, motivo: 'cliquei em Salvar, mas o WhatsApp não confirmou — confira no celular' + sinc };
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


// Robô de anúncios: na aba principal do WhatsApp, quando aparece conversa NÃO LIDA nova, acorda o robô na hora
// (sem esperar o próximo minuto). Só olha a lista; não abre nada.
(() => {
  if (location.search.includes('inmovya_auto')) return;
  let assinaturaAnterior = '';
  let ultimoAviso = 0;
  setInterval(() => {
    try {
      if (!document.querySelector('#pane-side')) return;
      const naoLidas = agenteLinhasVisiveis().map(agenteLerLinha).filter(l => l.naoLidas > 0 && !l.ultimaSua);
      const assinatura = naoLidas.map(l => `${l.nome}:${l.naoLidas}:${l.ultimaMensagem}`).join('|');
      if (assinatura && assinatura !== assinaturaAnterior && Date.now() - ultimoAviso > 8000) {
        ultimoAviso = Date.now();
        chrome.runtime.sendMessage({ action: 'robo_acordar' }).catch?.(() => {});
      }
      assinaturaAnterior = assinatura;
    } catch (_) { /* extensão recarregada: ignora */ }
  }, 3000);
})();
