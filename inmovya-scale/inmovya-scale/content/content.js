// content/content.js
window.IS = window.IS || {};

window.IS.App = {
  async init() {
    window.IS.log("Iniciando Inmovya Scale...");
    
    // Initialize default storage data if missing
    await window.IS.Storage.initDefaults();
    
    // Read settings
    const settings = await window.IS.Storage.getSettings();
    
    // Initialize Sub-modules
    window.IS.Shortcuts.init(settings);
    await window.IS.Panel.init();
    window.IS.Observer.init();
    
    window.IS.log("Inmovya Scale carregado com sucesso!");
  }
};

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.IS.App.init());
} else {
  window.IS.App.init();
}
