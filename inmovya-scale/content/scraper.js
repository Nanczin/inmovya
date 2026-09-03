// content/scraper.js
window.IS = window.IS || {};

window.IS.Scraper = {
  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  },

  async clickMenu() {
    const menuBtn = document.querySelector('span[data-icon="menu"]');
    if (menuBtn) {
      const btn = menuBtn.closest('div[role="button"]') || menuBtn.closest('button');
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  },

  async clickEtiquetas() {
    // Procura no dropdown o item que tem o texto "Etiquetas"
    const dropdown = document.querySelector('div[role="application"] ul');
    if (!dropdown) return false;
    
    const items = dropdown.querySelectorAll('li');
    for (const item of items) {
      if (item.textContent.toLowerCase().includes('etiqueta')) {
        item.click();
        return true;
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
      if (!await this.clickMenu()) throw new Error("Botão de menu (3 pontos) não encontrado");
      await this.delay(1000);
      
      if (!await this.clickEtiquetas()) throw new Error("Opção 'Etiquetas' não encontrada. Você está usando o WhatsApp Business?");
      await this.delay(1500); // Aguarda painel abrir
      
      let labelNodes = document.querySelectorAll('span[data-icon="label"]');
      let labelsCount = labelNodes.length;
      
      window.IS.log(`Encontradas ${labelsCount} etiquetas`);
      
      for (let i = 0; i < labelsCount; i++) {
        // Recalcular nodes porque o DOM muda ao voltar da tela
        labelNodes = document.querySelectorAll('span[data-icon="label"]');
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
