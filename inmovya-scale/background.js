// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'web.whatsapp.com' }
          })
        ],
        actions: [new chrome.declarativeContent.ShowAction()]
      }
    ]);
  });
});


chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes("web.whatsapp.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_panel" });
  } else {
    chrome.tabs.create({ url: "https://web.whatsapp.com" });
  }
});

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tempo esgotado ao abrir o WhatsApp.'));
    }, timeoutMs);
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendCampaignMessage(request, returnTabId = null) {
  const phone = String(request.phone || '').replace(/\D/g, '');
  if (!phone) throw new Error('Telefone inválido.');
  const tab = await chrome.tabs.create({
    url: `https://web.whatsapp.com/send?phone=${phone}&inmovya_auto=1`,
    active: true
  });
  if (!tab.id) throw new Error('Não foi possível abrir o WhatsApp.');

  try {
    await waitForTabComplete(tab.id);
    let lastError;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const storedMedia = request.imageLocalId
          ? (await chrome.storage.local.get(`campaign_media_${request.imageLocalId}`))[`campaign_media_${request.imageLocalId}`]
          : null;
        if (request.imageLocalId && !storedMedia?.nativePath) {
          throw new Error('A imagem original da campanha não está mais disponível neste computador. Selecione-a novamente ao editar a campanha.');
        }
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'campaign_auto_send',
          text: request.text || '',
          attachment: storedMedia || null,
          // anexos das esteiras do Inmovya (qualquer tipo de arquivo, já em base64)
          attachments: Array.isArray(request.attachments) ? request.attachments : []
        });
        if (response?.ok) return response;
        lastError = new Error(response?.error || 'Envio não confirmado.');
      } catch (error) {
        lastError = error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw lastError || new Error('A extensão não conseguiu concluir o envio.');
  } finally {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await chrome.tabs.remove(tab.id).catch(() => {});
    if (returnTabId && returnTabId !== tab.id) {
      await chrome.tabs.update(returnTabId, { active: true }).catch(() => {});
    }
  }
}

const NATIVE_FILE_HOST = 'com.inmovya.scale.files';

function callNativeFileHost(message) {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connectNative(NATIVE_FILE_HOST);
    const chunks = [];
    let metadata = {};
    let settled = false;
    const finish = (callback, value) => { if (settled) return; settled = true; port.disconnect(); callback(value); };
    port.onMessage.addListener(response => {
      if (!response || response.ok === false) return finish(reject, new Error(response?.error || 'Falha no aplicativo auxiliar.'));
      if (response.event === 'chunk') { chunks.push(response.data || ''); return; }
      if (response.event === 'start') { metadata = response; return; }
      if (response.event === 'complete') return finish(resolve, { ...metadata, ...response, data: chunks.join('') });
      finish(resolve, response);
    });
    port.onDisconnect.addListener(() => { if (!settled) finish(reject, new Error(chrome.runtime.lastError?.message || 'Aplicativo auxiliar desconectado.')); });
    port.postMessage(message);
  });
}

function debuggerCommand(target, method, params = {}) {
  return chrome.debugger.sendCommand(target, method, params);
}

function attributesToObject(attributes = []) {
  const result = {};
  for (let index = 0; index < attributes.length; index += 2) {
    result[attributes[index]] = attributes[index + 1] || '';
  }
  return result;
}

function scoreFileInput(attributes, kind) {
  const accept = (attributes.accept || '').toLowerCase();
  const hasCapture = Object.prototype.hasOwnProperty.call(attributes, 'capture');
  const multiple = Object.prototype.hasOwnProperty.call(attributes, 'multiple');
  if (hasCapture) return -1;

  if (kind === 'media') {
    const imageAccepted = accept.includes('image/') || /\.(jpe?g|png|gif|webp|heic|heif)/.test(accept);
    const videoAccepted = accept.includes('video/') || /\.(mp4|mov|m4v|3gp|webm)/.test(accept);
    if (!imageAccepted && !videoAccepted) return -1;
    return (videoAccepted ? 100 : 0) + (imageAccepted ? 50 : 0) + (multiple ? 10 : 0);
  }

  if (accept.includes('image/') || accept.includes('video/') || accept.includes('audio/')) return -1;
  const documentAccepted = accept.includes('application/') || accept.includes('*') ||
    /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z)/.test(accept);
  return (documentAccepted ? 100 : 20) + (multiple ? 10 : 0);
}

async function setFilesWithDebugger(tabId, paths, kind, targetToken = '') {
  if (!tabId || !Array.isArray(paths) || !paths.length) throw new Error('Lista de arquivos inválida.');
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const { root } = await debuggerCommand(target, 'DOM.getDocument', { depth: -1, pierce: true });
    let exactTarget = /^[a-zA-Z0-9_-]+$/.test(targetToken);
    let { nodeIds = [] } = await debuggerCommand(target, 'DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: exactTarget
        ? `input[type="file"][data-inmovya-upload-target="${targetToken}"]`
        : 'input[type="file"]'
    });
    if (!nodeIds.length && targetToken) {
      exactTarget = false;
      ({ nodeIds = [] } = await debuggerCommand(target, 'DOM.querySelectorAll', {
        nodeId: root.nodeId,
        selector: 'input[type="file"]'
      }));
    }
    const candidates = [];
    for (const nodeId of nodeIds) {
      const { attributes } = await debuggerCommand(target, 'DOM.getAttributes', { nodeId });
      const parsed = attributesToObject(attributes);
      const score = exactTarget ? 1000 : scoreFileInput(parsed, kind);
      if (score >= 0) candidates.push({ nodeId, score });
    }
    candidates.sort((left, right) => right.score - left.score);
    if (!candidates.length) throw new Error(`Campo de ${kind === 'media' ? 'fotos e vídeos' : 'documentos'} não encontrado.`);
    await debuggerCommand(target, 'DOM.setFileInputFiles', { files: paths, nodeId: candidates[0].nodeId });
    return { ok: true };
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === 'campaign_pick_image') {
    (async () => {
      const result = await callNativeFileHost({ action: 'pick', multiple: false, kind: 'image' });
      const file = Array.isArray(result?.files) ? result.files[0] : null;
      if (!file) throw new Error('Nenhuma imagem foi selecionada.');
      if (!(file.type || '').toLowerCase().startsWith('image/')) throw new Error('Selecione somente uma imagem.');
      const localId = String(request.localId || '').trim() || crypto.randomUUID();
      const attachment = {
        name: file.name,
        type: file.type,
        size: file.size || 0,
        nativePath: file.path
      };
      await chrome.storage.local.set({ [`campaign_media_${localId}`]: attachment });
      return { localId, attachment };
    })()
      .then(({ localId, attachment }) => sendResponse({ ok: true, file: { localId, name: attachment.name, type: attachment.type, size: attachment.size } }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (request?.action === 'campaign_send') {
    sendCampaignMessage(request, sender.tab?.id || null)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (request?.action === 'debugger_set_files') {
    setFilesWithDebugger(sender.tab?.id, request.paths, request.kind, request.targetToken)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  const nativeActions = {
    native_pick_files: 'pick',
    native_read_file: 'read',
    native_prepare_files: 'prepare',
    native_attach_to_dialog: 'attach',
    native_activate_and_attach: 'activate_attach',
    native_press_enter: 'press_enter'
  };
  const nativeAction = nativeActions[request?.action];
  if (!nativeAction) return false;
  callNativeFileHost({ action: nativeAction, path: request.path || '', paths: request.paths || [], multiple: true })
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
