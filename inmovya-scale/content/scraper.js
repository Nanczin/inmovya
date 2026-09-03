// content/scraper.js
window.IS = window.IS || {};

window.IS.Scraper = {
  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  },

  async clickMenu() {
    const selectors = [
      'header div[title="Mais opções"]',
      'header div[aria-label="Mais opções"]',
      'header div[title="Menu"]',
      'header div[aria-label="Menu"]',
      'header div[title="More options"]',
      'header span[data-icon="menu"]',
      'div[id="side"] span[data-icon="menu"]'
    ];
    for (let sel of selectors) {
      const element = document.querySelector(sel);
      if (element) {
        const btn = element.closest('div[role="button"]') || element.closest('button') || element;
        if (btn) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  },

  async clickEtiquetas() {
    const sidebarIcon = document.querySelector('div[aria-label="Etiquetas"], div[title="Etiquetas"], span[data-icon="label"]');
    if (sidebarIcon && sidebarIcon.closest('header, nav, #side, #app')) {
      const btn = sidebarIcon.closest('div[role="button"]') || sidebarIcon.closest('button');
      if (btn) {
        btn.click();
        return true;
      }
    }

    const uls = document.querySelectorAll('ul');
    for (let ul of uls) {
      const items = ul.querySelectorAll('li, div[role="button"]');
      for (let item of items) {
        const text = item.textContent.toLowerCase();
        if (text.includes('etiqueta') || text.includes('label')) {
          item.click();
          return true;
        }
      }
    }
    return false;
  },
  
  async getLabelsList() {
    const labelRows = document.querySelectorAll('div[aria-label="Etiquetas"] div[role="button"]');
    if (labelRows && labelRows.length > 0) return Array.from(labelRows);
    
    const labelIcons = document.querySelectorAll('span[data-icon="label"]');
    const rows = [];
    if (labelIcons && labelIcons.length > 0) {
      for (let i = 0; i < labelIcons.length; i++) {
        const btn = labelIcons[i].closest('div[role="button"]') || labelIcons[i].closest('button');
        if (btn) rows.push(btn);
      }
    }
    return rows;
  },
  
  async clickBack() {
    const backBtn = document.querySelector('span[data-icon="back"]');
    if (backBtn) {
      const btn = backBtn.closest('button') || backBtn.closest('div[role="button"]');
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  },
  
  async scrapeContactsInView() {
    const contacts = [];
    const chatRows = document.querySelectorAll('div[aria-label="Lista de chats"] div[role="listitem"]');
    for (const row of chatRows) {
      const titleSpan = row.querySelector('span[title]');
      if (titleSpan) {
        contacts.push({ name: titleSpan.title });
      }
    }
    return contacts;
  },
  
  async run() {
    window.IS.log("Iniciando scraper de etiquetas...");
    const results = [];
    
    try {
      let labels = await this.getLabelsList();
      
      if (labels.length === 0) {
        if (!await this.clickEtiquetas()) {
          if (await this.clickMenu()) {
            await this.delay(1000);
            await this.clickEtiquetas();
          }
        }
        await this.delay(2000);
        labels = await this.getLabelsList();
      }

      if (labels.length === 0) {
         throw new Error("Não encontrei suas etiquetas. Por favor, ABRA O MENU DE ETIQUETAS no seu WhatsApp manualmente, e depois clique em Sincronizar na extensão!");
      }
      
      let labelsCount = labels.length;
      window.IS.log(`Encontradas ${labelsCount} etiquetas`);
      
      for (let i = 0; i < labelsCount; i++) {
        labels = await this.getLabelsList(); 
        if (i >= labels.length) break;
        
        const row = labels[i];
        if (!row) continue;
        
        const nameNode = row.querySelector('span[title]');
        const labelName = nameNode ? nameNode.title : `Etiqueta ${i+1}`;
        
        row.click();
        await this.delay(2500); 
        
        const pane = document.querySelector('div[aria-label="Lista de chats"]');
        if (pane) {
          for (let s = 0; s < 4; s++) {
            pane.scrollTop = pane.scrollHeight;
            await this.delay(1500);
          }
        }
        
        const contacts = await this.scrapeContactsInView();
        const uniqueContacts = Array.from(new Set(contacts.map(c => c.name))).map(name => ({name}));
        
        results.push({ id: window.IS.generateUUID(), name: labelName, contacts: uniqueContacts });
        
        await this.clickBack();
        await this.delay(1500);
      }
      
      await this.clickBack();
      window.IS.log("Scraping finalizado", results);
      return results;
      
    } catch(err) {
      window.IS.error("Falha no scraper", err);
      return { error: err.message };
    }
  }
};
