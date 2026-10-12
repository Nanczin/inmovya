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
        const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        const botao = document.querySelector('#main [data-testid="label-chat-header-button"]')
          || Array.from(document.querySelectorAll('#main header button')).find(b => /lista|etiqueta|label/i.test(b.getAttribute('aria-label') || ''));
        if (!botao) return sendResponse({ ok: false, final: true, error: 'Não achei o botão de etiquetas no WhatsApp.' });
        botao.click();
        await dom.delay(900);
        const aviso = Array.from(document.querySelectorAll('[data-testid="confirm-popup"] button')).find(b => /continuar|continue|ok/i.test(b.innerText));
        if (aviso) { aviso.click(); await dom.delay(900); }
        const lista = () => document.querySelector('[data-testid="label-chat-header-dropdown-items"]');
        if (!lista()) return sendResponse({ ok: false, error: 'A lista de etiquetas não abriu.' });
        const itens = () => Array.from(lista().querySelectorAll('li[data-testid^="label_item_"], li'));
        const marcada = li => !!li.querySelector('input[type="checkbox"]')?.checked;
        const adicionar = (request.add || []).map(norm);
        const remover = (request.remove || []).map(norm);
        const feitas = [];
        for (const nome of [...adicionar, ...remover]) {
          const li = itens().find(l => norm(l.innerText) === nome);
          if (!li) { if (adicionar.includes(nome)) feitas.push(`etiqueta "${nome}" não existe`); continue; }
          const querMarcada = adicionar.includes(nome);
          if (marcada(li) !== querMarcada) {
            li.click();
            await dom.delay(900);
            feitas.push(`${querMarcada ? '+' : '-'}${li.innerText.trim()}`);
          }
        }
        const final = itens().filter(marcada).map(l => l.innerText.trim());
        botao.click(); // fecha a lista
        await dom.delay(400);
        sendResponse({ ok: true, alteracoes: feitas, etiquetas: final });
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
