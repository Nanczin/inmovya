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
    const candidates = document.querySelectorAll('#main input[type="file"], input[type="file"]');
    for (let i = candidates.length - 1; i >= 0; i--) {
      const input = candidates[i];
      const accept = (input.getAttribute('accept') || '').toLowerCase();
      if (!input.closest('#inmovya-scale-root') && (accept.includes('image') || accept.includes('video'))) {
        return input;
      }
    }
    return null;
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

    let success = document.execCommand('insertText', false, text);
    if (!success) {
      const transfer = new DataTransfer();
      transfer.setData('text/plain', text);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    await this.delay(80);
    return success || (input.innerText || input.textContent || '').trim().length > 0;
  },

  async sendAttachmentBatch(attachments, caption = '') {
    try {
      let fileInput = await this.waitForMediaFileInput(800);
      if (!fileInput && this.openAttachmentMenu()) {
        fileInput = await this.waitForMediaFileInput(2500);
      }
      if (!fileInput) {
        window.IS.error('Seletor de anexos do WhatsApp não encontrado.');
        return false;
      }

      const transfer = new DataTransfer();
      attachments.forEach(attachment => transfer.items.add(this.dataUrlToFile(attachment)));
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      await this.delay(1800);
      if (caption) {
        const captionInput = this.findMediaCaptionInput();
        if (!captionInput || !await this.insertTextIntoInput(captionInput, caption)) {
          window.IS.error('Campo de legenda do WhatsApp não encontrado.');
          return false;
        }
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










