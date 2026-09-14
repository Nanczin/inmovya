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

  getFirstName(contactName = "") {
    const normalizedName = String(contactName || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!normalizedName) return '';
    const firstName = normalizedName
      .split(' ')
      .map(part => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, ''))
      .find(part => /\p{L}/u.test(part));
    return firstName || normalizedName.split(' ')[0];
  },

  async parseMessage(messageTemplate, contactName = "") {
    if (!messageTemplate) return "";
    
    const settings = await window.IS.Storage.getSettings();
    const myName = settings.userName || "";
    
    let msg = messageTemplate;
    msg = msg.replace(/{{\s*nome\s*}}/gi, this.getFirstName(contactName));
    msg = msg.replace(/{{\s*saudacao\s*}}/gi, this.getGreeting());
    msg = msg.replace(/{{\s*meu_nome\s*}}/gi, myName);
    msg = msg.replace(/{{\s*data\s*}}/gi, this.getDate());
    msg = msg.replace(/{{\s*hora\s*}}/gi, this.getTime());
    
    return msg;
  }
};
