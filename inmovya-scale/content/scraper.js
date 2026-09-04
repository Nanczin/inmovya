// content/scraper.js
window.IS = window.IS || {};

window.IS.Scraper = {
  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  },

  isVisible(element) {
    return !!element && element.offsetParent !== null && !element.closest('#inmovya-scale-root');
  },

  getRowName(row) {
    const titleNode = row && row.querySelector('span[title], [title]');
    const rawName = titleNode
      ? titleNode.getAttribute('title')
      : row && (row.getAttribute('aria-label') || row.getAttribute('title') || row.textContent);
    return (rawName || '').replace(/\s+/g, ' ').trim();
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
    const selectors = [
      '[aria-label="Etiquetas" i]',
      '[title="Etiquetas" i]',
      '[aria-label="Labels" i]',
      '[title="Labels" i]',
      'span[data-icon*="label"]',
      'span[data-icon*="tag"]'
    ];
    const sidebarIcon = Array.from(document.querySelectorAll(selectors.join(','))).find(element => this.isVisible(element));
    if (sidebarIcon) {
      const btn = sidebarIcon.closest('div[role="button"]') || sidebarIcon.closest('button');
      if (btn) {
        btn.click();
        return true;
      }
    }

    const items = document.querySelectorAll('li, button, div[role="button"], [role="menuitem"]');
    for (const item of items) {
      const text = `${item.getAttribute('aria-label') || ''} ${item.getAttribute('title') || ''} ${item.textContent || ''}`.toLowerCase();
      if (this.isVisible(item) && (text.includes('etiqueta') || text.includes('label'))) {
        item.click();
        return true;
      }
    }
    return false;
  },
  
  async getLabelsList() {
    const rows = [];
    const addRow = (row) => {
      if (!row || !this.isVisible(row) || rows.includes(row)) return;
      const name = this.getRowName(row).toLowerCase();
      if (!name || /^(etiquetas?|labels?|voltar|back|nova etiqueta|new label)$/.test(name)) return;
      rows.push(row);
    };

    document.querySelectorAll('[data-testid*="label" i], [data-testid*="tag" i]').forEach(element => {
      addRow(element.closest('[role="listitem"], [role="button"], li') || element);
    });

    document.querySelectorAll('span[data-icon*="label"], span[data-icon*="tag"]').forEach(icon => {
      addRow(icon.closest('[role="listitem"], [role="button"], li'));
    });

    const labelsViewOpen = Array.from(document.querySelectorAll('header, [role="heading"], h1, h2, h3'))
      .some(element => this.isVisible(element) && /^(etiquetas|labels)$/i.test((element.textContent || '').trim()));

    if (labelsViewOpen) {
      const selectors = [
        '#side [role="listitem"]',
        '[aria-label*="etiqueta" i] [role="listitem"]',
        '[aria-label*="label" i] [role="listitem"]'
      ];
      document.querySelectorAll(selectors.join(',')).forEach(addRow);
    }

    return rows.filter(row => {
      return !rows.some(other => other !== row && row.contains(other));
    });
  },

  findScrollableParent(element) {
    let current = element && element.parentElement;
    while (current && current !== document.body) {
      if (current.scrollHeight > current.clientHeight + 20) return current;
      current = current.parentElement;
    }
    return null;
  },

  getChatRows() {
    const selectors = [
      'div[aria-label*="Lista de chats" i] [role="listitem"]',
      'div[aria-label*="Lista de conversas" i] [role="listitem"]',
      'div[aria-label*="Chat list" i] [role="listitem"]',
      '#pane-side [role="listitem"]',
      '#pane-side [role="row"]',
      '#pane-side [data-testid*="cell-frame" i]',
      '#side [role="listitem"]',
      '#side [role="row"]'
    ];
    const rows = [];
    document.querySelectorAll(selectors.join(',')).forEach(row => {
      if (this.isVisible(row) && row.querySelector('span[title]') && !rows.includes(row)) {
        rows.push(row);
      }
    });
    return rows;
  },

  getContactName(row) {
    const titleNode = row.querySelector('[data-testid="cell-frame-title"] span[title], span[dir="auto"][title], span[title]');
    return titleNode ? (titleNode.getAttribute('title') || '').trim() : '';
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
    const chatRows = this.getChatRows();
    for (const row of chatRows) {
      const name = this.getContactName(row);
      if (name) contacts.push({ name });
    }
    return contacts;
  },

  async scrapeAllContacts() {
    const names = new Set();
    const collectVisible = async () => {
      const contacts = await this.scrapeContactsInView();
      contacts.forEach(contact => names.add(contact.name));
    };

    let rows = this.getChatRows();
    const pane = this.findScrollableParent(rows[0]);
    if (!pane) {
      await collectVisible();
      return Array.from(names).map(name => ({ name }));
    }

    pane.scrollTop = 0;
    await this.delay(500);
    for (let step = 0; step < 30; step++) {
      await collectVisible();
      const previousTop = pane.scrollTop;
      const distance = Math.max(300, Math.floor(pane.clientHeight * 0.8));
      pane.scrollTop = Math.min(pane.scrollHeight, previousTop + distance);
      await this.delay(500);
      if (pane.scrollTop === previousTop) break;
    }
    await collectVisible();
    return Array.from(names).map(name => ({ name }));
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
        
        const labelName = this.getRowName(row) || `Etiqueta ${i+1}`;
        
        row.click();
        await this.delay(2500); 
        
        const uniqueContacts = await this.scrapeAllContacts();
        
        results.push({ id: window.IS.generateUUID(), name: labelName, contacts: uniqueContacts });
        
        await this.clickBack();
        await this.delay(1500);
      }
      
      // Cada item já retorna para a lista de etiquetas dentro do laço.
      // Não volte novamente aqui, pois isso fecha a tela de etiquetas.
      window.IS.log("Scraping finalizado", results);
      return results;
      
    } catch(err) {
      window.IS.error("Falha no scraper", err);
      return { error: err.message };
    }
  }
};
