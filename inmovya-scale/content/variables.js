// content/variables.js
window.IS = window.IS || {};

window.IS.Variables = {
  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "bom dia";
    if (hour >= 12 && hour < 18) return "boa tarde";
    return "boa noite";
  },

  getDate() {
    return new Date().toLocaleDateString();
  },

  getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  async parseMessage(messageTemplate, contactName = "") {
    if (!messageTemplate) return "";
    
    const settings = await window.IS.Storage.getSettings();
    const myName = settings.userName || "";
    
    let msg = messageTemplate;
    msg = msg.replace(/{{nome}}/gi, contactName);
    msg = msg.replace(/{{saudacao}}/gi, this.getGreeting());
    msg = msg.replace(/{{meu_nome}}/gi, myName);
    msg = msg.replace(/{{data}}/gi, this.getDate());
    msg = msg.replace(/{{hora}}/gi, this.getTime());
    
    return msg;
  }
};
