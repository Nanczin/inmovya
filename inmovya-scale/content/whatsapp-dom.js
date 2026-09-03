// content/whatsapp-dom.js
window.IS = window.IS || {};

window.IS.WhatsAppDOM = {
  findMessageInput() {
    // O WhatsApp usa divs contenteditable. O campo de digitaÃ§Ã£o fica no #main (a Ã¡rea de conversa)
    const mainArea = document.getElementById('main');
    if (mainArea) {
      const boxes = mainArea.querySelectorAll('div[contenteditable="true"]');
      // Pega o Ãºltimo contenteditable dentro do #main (evita pegar algo no cabeÃ§alho)
      if (boxes.length > 0) return boxes[boxes.length - 1];
    }
    
    // Fallback: Procura qualquer contenteditable visÃ­vel que nÃ£o seja a barra de pesquisa
    const allBoxes = document.querySelectorAll('div[contenteditable="true"]');
    for (let i = allBoxes.length - 1; i >= 0; i--) {
      const box = allBoxes[i];
      if (box.offsetParent !== null && !box.closest('#side')) {
        return box;
      }
    }
    return null;
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

  insertMessage(text) {
    const input = this.findMessageInput();
    if (!input) {
      window.IS.error("Campo de mensagem nÃ£o encontrado. Abra uma conversa primeiro!");
      return false;
    }

    input.focus();

    // Remove qualquer placeholder que o WhatsApp coloque simulando clique
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));

    // Coloca o cursor no final
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Tenta usar execCommand (ainda Ã© o mais suportado para disparar inputs no React/Lexical do WhatsApp)
    let success = document.execCommand("insertText", false, text);
    
    // Se falhar, tenta o mÃ©todo de ClipboardEvent
    if (!success) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }));
    }
    
    // Dispara evento de input manualmente para forÃ§ar o React a acordar o botÃ£o de Enviar
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    
    // Dispara keydown para forçar o aviso de 'digitando...'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', bubbles: true, cancelable: true, keyCode: 229 }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Process', bubbles: true, cancelable: true, keyCode: 229 }));
    
    return true;
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

