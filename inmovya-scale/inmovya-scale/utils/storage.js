// utils/storage.js
window.IS = window.IS || {};

window.IS.Storage = {
  async getReplies() {
    const data = await chrome.storage.local.get('replies');
    return data.replies || [];
  },

  async saveReplies(replies) {
    await chrome.storage.local.set({ replies });
  },

  async getCategories() {
    const data = await chrome.storage.local.get('categories');
    return data.categories || [];
  },

  async saveCategories(categories) {
    await chrome.storage.local.set({ categories });
  },

  async getSettings() {
    const data = await chrome.storage.local.get('settings');
    return { ...window.IS.DEFAULT_SETTINGS, ...(data.settings || {}) };
  },

  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  },
  
  async initDefaults() {
    const settings = await this.getSettings();
    const categories = await this.getCategories();
    
    // Save defaults if empty
    await this.saveSettings(settings);
    
    if (categories.length === 0) {
      await this.saveCategories([{
        id: window.IS.generateUUID(),
        name: "Prospecção",
        createdAt: new Date().toISOString()
      }]);
    }
  },
  
  async exportData() {
    const data = await chrome.storage.local.get(['replies', 'categories', 'settings']);
    const date = new Date().toISOString().split('T')[0];
    window.IS.downloadJSON(data, `inmovya-scale-backup-${date}.json`);
  },
  
  async importData(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') throw new Error("JSON inválido");
    
    const updates = {};
    if (Array.isArray(jsonData.replies)) updates.replies = jsonData.replies;
    if (Array.isArray(jsonData.categories)) updates.categories = jsonData.categories;
    if (jsonData.settings && typeof jsonData.settings === 'object') updates.settings = jsonData.settings;
    
    await chrome.storage.local.set(updates);
  }
};
