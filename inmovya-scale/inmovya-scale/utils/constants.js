// utils/constants.js
window.IS = window.IS || {};

window.IS.DEBUG = true;

window.IS.DEFAULT_SETTINGS = {
  shortcutsEnabled: true,
  shortcutTrigger: "Space", // Space, Enter, Tab
  autoOpenPanel: true,
  theme: "auto",
  favoritesFirst: true,
  panelWidth: 340,
  userName: "Usuário"
};

window.IS.DEFAULT_CATEGORY = {
  id: "default-category",
  name: "Sem categoria"
};

window.IS.LOGGER_PREFIX = "[Inmovya Scale]";

window.IS.log = function(...args) {
  if (window.IS.DEBUG) {
    console.log(window.IS.LOGGER_PREFIX, ...args);
  }
};

window.IS.error = function(...args) {
  console.error(window.IS.LOGGER_PREFIX, ...args);
};
