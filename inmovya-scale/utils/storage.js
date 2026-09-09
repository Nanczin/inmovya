// utils/storage.js
window.IS = window.IS || {};

window.IS.Storage = {
  backupKeys: [
    'replies',
    'categories',
    'settings',
    'waLabels',
    'leadCategoryAssignments',
    'leadStageAssignments',
    'hiddenKanbanLeads'
  ],

  async getReplies() {
    const data = await chrome.storage.local.get('replies');
    return data.replies || [];
  },

  async saveReplies(replies) {
    await chrome.storage.local.set({ replies });
  },

  async getCategories() {
    const data = await chrome.storage.local.get('categories');
    return Array.isArray(data.categories) ? data.categories : [];
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
    const data = await chrome.storage.local.get(this.backupKeys);
    const date = new Date().toISOString().split('T')[0];
    window.IS.downloadJSON({
      backupVersion: 2,
      application: 'Inmovya Scale',
      exportedAt: new Date().toISOString(),
      data
    }, `inmovya-scale-backup-${date}.json`);
  },
  
  async importData(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') throw new Error("JSON inválido");
    const source = jsonData.backupVersion && jsonData.data && typeof jsonData.data === 'object'
      ? jsonData.data
      : jsonData;
    const updates = {};
    if (Array.isArray(source.replies)) updates.replies = source.replies;
    if (Array.isArray(source.categories)) updates.categories = source.categories;
    if (source.settings && typeof source.settings === 'object' && !Array.isArray(source.settings)) updates.settings = source.settings;
    if (Array.isArray(source.waLabels)) updates.waLabels = source.waLabels;
    if (source.leadCategoryAssignments && typeof source.leadCategoryAssignments === 'object' && !Array.isArray(source.leadCategoryAssignments)) {
      updates.leadCategoryAssignments = source.leadCategoryAssignments;
    }
    if (source.leadStageAssignments && typeof source.leadStageAssignments === 'object' && !Array.isArray(source.leadStageAssignments)) {
      updates.leadStageAssignments = source.leadStageAssignments;
    }
    if (Array.isArray(source.hiddenKanbanLeads)) updates.hiddenKanbanLeads = source.hiddenKanbanLeads;
    if (!Object.keys(updates).length) throw new Error('O arquivo não contém dados válidos da Inmovya Scale.');
    await chrome.storage.local.set(updates);
  },

  async createAutomaticBackup(force = false) {
    const stored = await chrome.storage.local.get('automaticBackups');
    const backups = Array.isArray(stored.automaticBackups) ? stored.automaticBackups : [];
    const latestTime = backups.length ? Date.parse(backups[backups.length - 1].createdAt || '') : 0;
    const oneDay = 24 * 60 * 60 * 1000;
    if (!force && latestTime && Date.now() - latestTime < oneDay) return false;

    const data = await chrome.storage.local.get(this.backupKeys);
    backups.push({ createdAt: new Date().toISOString(), data });
    await chrome.storage.local.set({ automaticBackups: backups.slice(-5) });
    return true;
  },

  async restoreLatestAutomaticBackup() {
    const stored = await chrome.storage.local.get('automaticBackups');
    const backups = Array.isArray(stored.automaticBackups) ? stored.automaticBackups : [];
    const latest = backups[backups.length - 1];
    if (!latest || !latest.data) return false;
    await this.createAutomaticBackup(true);
    await this.importData(latest.data);
    return true;
  }
};
