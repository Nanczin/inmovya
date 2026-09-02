// content/whatsapp-dom.js
window.IS = window.IS || {};

window.IS.WhatsAppDOM = {
  findMessageInput() {
    // Look for footer which contains the message input
    const footer = document.querySelector('footer');
    if (footer) {
      const input = footer.querySelector('div[contenteditable="true"]');
      if (input) return input;
    }
    
    // Fallback: aria-label="Digite uma mensagem" or similar (may vary by language)
    const fallback = document.querySelector('div[contenteditable="true"][data-tab="10"]');
    if (fallback) return fallback;
    
    return null;
  },

  getCurrentChatName() {
    const header = document.querySelector('header');
    if (!header) return "";

    // The contact name is usually inside a span with the title attribute in the header
    const titleSpan = header.querySelector('span[title]');
    if (titleSpan && titleSpan.title) {
      return titleSpan.title.trim();
    }
    
    return "";
  },

  insertMessage(text) {
    const input = this.findMessageInput();
    if (!input) {
      window.IS.error("Não foi possível localizar o campo de mensagem.");
      return false;
    }

    input.focus();

    // Move cursor to end
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Insert text safely mimicking user input
    // execCommand is deprecated but it is still the only reliable way to insert text 
    // into a contenteditable and properly trigger React's synthetic events in WhatsApp Web.
    const success = document.execCommand("insertText", false, text);
    
    if (!success) {
      // Fallback for modern browsers if execCommand fails
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });
      input.dispatchEvent(pasteEvent);
    }
    
    return true;
  },
  
  deleteTextBeforeCursor(charsToDelete) {
    const input = this.findMessageInput();
    if (!input) return false;
    
    input.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;
    
    const range = selection.getRangeAt(0);
    // Delete chars by modifying the range
    let startOffset = range.startOffset - charsToDelete;
    if (startOffset < 0) startOffset = 0;
    
    range.setStart(range.startContainer, startOffset);
    range.deleteContents();
    return true;
  }
};
