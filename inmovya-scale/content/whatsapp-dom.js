// content/whatsapp-dom.js
window.IS = window.IS || {};

window.IS.WhatsAppDOM = {
  findMessageInput() {
    const selectors = [
      '#main footer div[contenteditable="true"][role="textbox"]',
      '#main footer div[contenteditable="true"][data-lexical-editor="true"]',
      '#main footer div[contenteditable="true"]',
      '#main div[contenteditable="true"][role="textbox"]',
      '#main div[contenteditable="true"][data-tab="10"]'
    ];

    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (let i = candidates.length - 1; i >= 0; i--) {
        const candidate = candidates[i];
        if (
          candidate.offsetParent !== null &&
          !candidate.closest('#inmovya-scale-root') &&
          candidate.getAttribute('aria-disabled') !== 'true'
        ) {
          return candidate;
        }
      }
    }

    return null;
  },

  async waitForMessageInput(timeoutMs = 3000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const input = this.findMessageInput();
      if (input) return input;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  getFileInputFromMenuItem(item, validator) {
    const candidates = [];
    const addCandidate = input => {
      if (input && input.type === 'file' && !candidates.includes(input)) candidates.push(input);
    };

    item.querySelectorAll('input[type="file"]').forEach(addCandidate);
    if (item.tagName === 'LABEL' && item.htmlFor) addCandidate(document.getElementById(item.htmlFor));

    const label = item.closest('label');
    if (label) {
      label.querySelectorAll('input[type="file"]').forEach(addCandidate);
      if (label.htmlFor) addCandidate(document.getElementById(label.htmlFor));
    }

    let parent = item.parentElement;
    for (let level = 0; parent && level < 3; level++, parent = parent.parentElement) {
      parent.querySelectorAll('input[type="file"]').forEach(addCandidate);
    }

    return candidates.find(validator) || null;
  },

  isPhotosAndVideosInput(input, fromPhotosMenu = false) {
    if (!input || input.closest('#inmovya-scale-root')) return false;
    const accept = (input.getAttribute('accept') || '').toLowerCase();
    const contextParts = [];
    let current = input;
    for (let level = 0; current && level < 5; level++, current = current.parentElement) {
      contextParts.push(current.getAttribute('aria-label') || '', current.getAttribute('title') || '');
    }
    const context = contextParts.join(' ').toLowerCase();
    const stickerOnly = /sticker|figurinha/.test(context) ||
      (/webp/.test(accept) && !accept.includes('video') && !accept.includes('jpeg') && !accept.includes('png'));
    const cameraInput = input.hasAttribute('capture') || /c[aâ]mera|camera/.test(context);
    const mediaCapability = accept.includes('video') || input.multiple || fromPhotosMenu;
    return accept.includes('image') && mediaCapability && !stickerOnly && !cameraInput;
  },

  isDocumentInput(input) {
    if (!input || input.closest('#inmovya-scale-root')) return false;
    const accept = (input.getAttribute('accept') || '').toLowerCase();
    return accept === '*' || accept.includes('application/') || (!accept.includes('image') && !accept.includes('video'));
  },

  findMediaFileInput() {
    const menuItems = document.querySelectorAll('[role="menuitem"], li, label, div[role="button"]');
    for (const item of menuItems) {
      if (item.offsetParent === null || item.closest('#inmovya-scale-root')) continue;
      const context = `${item.getAttribute('aria-label') || ''} ${item.getAttribute('title') || ''} ${item.textContent || ''}`.toLowerCase();
      if (!/fotos?.*v[ií]deos?|photos?.*videos?|photos? & videos?/.test(context)) continue;
      const input = this.getFileInputFromMenuItem(item, candidate => this.isPhotosAndVideosInput(candidate, true));
      if (input) return input;
    }

    return Array.from(document.querySelectorAll('#main input[type="file"], input[type="file"]'))
      .find(input => this.isPhotosAndVideosInput(input)) || null;
  },

  async waitForMediaFileInput(timeoutMs = 3000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const input = this.findMediaFileInput();
      if (input) return input;
      await this.delay(100);
    }
    return null;
  },

  findDocumentFileInput() {
    const menuItems = document.querySelectorAll('[role="menuitem"], li, label, div[role="button"]');
    for (const item of menuItems) {
      if (item.offsetParent === null || item.closest('#inmovya-scale-root')) continue;
      const context = `${item.getAttribute('aria-label') || ''} ${item.getAttribute('title') || ''} ${item.textContent || ''}`.toLowerCase();
      if (!/documento|document/.test(context)) continue;
      const input = this.getFileInputFromMenuItem(item, candidate => this.isDocumentInput(candidate));
      if (input) return input;
    }

    return Array.from(document.querySelectorAll('input[type="file"]'))
      .find(input => this.isDocumentInput(input)) || null;
  },

  async waitForDocumentFileInput(timeoutMs = 3000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const input = this.findDocumentFileInput();
      if (input) return input;
      await this.delay(100);
    }
    return null;
  },

  openAttachmentMenu() {
    const selectors = [
      '#main footer button[aria-label*="anex" i]',
      '#main footer [role="button"][aria-label*="anex" i]',
      '#main footer button[title*="anex" i]',
      '#main footer [role="button"][title*="anex" i]',
      '#main footer button[aria-label*="attach" i]',
      '#main footer [role="button"][aria-label*="attach" i]',
      '#main footer button[title*="attach" i]',
      '#main footer span[data-icon="plus-rounded"]',
      '#main footer span[data-icon="plus"]',
      '#main footer span[data-icon="plus-alt"]',
      '#main footer span[data-icon="attach-menu-plus"]',
      '#main footer span[data-icon="clip"]',
      '#main footer [data-icon*="attach" i]',
      '#main footer [data-icon*="plus" i]'
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const button = element && (element.matches('button, div[role="button"]')
        ? element
        : element.closest('button, div[role="button"]'));
      if (button && button.offsetParent !== null) {
        button.click();
        return true;
      }
    }

    const footerButtons = document.querySelectorAll('#main footer button, #main footer div[role="button"]');
    for (const button of footerButtons) {
      if (button.offsetParent === null || button.closest('#inmovya-scale-root')) continue;
      const iconNames = Array.from(button.querySelectorAll('[data-icon]'))
        .map(icon => icon.getAttribute('data-icon') || '').join(' ');
      const context = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${iconNames}`.toLowerCase();
      if (/(anex|attach|clip|plus)/.test(context) && !/(figurinha|sticker|emoji)/.test(context)) {
        button.click();
        return true;
      }
    }
    return false;
  },

  openAttachmentOption(kind, focusOnly = false) {
    const pattern = kind === 'media'
      ? /^(fotos?\s*(?:e|&)\s*v[ií]deos?|photos?\s*(?:and|&)\s*videos?)$/
      : /^(documento|document)$/;
    const candidates = document.querySelectorAll('[role="menuitem"], li, label, button, div[role="button"]');
    for (const candidate of candidates) {
      if (candidate.offsetParent === null || candidate.closest('#inmovya-scale-root')) continue;
      // Nunca considere mensagens ou anexos já enviados. Um PDF com o texto
      // "Documento" dentro da conversa estava recebendo foco e abrindo o
      // leitor em vez do seletor de arquivos.
      if (candidate.closest('#main [data-testid*="msg" i], #main [data-testid*="message" i], #main [role="row"], #main [role="listitem"]')) continue;
      const texts = [
        candidate.getAttribute('aria-label'),
        candidate.getAttribute('title'),
        candidate.innerText,
        candidate.textContent
      ].map(value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase());
      if (!texts.some(text => pattern.test(text))) continue;
      const menuRoot = candidate.closest('[role="menu"], [data-animate-dropdown-menu], [data-animate-modal-popup]');
      if (!menuRoot && candidate.closest('#main') && !candidate.closest('#main footer')) continue;
      if (focusOnly) {
        const focusTarget = candidate.matches('button, [role="menuitem"], [tabindex], label')
          ? candidate
          : candidate.querySelector('button, [role="menuitem"], [tabindex], label');
        if (!focusTarget) return false;
        if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
        if (document.activeElement !== focusTarget) return false;
      } else {
        candidate.click();
      }
      return true;
    }
    return false;
  },

  findMediaCaptionInput() {
    const selectors = [
      '[role="dialog"] div[contenteditable="true"][aria-label*="legenda" i]',
      '[role="dialog"] div[contenteditable="true"][aria-placeholder*="legenda" i]',
      '[role="dialog"] div[contenteditable="true"][data-lexical-editor="true"]',
      '[role="dialog"] div[contenteditable="true"][role="textbox"]',
      '[data-animate-modal-popup] div[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]'
    ];
    const messageInput = this.findMessageInput();
    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (let i = candidates.length - 1; i >= 0; i--) {
        const candidate = candidates[i];
        if (candidate !== messageInput && candidate.offsetParent !== null && !candidate.closest('#inmovya-scale-root')) {
          return candidate;
        }
      }
    }
    return null;
  },

  async waitForMediaCaptionInput(timeoutMs = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const input = this.findMediaCaptionInput();
      if (input) return input;
      await this.delay(100);
    }
    return null;
  },

  async triggerSend(allowKeyboardFallback = true) {
    for (let i = 0; i < 20; i++) {
      const sendIcons = document.querySelectorAll('[role="dialog"] span[data-icon="send"], span[data-icon="send"]');
      for (let j = sendIcons.length - 1; j >= 0; j--) {
        const icon = sendIcons[j];
        const button = icon.closest('button, div[role="button"]');
        if (button && button.offsetParent !== null && !button.closest('#inmovya-scale-root')) {
          button.click();
          return true;
        }
      }
      await this.delay(150);
    }

    const input = allowKeyboardFallback ? this.findMessageInput() : null;
    if (!input) return false;
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
    }));
    return true;
  },

  findSendButtonInside(root) {
    if (!root) return null;
    const candidates = root.querySelectorAll('button, div[role="button"]');
    for (let index = candidates.length - 1; index >= 0; index--) {
      const button = candidates[index];
      if (button.offsetParent === null || button.closest('#inmovya-scale-root')) continue;
      const icons = Array.from(button.querySelectorAll('[data-icon]'))
        .map(icon => icon.getAttribute('data-icon') || '').join(' ');
      const context = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${icons}`.toLowerCase();
      if (/enviar|send/.test(context)) return button;
    }
    return null;
  },

  findAttachmentSendButton() {
    const captionInput = this.findMediaCaptionInput();
    let previewRoot = captionInput?.parentElement || null;
    for (let level = 0; previewRoot && level < 10; level++, previewRoot = previewRoot.parentElement) {
      if (previewRoot.id === 'main' || previewRoot === document.body) break;
      const button = this.findSendButtonInside(previewRoot);
      if (button) return button;
    }

    const modalRoots = document.querySelectorAll('[role="dialog"], [data-animate-modal-popup]');
    for (let index = modalRoots.length - 1; index >= 0; index--) {
      const root = modalRoots[index];
      if (root.offsetParent === null || root.closest('#inmovya-scale-root')) continue;
      const button = this.findSendButtonInside(root);
      if (button) return button;
    }
    return null;
  },

  async triggerDocumentSend() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const sendButton = this.findAttachmentSendButton();
      if (sendButton) {
        sendButton.click();
        return true;
      }
      await this.delay(150);
    }
    window.IS.error('Botão Enviar da prévia do documento não encontrado.');
    return false;
  },

  async triggerMediaSend(captionInput = null, preferSendButton = false) {
    if (preferSendButton) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const sendButton = this.findAttachmentSendButton();
        if (sendButton) {
          sendButton.click();
          return true;
        }
        await this.delay(150);
      }
      // Sem legenda, Enter poderia abrir a miniatura do documento. Nesse caso,
      // falhe com segurança em vez de abrir o visualizador do WhatsApp.
      if (!captionInput) return false;
    }

    const target = captionInput || this.findMediaCaptionInput() || document.activeElement;
    if (!target || target === document.body) return this.triggerSend(false);

    target.focus();
    try {
      const nativeResponse = await chrome.runtime.sendMessage({ action: 'native_press_enter' });
      if (nativeResponse?.ok) {
        await this.delay(900);
        if (!this.hasMediaPreview()) return true;
      }
    } catch (error) {
      window.IS.log('Confirmação nativa indisponível; usando botão do WhatsApp.', error);
    }

    const eventOptions = {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      bubbles: true, cancelable: true
    };
    target.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
    target.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
    target.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

    await this.delay(700);
    const previewStillOpen = !!this.findMediaCaptionInput();
    return previewStillOpen ? this.triggerSend(false) : true;
  },

  dataUrlToFile(attachment) {
    const base64 = (attachment.data || '').split(',')[1] || attachment.data || '';
    const bytes = atob(base64);
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 512) {
      const slice = bytes.slice(offset, offset + 512);
      chunks.push(Uint8Array.from(slice, character => character.charCodeAt(0)));
    }
    return new File(chunks, attachment.name || 'anexo', { type: attachment.type || 'application/octet-stream' });
  },

  async resolveNativeAttachment(attachment) {
    if (!attachment.nativePath) return attachment;
    const response = await chrome.runtime.sendMessage({ action: 'native_read_file', path: attachment.nativePath });
    if (!response?.ok || !response.data) throw new Error(response?.error || `Não foi possível ler ${attachment.name}.`);
    const type = response.type || attachment.type || 'application/octet-stream';
    return { ...attachment, name: response.name || attachment.name, type, data: `data:${type};base64,${response.data}` };
  },

  isMediaAttachment(attachment) {
    const type = (attachment.type || '').toLowerCase();
    const name = (attachment.name || '').toLowerCase();
    return type.startsWith('image/') || type.startsWith('video/') ||
      /\.(jpe?g|png|gif|webp|heic|heif|mp4|mov|m4v|3gp|webm)$/i.test(name);
  },

  async prepareMediaFile(attachment) {
    const file = this.dataUrlToFile(attachment);
    const mediaType = file.type.toLowerCase();
    if (!mediaType.startsWith('image/') || mediaType === 'image/gif') return file;

    const image = new Image();
    image.src = attachment.data;
    const loaded = await new Promise(resolve => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
    });
    // HEIC e outros formatos não decodificados pelo navegador seguem intactos
    // para que o próprio WhatsApp faça a conversão.
    if (!loaded || !image.naturalWidth || !image.naturalHeight) return file;

    const canvas = document.createElement('canvas');
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return file;

    const jpegName = (attachment.name || 'imagem').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], jpegName, { type: 'image/jpeg' });
  },

  async insertTextIntoInput(input, text) {
    if (!input || !text) return true;
    input.focus();
    input.click();

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const normalizedText = String(text).replace(/\r\n?/g, '\n');
    const transfer = new DataTransfer();
    transfer.setData('text/plain', normalizedText);
    input.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true
    }));
    await this.delay(120);

    let insertedText = (input.innerText || input.textContent || '').trim();
    if (!insertedText) {
      // Alguns editores bloqueiam eventos de colagem sintéticos. Insira o
      // conteúdo inteiro de uma vez para que as quebras façam parte da mesma
      // alteração reconhecida pelo editor do WhatsApp.
      document.execCommand('insertText', false, normalizedText);
      await this.delay(120);
      insertedText = (input.innerText || input.textContent || '').trim();
    }
    // execCommand and the paste fallback already notify WhatsApp's editor.
    // Dispatching another input event with the same data makes Lexical insert
    // every sequence item twice in newer WhatsApp Web versions.
    return insertedText.length > 0;
  },

  dispatchFileEvent(target, type, transfer) {
    try {
      target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    } catch (_error) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: transfer });
      target.dispatchEvent(event);
    }
  },

  hasMediaPreview() {
    if (this.findMediaCaptionInput()) return true;
    return Array.from(document.querySelectorAll('[role="dialog"] span[data-icon="send"], [data-animate-modal-popup] span[data-icon="send"]'))
      .some(icon => {
        const button = icon.closest('button, div[role="button"]');
        return button && button.offsetParent !== null && !button.closest('#inmovya-scale-root');
      });
  },

  async waitForMediaPreview(timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.hasMediaPreview()) return true;
      await this.delay(200);
    }
    return false;
  },

  async waitForMediaPreviewClosed(timeoutMs = 20000) {
    const startedAt = Date.now();
    let consecutiveClosedChecks = 0;
    while (Date.now() - startedAt < timeoutMs) {
      if (this.hasMediaPreview()) {
        consecutiveClosedChecks = 0;
      } else {
        consecutiveClosedChecks += 1;
        if (consecutiveClosedChecks >= 3) return true;
      }
      await this.delay(200);
    }
    return false;
  },

  async injectFilesIntoChat(files) {
    const messageInput = await this.waitForMessageInput();
    if (!messageInput) return false;
    messageInput.focus();
    messageInput.click();
    const dropTransfer = new DataTransfer();
    files.forEach(file => dropTransfer.items.add(file));
    this.dispatchFileEvent(messageInput, 'dragenter', dropTransfer);
    this.dispatchFileEvent(messageInput, 'dragover', dropTransfer);
    this.dispatchFileEvent(messageInput, 'drop', dropTransfer);

    const fileTypes = files.map(file => (file.type || '').toLowerCase());
    const onlyImages = fileTypes.every(type => type.startsWith('image/'));
    const needsLongProcessing = fileTypes.some(type => type.startsWith('video/')) || !onlyImages;
    if (await this.waitForMediaPreview(needsLongProcessing ? 20000 : 5000)) return true;
    if (!onlyImages) return false;

    const pasteTransfer = new DataTransfer();
    files.forEach(file => pasteTransfer.items.add(file));
    messageInput.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pasteTransfer, bubbles: true, cancelable: true }));
    return this.waitForMediaPreview(8000);
  },

  async attachNativeFiles(attachments, kind) {
    let paths = attachments.map(attachment => attachment.nativePath).filter(Boolean);
    if (paths.length !== attachments.length) return null;
    const prepared = await chrome.runtime.sendMessage({ action: 'native_prepare_files', paths, kind });
    if (!prepared?.ok || !Array.isArray(prepared.files) || prepared.files.length !== paths.length) {
      window.IS.error('O aplicativo auxiliar não conseguiu preparar os arquivos.', prepared?.error);
      return false;
    }
    paths = prepared.files.map(file => file.path).filter(Boolean);
    if (paths.length !== attachments.length) return false;
    if (this.hasMediaPreview() && !await this.waitForMediaPreviewClosed()) return false;
    if (!this.openAttachmentMenu()) {
      window.IS.error('Botão de anexos do WhatsApp não encontrado.');
      return false;
    }

    await this.delay(250);
    if (!this.openAttachmentOption(kind, true)) {
      window.IS.error(`Opção de ${kind === 'media' ? 'Fotos e vídeos' : 'Documento'} do WhatsApp não encontrada.`);
      return false;
    }
    const response = await chrome.runtime.sendMessage({
      action: 'native_activate_and_attach',
      paths
    });
    if (!response?.ok) {
      window.IS.error('Falha ao selecionar o arquivo no Windows', response?.error);
      return false;
    }
    const containsVideo = attachments.some(attachment => (attachment.type || '').toLowerCase().startsWith('video/'));
    return this.waitForMediaPreview(containsVideo ? 45000 : (kind === 'media' ? 15000 : 20000));
  },

  async sendAttachmentBatch(attachments, caption = '') {
    try {
      const nativeResult = await this.attachNativeFiles(attachments, 'media');
      const accepted = nativeResult === null
        ? await this.injectFilesIntoChat(await Promise.all(attachments.map(async attachment => {
            const resolved = await this.resolveNativeAttachment(attachment);
            return this.prepareMediaFile(resolved);
          })))
        : nativeResult;
      if (!accepted) {
        window.IS.error('O WhatsApp não aceitou os arquivos na conversa.');
        return false;
      }

      await this.delay(1800);
      let captionInput = null;
      if (caption) {
        captionInput = await this.waitForMediaCaptionInput();
        if (!captionInput || !await this.insertTextIntoInput(captionInput, caption)) {
          window.IS.error('Campo de legenda do WhatsApp não encontrado.');
          return false;
        }
        await this.delay(250);
      }

      if (!await this.triggerMediaSend(captionInput)) return false;
      const containsVideo = attachments.some(attachment => (attachment.type || '').toLowerCase().startsWith('video/'));
      if (!await this.waitForMediaPreviewClosed(containsVideo ? 45000 : 20000)) {
        window.IS.error('O WhatsApp não confirmou o envio do anexo antes do próximo item.');
        return false;
      }
      return true;
    } catch (error) {
      window.IS.error('Erro ao enviar anexos', error);
      return false;
    }
  },

  async sendDocumentBatch(attachments, caption = '') {
    try {
      const nativeResult = await this.attachNativeFiles(attachments, 'document');
      const accepted = nativeResult === null
        ? await this.injectFilesIntoChat(await Promise.all(attachments.map(async attachment => {
            const resolved = await this.resolveNativeAttachment(attachment);
            return this.dataUrlToFile(resolved);
          })))
        : nativeResult;
      if (!accepted) {
        window.IS.error('O WhatsApp não aceitou os documentos na conversa.');
        return false;
      }

      await this.delay(1800);
      let captionInput = null;
      if (caption) {
        captionInput = await this.waitForMediaCaptionInput();
        if (!captionInput || !await this.insertTextIntoInput(captionInput, caption)) {
          window.IS.error('Campo de legenda do documento não encontrado.');
          return false;
        }
        await this.delay(250);
      }
      if (!await this.triggerDocumentSend()) return false;
      if (!await this.waitForMediaPreviewClosed(30000)) {
        window.IS.error('O WhatsApp não confirmou o envio do documento antes do próximo item.');
        return false;
      }
      return true;
    } catch (error) {
      window.IS.error('Erro ao enviar documentos', error);
      return false;
    }
  },

  showSendMask(totalFiles) {
    let mask = document.getElementById('inmovya-send-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'inmovya-send-mask';
      mask.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(255,255,255,.96);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;pointer-events:auto;font-family:Arial,sans-serif;';
      mask.innerHTML = `
        <style>@keyframes inmovya-send-spin{to{transform:rotate(360deg)}}</style>
        <div style="display:flex;flex-direction:column;align-items:center;gap:14px;color:#111b21;text-align:center;padding:24px;">
          <div style="width:34px;height:34px;border:4px solid #d9fdd3;border-top-color:#00a884;border-radius:50%;animation:inmovya-send-spin .8s linear infinite;"></div>
          <strong id="inmovya-send-mask-title" style="font-size:16px;">Preparando envio…</strong>
          <span style="font-size:12px;color:#667781;">Aguarde enquanto os arquivos são enviados.</span>
        </div>`;
      document.body.appendChild(mask);
    }
    mask.style.display = 'flex';
    this.updateSendMask(0, totalFiles);
  },

  updateSendMask(currentFile, totalFiles) {
    const title = document.getElementById('inmovya-send-mask-title');
    if (!title) return;
    title.textContent = currentFile > 0
      ? `Enviando arquivo ${currentFile} de ${totalFiles}…`
      : 'Preparando envio…';
  },

  hideSendMask() {
    document.getElementById('inmovya-send-mask')?.remove();
  },

  async insertSequenceAndAttachments(text, attachments = [], options = {}) {
    if (attachments.length) this.showSendMask(attachments.length);
    let currentAttachment = 0;
    try {
    const normalizedText = String(text || '').replace(/\r\n?/g, '\n');
    const parts = normalizedText.includes('\n\n===\n\n')
      ? normalizedText.split('\n\n===\n\n')
      : normalizedText.split('===');
    if (!parts.length && attachments.length) parts.push('');

    const lastMessageIndex = Math.max(0, parts.length - 1);
    const normalizedAttachments = attachments.map(attachment => ({
      ...attachment,
      messageIndex: Number.isInteger(attachment.messageIndex)
        ? Math.max(0, Math.min(attachment.messageIndex, lastMessageIndex))
        : lastMessageIndex,
      useCaption: !!attachment.useCaption
    }));

    for (let messageIndex = 0; messageIndex < parts.length; messageIndex++) {
      const message = parts[messageIndex];
      const linked = normalizedAttachments.filter(attachment => attachment.messageIndex === messageIndex);
      const hasCaptionedAttachment = linked.some(attachment => attachment.useCaption);

      if (message.trim() && !hasCaptionedAttachment) {
        if (!await this.insertMessage(message)) return false;
        const mustSendText = !!options.sendSingleText || parts.length > 1 || normalizedAttachments.length > 0;
        if (mustSendText) {
          await this.delay(250);
          if (!await this.triggerSend()) return false;
          await this.delay(700);
        }
      }

      for (const attachment of linked) {
        currentAttachment += 1;
        this.updateSendMask(currentAttachment, normalizedAttachments.length);
        if (this.isMediaAttachment(attachment)) {
          const caption = attachment.useCaption ? message : '';
          if (!await this.sendAttachmentBatch([attachment], caption)) return false;
        } else if (!await this.sendDocumentBatch([attachment], attachment.useCaption ? message : '')) {
          return false;
        }
        // A prévia pode desaparecer antes de o WhatsApp reconstruir totalmente
        // o compositor; aguarde antes de iniciar o próximo seletor oculto.
        await this.delay(700);
      }
    }

    return true;
    } finally {
      if (attachments.length) this.hideSendMask();
    }
  },

  getCurrentChatName() {
    const mainArea = document.getElementById('main');
    if (!mainArea) return "";
    const header = mainArea.querySelector('header');
    if (!header) return "";

    const selectors = [
      '[data-testid="conversation-info-header-chat-title"][title]',
      '[data-testid="conversation-info-header-chat-title"] span[title]',
      '[data-testid="conversation-info-header-chat-title"]',
      '[data-testid="conversation-info-header-chat-title"] span[dir="auto"]',
      '[role="button"] span[dir="auto"]',
      'span[dir="auto"]',
      '[role="button"] span[dir="auto"][title]',
      'span[dir="auto"][title]',
      'span[title]'
    ];
    for (const selector of selectors) {
      const titleSpan = Array.from(header.querySelectorAll(selector)).find(element => {
        const title = (element.getAttribute('title') || element.textContent || '').replace(/\s+/g, ' ').trim();
        if (!title || element.offsetParent === null) return false;
        return !/^(adicionar à lista|add to list|chamada|ligação|video call|voice call|pesquisar|search|menu|mais opções|more options|online|digitando.*|typing.*|visto por último.*|last seen.*)$/i.test(title);
      });
      if (titleSpan) {
        return (titleSpan.getAttribute('title') || titleSpan.textContent || '').replace(/\s+/g, ' ').trim();
      }
    }
    return "";
  },

  async insertMessage(text) {
    const input = await this.waitForMessageInput();
    if (!input) {
      window.IS.error("Campo de mensagem não encontrado. Abra uma conversa primeiro!");
      return false;
    }

    const success = await this.insertTextIntoInput(input, text);

    if (!success) {
      window.IS.error("O WhatsApp não aceitou a inserção da mensagem.");
    }

    return success;
  },
  
  deleteTextBeforeCursor(charsToDelete) {
    const input = this.findMessageInput();
    if (!input) return false;
    
    input.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;
    
    // Tenta apagar usando o comando nativo delete para manter o React State do Lexical atualizado
    for (let i = 0; i < charsToDelete; i++) {
      document.execCommand('delete', false, null);
    }
    
    return true;
  }
};
