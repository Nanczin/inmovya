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

  async triggerMediaSend(captionInput = null) {
    const target = captionInput || this.findMediaCaptionInput() || document.activeElement;
    if (!target || target === document.body) return this.triggerSend(false);

    target.focus();
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

    document.execCommand('insertText', false, text);
    await this.delay(120);

    let insertedText = (input.innerText || input.textContent || '').trim();
    if (!insertedText) {
      const transfer = new DataTransfer();
      transfer.setData('text/plain', text);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
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

  async injectFilesIntoChat(files) {
    const messageInput = await this.waitForMessageInput();
    const chatArea = document.getElementById('main');
    if (!messageInput || !chatArea) return false;
    messageInput.focus();
    messageInput.click();
    const dropTransfer = new DataTransfer();
    files.forEach(file => dropTransfer.items.add(file));
    this.dispatchFileEvent(chatArea, 'dragenter', dropTransfer);
    this.dispatchFileEvent(chatArea, 'dragover', dropTransfer);
    this.dispatchFileEvent(chatArea, 'drop', dropTransfer);
    await this.delay(1200);
    if (this.findMediaCaptionInput()) return true;
    const pasteTransfer = new DataTransfer();
    files.forEach(file => pasteTransfer.items.add(file));
    messageInput.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pasteTransfer, bubbles: true, cancelable: true }));
    await this.delay(1200);
    return !!this.findMediaCaptionInput();
  },

  async sendAttachmentBatch(attachments, caption = '') {
    try {
      const files = await Promise.all(attachments.map(attachment => this.prepareMediaFile(attachment)));
      let fileInput = this.findMediaFileInput();
      const menuOpened = fileInput ? false : this.openAttachmentMenu();
      if (!fileInput && menuOpened) {
        await this.delay(600);
        fileInput = await this.waitForMediaFileInput(6000);
      }
      if (!fileInput) {
        if (!await this.injectFilesIntoChat(files)) {
          window.IS.error('O WhatsApp não aceitou os arquivos na conversa.');
          return false;
        }
      } else {
        const transfer = new DataTransfer();
        files.forEach(file => transfer.items.add(file));
        fileInput.files = transfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
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
      await this.delay(900);
      return true;
    } catch (error) {
      window.IS.error('Erro ao enviar anexos', error);
      return false;
    }
  },

  async sendDocumentBatch(attachments) {
    try {
      let fileInput = this.findDocumentFileInput();
      if (!fileInput && !this.openAttachmentMenu()) {
        window.IS.error('Botão de anexos do WhatsApp não encontrado.');
        return false;
      }
      if (!fileInput) {
        await this.delay(600);
        fileInput = await this.waitForDocumentFileInput(6000);
      }
      if (!fileInput) {
        window.IS.error('Campo de Documento do WhatsApp não encontrado.');
        return false;
      }

      const transfer = new DataTransfer();
      attachments.forEach(attachment => transfer.items.add(this.dataUrlToFile(attachment)));
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      await this.delay(1800);
      if (!await this.triggerMediaSend()) return false;
      await this.delay(900);
      return true;
    } catch (error) {
      window.IS.error('Erro ao enviar documentos', error);
      return false;
    }
  },

  async insertSequenceAndAttachments(text, attachments = []) {
    const parts = (text || '').split('===').map(part => part.trim()).filter(Boolean);
    if (!parts.length && attachments.length) parts.push('');

    try {
      attachments = await Promise.all(attachments.map(attachment => this.resolveNativeAttachment(attachment)));
    } catch (error) {
      window.IS.error('Erro ao ler arquivo original', error);
      return false;
    }

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
      const withCaption = linked.filter(attachment => attachment.useCaption && this.isMediaAttachment(attachment));
      const withoutCaption = linked.filter(attachment => !attachment.useCaption && this.isMediaAttachment(attachment));
      const documents = linked.filter(attachment => !this.isMediaAttachment(attachment));

      if (withCaption.length) {
        if (!await this.sendAttachmentBatch(withCaption, message)) return false;
      } else if (message) {
        if (!await this.insertMessage(message)) return false;
        const mustSendText = parts.length > 1 || normalizedAttachments.length > 0;
        if (mustSendText) {
          await this.delay(250);
          if (!await this.triggerSend()) return false;
          await this.delay(700);
        }
      }

      if (withoutCaption.length && !await this.sendAttachmentBatch(withoutCaption)) return false;
      if (documents.length && !await this.sendDocumentBatch(documents)) return false;
    }

    return true;
  },

  getCurrentChatName() {
    const mainArea = document.getElementById('main');
    if (!mainArea) return "";
    const header = mainArea.querySelector('header');
    if (!header) return "";

    const titleSpan = header.querySelector('span[title]');
    if (titleSpan && titleSpan.title) {
      return titleSpan.title.trim();
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
