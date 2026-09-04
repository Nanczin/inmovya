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

  findMediaFileInput() {
    const menuItems = document.querySelectorAll('[role="menuitem"], li, label, div[role="button"]');
    for (const item of menuItems) {
      if (item.offsetParent === null || item.closest('#inmovya-scale-root')) continue;
      const context = `${item.getAttribute('aria-label') || ''} ${item.getAttribute('title') || ''} ${item.textContent || ''}`.toLowerCase();
      if (!/fotos?.*v[ií]deos?|photos?.*videos?|photos? & videos?/.test(context)) continue;
      const input = item.querySelector('input[type="file"]');
      if (input) return input;
      if (item.tagName === 'LABEL' && item.htmlFor) {
        const linkedInput = document.getElementById(item.htmlFor);
        if (linkedInput && linkedInput.type === 'file') return linkedInput;
      }
    }

    const candidates = document.querySelectorAll('#main input[type="file"], input[type="file"]');
    const ranked = [];
    for (const input of candidates) {
      if (input.closest('#inmovya-scale-root')) continue;
      const accept = (input.getAttribute('accept') || '').toLowerCase();
      if (!accept.includes('image') && !accept.includes('video')) continue;

      let context = '';
      let current = input;
      for (let level = 0; current && level < 4; level++, current = current.parentElement) {
        context += ` ${current.getAttribute('aria-label') || ''} ${current.getAttribute('title') || ''}`;
      }
      context = context.toLowerCase();

      if (/figurinha|sticker/.test(context) || (accept.includes('webp') && !accept.includes('video'))) continue;

      let score = 0;
      if (/fotos?.*v[ií]deos?|photos?.*videos?|media/.test(context)) score += 100;
      if (accept.includes('video')) score += 40;
      if (input.multiple) score += 20;
      if (accept.includes('image')) score += 10;
      if (/c[aâ]mera|camera/.test(context)) score -= 50;
      ranked.push({ input, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.length ? ranked[0].input : null;
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

  openAttachmentMenu() {
    const selectors = [
      '#main footer span[data-icon="plus-rounded"]',
      '#main footer span[data-icon="plus"]',
      '#main footer span[data-icon="attach-menu-plus"]',
      '#main footer span[data-icon="clip"]'
    ];
    for (const selector of selectors) {
      const icon = document.querySelector(selector);
      const button = icon && icon.closest('button, div[role="button"]');
      if (button && button.offsetParent !== null) {
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

  async prepareMediaFile(attachment) {
    const file = this.dataUrlToFile(attachment);
    if (file.type.toLowerCase() !== 'image/webp') return file;

    const image = new Image();
    image.src = attachment.data;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Não foi possível converter a imagem WebP.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Não foi possível gerar a imagem PNG.');

    const pngName = (attachment.name || 'anexo.webp').replace(/\.webp$/i, '') + '.png';
    return new File([blob], pngName, { type: 'image/png' });
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

  async sendAttachmentBatch(attachments, caption = '') {
    try {
      this.openAttachmentMenu();
      await this.delay(300);
      const fileInput = await this.waitForMediaFileInput(3000);
      if (!fileInput) {
        window.IS.error('Campo de Fotos e vídeos do WhatsApp não encontrado.');
        return false;
      }

      const transfer = new DataTransfer();
      const files = await Promise.all(attachments.map(attachment => this.prepareMediaFile(attachment)));
      files.forEach(file => transfer.items.add(file));
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      await this.delay(1800);
      if (caption) {
        const captionInput = await this.waitForMediaCaptionInput();
        if (!captionInput || !await this.insertTextIntoInput(captionInput, caption)) {
          window.IS.error('Campo de legenda do WhatsApp não encontrado.');
          return false;
        }
        await this.delay(250);
      }

      if (!await this.triggerSend(false)) return false;
      await this.delay(900);
      return true;
    } catch (error) {
      window.IS.error('Erro ao enviar anexos', error);
      return false;
    }
  },

  async insertSequenceAndAttachments(text, attachments = []) {
    const parts = (text || '').split('===').map(part => part.trim()).filter(Boolean);
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
      const withCaption = linked.filter(attachment => attachment.useCaption);
      const withoutCaption = linked.filter(attachment => !attachment.useCaption);

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




