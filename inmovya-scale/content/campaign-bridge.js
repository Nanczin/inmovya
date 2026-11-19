(() => {
  const announceReady = () => window.dispatchEvent(new CustomEvent('INMOVYA_EXTENSION_READY', { detail: { version: chrome.runtime.getManifest().version } }));

  window.addEventListener('INMOVYA_CHECK_EXTENSION', announceReady);

  // 1º contato automático: o Inmovya entrega o token do agente para a extensão (que roda sozinha depois)
  window.addEventListener('INMOVYA_AGENTE_CONFIG', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'agente_config', config: detail.config || {} }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_AGENTE_CONFIG_RESULT', {
        detail: { token: detail.token, ok: !!response?.ok && !error, error: error || response?.error || '', ultimoEnvio: response?.ultimoEnvio || 0 }
      }));
    });
  });
  window.addEventListener('INMOVYA_OPEN_WHATSAPP', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'campaign_send', ...detail }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_WHATSAPP_RESULT', {
        detail: {
          token: detail.token,
          ok: !!response?.ok && !error,
          error: error || response?.error || '',
          semWhatsapp: !!response?.semWhatsapp
        }
      }));
    });
  });

  // Esteira "Só colar" em lote: cola a mensagem (sem enviar) na conversa de cada lead, uma atrás da outra
  window.addEventListener('INMOVYA_PASTE_BATCH', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'paste_batch', items: detail.items || [] }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_PASTE_BATCH_RESULT', {
        detail: { token: detail.token, ok: !!response?.ok && !error, results: response?.results || [], error: error || response?.error || '' }
      }));
    });
  });

  // Agente da esteira: ler conversa / trocar etiquetas de um contato
  window.addEventListener('INMOVYA_AGENT', event => {
    const detail = event.detail || {};
    const action = detail.op === 'batch' ? 'agent_batch' : detail.op === 'labels' ? 'agent_set_labels' : detail.op === 'save_label' ? 'agent_save_and_label' : 'agent_read_chat';
    chrome.runtime.sendMessage({ ...detail, action }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_AGENT_RESULT', {
        detail: { ...(response || {}), token: detail.token, ok: !!response?.ok && !error, error: error || response?.error || '' }
      }));
    });
  });

  // Ferramentas do WhatsApp (Dinheiro na Mesa, Disparo): ligar/desligar pelo Inmovya
  window.addEventListener('INMOVYA_FERRAMENTAS', event => {
    const detail = event.detail || {};
    const msg = detail.ferramentas ? { action: 'ferramentas_set', ferramentas: detail.ferramentas } : { action: 'ferramentas_get' };
    chrome.runtime.sendMessage(msg, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_FERRAMENTAS_RESULT', {
        detail: { token: detail.token, ok: !!response?.ok && !error, ferramentas: response?.ferramentas || null, error: error || '' }
      }));
    });
  });

  // Trava de engajamento: o Inmovya pergunta se pode enviar, registra envios/respostas, vê o status e testa
  const TRAVA_OPS = ['pode', 'registrar', 'resposta', 'status', 'retomar', 'cfg', 'alarme', 'teste'];
  window.addEventListener('INMOVYA_TRAVA', event => {
    const detail = event.detail || {};
    const responder = (dados) => window.dispatchEvent(new CustomEvent('INMOVYA_TRAVA_RESULT', { detail: { token: detail.token, ...dados } }));
    if (!TRAVA_OPS.includes(detail.op)) return responder({ ok: false, error: 'operação desconhecida' });
    try {
      chrome.runtime.sendMessage({ ...(detail.dados || {}), action: `trava_${detail.op}` }, response => {
        const error = chrome.runtime.lastError?.message;
        responder(error ? { ok: false, error } : response || { ok: false, error: 'sem resposta' });
      });
    } catch (e) {
      responder({ ok: false, error: 'A extensão foi recarregada. Atualize esta página (F5).' });
    }
  });

  // Respostas dos leads (WhatsApp → Inmovya): o lead sai da esteira na hora
  const entregarRespostasNaPagina = itens => {
    if (Array.isArray(itens) && itens.length) window.dispatchEvent(new CustomEvent('INMOVYA_RESPOSTAS', { detail: { itens } }));
  };
  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.action === 'inmovya_respostas') entregarRespostasNaPagina(msg.itens);
  });
  const buscarRespostas = () =>
    chrome.runtime.sendMessage({ action: 'respostas_pendentes' }, r => {
      if (chrome.runtime.lastError) return;
      entregarRespostasNaPagina(r?.itens);
    });
  window.addEventListener('INMOVYA_RESPOSTAS_BUSCAR', buscarRespostas);
  window.addEventListener('INMOVYA_RECARREGAR_EXTENSAO', () => {
    chrome.runtime.sendMessage({ action: 'recarregar_extensao' }, () => void chrome.runtime.lastError);
  });
  window.addEventListener('INMOVYA_TESTE_ABRIR', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'teste_abrir', phone: detail.phone }, r => {
      window.dispatchEvent(new CustomEvent('INMOVYA_TESTE_ABRIR_RESULT', { detail: { token: detail.token, r: chrome.runtime.lastError ? { erro: chrome.runtime.lastError.message } : r } }));
    });
  });
  // Varredura: quem da esteira já respondeu (o WhatsApp Web aberto confere)
  window.addEventListener('INMOVYA_VARRER_RESPOSTAS', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'varrer_respostas', itens: detail.itens || [], tipo: detail.tipo || 'resposta' }, response => {
      const error = chrome.runtime.lastError?.message || (!response?.ok && response?.error) || '';
      window.dispatchEvent(new CustomEvent('INMOVYA_VARRER_RESPOSTAS_RESULT', {
        detail: { token: detail.token, ok: !!response?.ok && !chrome.runtime.lastError, respondidos: response?.respondidos || [], error }
      }));
    });
  });
  window.addEventListener('INMOVYA_RESPOSTAS_OK', event => {
    chrome.runtime.sendMessage({ action: 'respostas_ok', telefones: event.detail?.telefones || [] }, () => void chrome.runtime.lastError);
  });

  // Prioridade: o Inmovya pergunta se o 1º contato está atendendo / tem lead novo esperando
  window.addEventListener('INMOVYA_PRIORIDADE', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'prioridade_status' }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_PRIORIDADE_RESULT', {
        detail: { ...(response || {}), token: detail.token, ok: !!response?.ok && !error, error: error || response?.error || '' }
      }));
    });
  });

  // Leitura das etiquetas do WhatsApp (o WhatsApp é a referência do Inmovya)
  window.addEventListener('INMOVYA_READ_WA_LABELS', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'read_wa_labels' }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_WA_LABELS_RESULT', {
        detail: {
          token: detail.token,
          ok: !!response?.ok && !error,
          labels: response?.labels || [],
          error: error || response?.error || ''
        }
      }));
    });
  });

  window.addEventListener('INMOVYA_PICK_CAMPAIGN_IMAGE', event => {
    const detail = event.detail || {};
    chrome.runtime.sendMessage({ action: 'campaign_pick_image', localId: detail.localId }, response => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent('INMOVYA_CAMPAIGN_IMAGE_RESULT', {
        detail: {
          token: detail.token,
          ok: !!response?.ok && !error,
          file: response?.file || null,
          error: error || response?.error || ''
        }
      }));
    });
  });

  // Inmovya lê as esteiras/etiquetas guardadas no Scale (para unificar no CRM)
  window.addEventListener('INMOVYA_SCALE_EXPORT', async event => {
    const detail = event.detail || {};
    try {
      const keys = ['replies', 'categories', 'settings', 'waLabels', 'leadCategoryAssignments', 'leadStageAssignments'];
      const data = await chrome.storage.local.get(keys);
      // anexos vão só com nome/tipo (sem o arquivo em si)
      if (Array.isArray(data.replies)) {
        data.replies = data.replies.map(reply => ({
          ...reply,
          attachments: (reply.attachments || []).map(att => ({ name: att.name, type: att.type }))
        }));
      }
      window.dispatchEvent(new CustomEvent('INMOVYA_SCALE_DATA', {
        detail: { token: detail.token, ok: true, json: JSON.stringify({ backupVersion: 2, data }) }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('INMOVYA_SCALE_DATA', {
        detail: { token: detail.token, ok: false, error: error?.message || String(error) }
      }));
    }
  });

  announceReady();
})();
