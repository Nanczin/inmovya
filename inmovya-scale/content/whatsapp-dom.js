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

    async insertSequenceAndAttachments(text, attachments) {
    const b64toBlob = (b64Data, contentType='') => {
      const base64 = b64Data.split(',')[1] || b64Data;
      const byteCharacters = atob(base64);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      return new Blob(byteArrays, {type: contentType});
    };
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const parts = (text || "").split('===').map(s => s.trim()).filter(s => s.length > 0);
    const shouldAutoSend = parts.length > 1 || (attachments && attachments.length > 0);
    
    const triggerSend = async () => {
      // Tenta achar o botão de enviar por até 3 segundos
      for (let i = 0; i < 15; i++) {
        const sendIcons = document.querySelectorAll('span[data-icon="send"]');
        // Pega o último botão na tela (geralmente o do modal fica no fim do DOM)
        for (let j = sendIcons.length - 1; j >= 0; j--) {
          const icon = sendIcons[j];
          // Verifica se está visível
          if (icon.offsetParent !== null) {
            const btn = icon.closest('div[role="button"]') || icon.closest('button');
            if (btn) {
              btn.click();
              return true;
            }
          }
        }
        await delay(200);
      }
      
      // Fallback
      const input = this.findMessageInput();
      if (input) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    };

    // Text sequences
    for (let i = 0; i < parts.length; i++) {
      const inserted = await this.insertMessage(parts[i]);
      if (!inserted) return false;
      if (shouldAutoSend) {
        await delay(300);
        const sent = await triggerSend();
        if (!sent) return false;
        await delay(800);
      }
    }

    // Attachments
    if (attachments && attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        try {
                    const blob = b64toBlob(att.data, att.type);
          const file = new File([blob], att.name, { type: att.type });
          
          const input = await this.waitForMessageInput();
          if (!input) return false;

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          
          input.focus();
          input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }));
          
          await delay(2000); // Wait for image preview modal
          const sent = await triggerSend();
          if (!sent) return false;
          await delay(800);
        } catch(e) {
          window.IS.error("Erro ao colar anexo", e);
          return false;
        }
      }
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

    input.focus();
    input.click();

    // Coloca o cursor no final
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Mantém o estado interno do editor Lexical sincronizado com o DOM.
    let success = document.execCommand("insertText", false, text);
    
    // Se falhar, tenta o mÃ©todo de ClipboardEvent
    if (!success) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }));
    }
    
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text
    }));
    
    // Dispara keydown para forçar o aviso de 'digitando...'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', bubbles: true, cancelable: true, keyCode: 229 }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Process', bubbles: true, cancelable: true, keyCode: 229 }));
    
    await new Promise(resolve => setTimeout(resolve, 50));
    const insertedText = (input.innerText || input.textContent || '').trim();
    success = success || insertedText.length > 0;

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










