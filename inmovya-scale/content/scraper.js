// content/scraper.js
window.IS = window.IS || {};

window.IS.Scraper = {
  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  },

    async clickMenu() {
    // Array of possible selectors for the 3-dots menu in the left pane header
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
        // If it's the span, find the parent button
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
    // Tenta achar o atalho direto na barra lateral (novo layout do WA)
    const sidebarIcon = document.querySelector('div[aria-label="Etiquetas"], div[title="Etiquetas"], span[data-icon="label"]');
    if (sidebarIcon && sidebarIcon.closest('header, nav, #side, #app')) {
      const btn = sidebarIcon.closest('div[role="button"]') || sidebarIcon.closest('button');
      if (btn) {
        btn.click();
        return true;
      }
    }

    // Procura por qualquer item de menu (ul li) que contenha o texto "etiqueta"
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
    // Procura no painel esquerdo pelas etiquetas
    const labelRows = document.querySelectorAll('div[aria-label="Etiquetas"] div[role="button"]');
    if (!labelRows || labelRows.length === 0) {
      // Fallback selector
      return document.querySelectorAll('span[data-icon="label"]').length > 0 ? document.querySelectorAll('span[data-icon="label"]') : [];
    }
    return labelRows;
  },
  
  async clickBack() {
    const backBtn = document.querySelector('span[data-icon="back"]');
    if (backBtn) {
      const btn = backBtn.closest('button');
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  },
  
  async scrapeContactsInView() {
    // Extrai os contatos carregados na view atual
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
      let menuOpened = false;
      // Tenta clicar direto em etiquetas (Novo layout tem icone na barra lateral)
      if (!await this.clickEtiquetas()) {
        // Se falhar, tenta abrir o menu de 3 pontinhos primeiro
        if (!await this.clickMenu()) {
          throw new Error("Botão de menu não encontrado. Tente abrir o painel esquerdo manualmente.");
        }
        await this.delay(1000);
        if (!await this.clickEtiquetas()) {
          throw new Error("Opção 'Etiquetas' não encontrada. Verifique se o seu WhatsApp Business.");
        }
      }
      await this.delay(2000); // Aguarda painel abrir
      
      let labelNodes = await this.getLabelsList();
      let labelsCount = labelNodes.length;
      
      window.IS.log(`Encontradas ${labelsCount} etiquetas`);
      
      for (let i = 0; i < labelsCount; i++) {
        // Recalcular nodes porque o DOM muda ao voltar da tela
        labelNodes = await this.getLabelsList();
        if (i >= labelNodes.length) break;
        
        const row = labelNodes[i].closest('div[role="button"]');
        if (!row) continue;
        
        const nameNode = row.querySelector('span[title]');
        const labelName = nameNode ? nameNode.title : `Etiqueta ${i+1}`;
        
        // Clica na etiqueta
        row.click();
        await this.delay(2000); // Aguarda abrir lista de contatos
        
        // Fazer scroll até o final (simples por enquanto)
        const pane = document.querySelector('div[aria-label="Lista de chats"]');
        if (pane) {
          // Scroll simples 3 vezes
          for (let s = 0; s < 3; s++) {
            pane.scrollTop = pane.scrollHeight;
            await this.delay(1000);
          }
        }
        
        const contacts = await this.scrapeContactsInView();
        
        // Remove duplicados pelo nome
        const uniqueContacts = Array.from(new Set(contacts.map(c => c.name))).map(name => ({name}));
        
        results.push({ id: window.IS.generateUUID(), name: labelName, contacts: uniqueContacts });
        
        // Voltar para a lista de etiquetas
        await this.clickBack();
        await this.delay(1000);
      }
      
      // Fechar painel de etiquetas para voltar ao inicio
      await this.clickBack();
      window.IS.log("Scraping finalizado", results);
      return results;
      
    } catch(err) {
      window.IS.error("Falha no scraper", err);
      return { error: err.message };
    }
  }
};







