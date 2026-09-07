// content/shortcuts.js
window.IS = window.IS || {};

window.IS.Shortcuts = {
  active: false,
  triggerKey: "Space",

  init(settings) {
    this.updateSettings(settings);
    this.attachListener();
  },

  updateSettings(settings) {
    this.active = settings.shortcutsEnabled;
    this.triggerKey = settings.shortcutTrigger || "Space";
  },

  attachListener() {
    // We attach keydown to document because the contenteditable might be destroyed/recreated.
    // Event delegation is safer for SPAs.
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
  },

  normalizeShortcut(value) {
    return window.IS.removeAccents(String(value || '').trim().replace(/^\/+/, '').toLowerCase());
  },

  getTextBeforeCursor(input, range) {
    try {
      const beforeCursor = document.createRange();
      beforeCursor.selectNodeContents(input);
      beforeCursor.setEnd(range.startContainer, range.startOffset);
      return beforeCursor.toString();
    } catch (_error) {
      return '';
    }
  },

  async handleKeyDown(e) {
    if (!this.active) return;

    // Check trigger key
    let triggered = false;
    if (this.triggerKey === "Space" && e.code === "Space") triggered = true;
    if (this.triggerKey === "Enter" && e.code === "Enter") triggered = true;
    if (this.triggerKey === "Tab" && e.code === "Tab") triggered = true;

    if (!triggered) return;

    const target = e.target;
    const input = window.IS.WhatsAppDOM.findMessageInput();
    if (!input || !target || (target !== input && !input.contains(target))) return;

    // We need to read the current word before the cursor
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return; // if text is selected, don't trigger

    const textBeforeCursor = this.getTextBeforeCursor(input, range);
    const lastWord = textBeforeCursor.match(/\/[^\s/]+$/)?.[0] || '';

    if (!lastWord || !lastWord.startsWith('/')) return;

    const replies = await window.IS.Storage.getReplies();
    const normalizedShortcut = this.normalizeShortcut(lastWord);
    
    const reply = replies.find(r => r.shortcut && this.normalizeShortcut(r.shortcut) === normalizedShortcut);

    if (reply) {
      // Prevent default action (typing Space/Enter/Tab)
      e.preventDefault();
      e.stopPropagation();

      // Delete shortcut word
      window.IS.WhatsAppDOM.deleteTextBeforeCursor(lastWord.length);

      // Insert full text
      const contactName = window.IS.WhatsAppDOM.getCurrentChatName();
      const finalMessage = await window.IS.Variables.parseMessage(reply.message, contactName);
      
      await window.IS.WhatsAppDOM.insertSequenceAndAttachments(finalMessage, reply.attachments);
      
      // Update usage
      reply.usageCount = (reply.usageCount || 0) + 1;
      reply.lastUsedAt = new Date().toISOString();
      await window.IS.Storage.saveReplies(replies);
    }
  }
};
