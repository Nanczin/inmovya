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

  async handleKeyDown(e) {
    if (!this.active) return;

    // Check trigger key
    let triggered = false;
    if (this.triggerKey === "Space" && e.code === "Space") triggered = true;
    if (this.triggerKey === "Enter" && e.code === "Enter") triggered = true;
    if (this.triggerKey === "Tab" && e.code === "Tab") triggered = true;

    if (!triggered) return;

    const target = e.target;
    // Ensure target is a contenteditable
    if (!target || !target.isContentEditable) return;

    // We need to read the current word before the cursor
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return; // if text is selected, don't trigger

    const textContent = range.startContainer.textContent;
    const offset = range.startOffset;
    
    // Find the word before cursor
    const textBeforeCursor = textContent.slice(0, offset);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (!lastWord || !lastWord.startsWith('/')) return;

    const replies = await window.IS.Storage.getReplies();
    const normalizedShortcut = window.IS.removeAccents(lastWord.toLowerCase());
    
    const reply = replies.find(r => r.shortcut && window.IS.removeAccents(r.shortcut.toLowerCase()) === normalizedShortcut);

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

