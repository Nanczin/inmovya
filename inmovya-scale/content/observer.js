// content/observer.js
window.IS = window.IS || {};

window.IS.Observer = {
  observer: null,

  init() {
    this.startObserving();
  },

  startObserving() {
    if (this.observer) return;

    this.observer = new MutationObserver(window.IS.debounce(() => {
      // Check if our panel is still there
      if (!document.getElementById('inmovya-scale-root')) {
        window.IS.log("Root element missing, re-rendering panel.");
        window.IS.Panel.render();
      }
    }, 1000));

    this.observer.observe(document.body, { childList: true, subtree: false });
  },
  
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
};
