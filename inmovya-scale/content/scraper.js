// content/scraper.js
window.IS = window.IS || {};

window.IS.Scraper = {
  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  },

  isVisible(element) {
    return !!element && element.offsetParent !== null && !element.closest('#inmovya-scale-root');
  },

  isInteractable(element) {
    if (!this.isVisible(element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + Math.min(rect.width / 2, 120)));
    const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    const topElement = document.elementFromPoint(x, y);
    return !!topElement && (element.contains(topElement) || topElement.contains(element));
  },

  getRowName(row) {
    const rawName = row && (row.innerText || row.getAttribute('aria-label') || row.getAttribute('title') || '');
    return (rawName || '')
      .replace(/^[🏷️\s]+/u, '')
      .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  normalizeText(value) {
    return window.IS.removeAccents(String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase());
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
      '[aria-label="Listas" i]',
      '[title="Listas" i]',
      '[aria-label="Lists" i]',
      '[title="Lists" i]',
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

  getLabelsMenuRoot() {
    const actionPattern = /^(nova lista|new list|gerenciar listas|manage lists)$/i;
    const actions = Array.from(document.querySelectorAll('li, button, [role="menuitem"], [role="button"]'));
    const action = actions.find(element => {
      const text = (element.innerText || '').replace(/\s+/g, ' ').trim();
      return this.isInteractable(element) && actionPattern.test(text);
    });
    if (!action) return null;

    const semanticRoot = action.closest('[role="menu"], [role="dialog"], [data-animate-dropdown-menu], [data-animate-modal-popup]');
    if (semanticRoot) return semanticRoot;
    let root = action.parentElement;
    for (let level = 0; root && level < 4; level++, root = root.parentElement) {
      const actionableCount = root.querySelectorAll('li, button, [role="menuitem"], [role="button"]').length;
      if (actionableCount >= 3) return root;
    }
    return action.parentElement;
  },

  async getLabelsList() {
    const root = this.getLabelsMenuRoot();
    if (!root) return [];
    const excluded = /^(listas?|lists?|etiquetas?|labels?|nova lista|new list|gerenciar listas|manage lists)$/i;
    const candidates = Array.from(root.querySelectorAll('li, button, [role="menuitem"], [role="button"]'))
      .filter(row => {
        if (!this.isInteractable(row)) return false;
        const name = this.getRowName(row);
        if (!name || name.length > 80 || excluded.test(name)) return false;
        return !Array.from(row.querySelectorAll('li, button, [role="menuitem"], [role="button"]'))
          .some(child => child !== row && this.isInteractable(child) && this.getRowName(child));
      });
    return candidates.filter((row, index) => {
      const name = this.normalizeText(this.getRowName(row));
      return candidates.findIndex(candidate => this.normalizeText(this.getRowName(candidate)) === name) === index;
    });
  },

  async ensureLabelsMenuOpen(returnFromLabel = false) {
    let labels = await this.getLabelsList();
    if (labels.length > 0) return labels;

    if (returnFromLabel) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!await this.clickBack()) break;
        await this.delay(700);
        labels = await this.getLabelsList();
        if (labels.length > 0) return labels;
      }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      if (await this.clickEtiquetas()) {
        await this.delay(1000);
      } else if (await this.clickMenu()) {
        await this.delay(600);
        await this.clickEtiquetas();
        await this.delay(1000);
      }
      labels = await this.getLabelsList();
      if (labels.length > 0) return labels;
      await this.delay(400);
    }

    return [];
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
      if (this.isInteractable(row) && row.querySelector('span[title]') && !rows.includes(row)) {
        rows.push(row);
      }
    });
    return rows;
  },

  getContactName(row) {
    const explicitTitle = row.querySelector('[data-testid="cell-frame-title"] [title], [data-testid="cell-frame-title"][title]');
    if (explicitTitle) return (explicitTitle.getAttribute('title') || explicitTitle.textContent || '').trim();

    const rowRect = row.getBoundingClientRect();
    const candidates = Array.from(row.querySelectorAll('span[dir="auto"][title], span[title]'))
      .filter(node => {
        if (!this.isVisible(node)) return false;
        if (node.closest('[data-testid*="last-msg" i], [data-testid*="message" i], [aria-label*="mensagem" i], [aria-label*="message" i]')) return false;
        const rect = node.getBoundingClientRect();
        return rect.top < rowRect.top + (rowRect.height * 0.55);
      })
      .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
    const titleNode = candidates[0];
    return titleNode ? (titleNode.getAttribute('title') || titleNode.textContent || '').trim() : '';
  },

  isSavedContactName(name) {
    const value = (name || '').replace(/\s+/g, ' ').trim();
    if (!value || value.length > 80) return false;
    if (/economize tempo|respostas r[aá]pidas|mensagens protegidas|criptografia/i.test(value)) return false;
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 7 && !/[a-zà-ÿ]/i.test(value)) return false;
    return /[a-zà-ÿ]/i.test(value);
  },

  clickRow(row) {
    if (!row) return false;
    const clickable = Array.from(row.querySelectorAll('button, [role="button"], [role="menuitem"], [tabindex]'))
      .filter(element => this.isInteractable(element))
      .sort((left, right) => left.getBoundingClientRect().width - right.getBoundingClientRect().width)[0] || row;
    clickable.click();
    return true;
  },

  isLabelViewActive(labelName, clickedRow = null) {
    const expected = this.normalizeText(labelName);
    const headings = document.querySelectorAll('#side header, #side [role="heading"], #side h1, #side h2, #side h3');
    const headingMatches = Array.from(headings).some(element => {
      if (!this.isInteractable(element)) return false;
      const text = this.normalizeText(element.getAttribute('title') || element.getAttribute('aria-label') || element.textContent);
      return text === expected || text.includes(expected);
    });
    if (headingMatches) return true;
    return !!clickedRow && !this.isInteractable(clickedRow) && !this.getLabelsMenuRoot();
  },

  async waitForLabelView(labelName, clickedRow = null, timeoutMs = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.isLabelViewActive(labelName, clickedRow)) return true;
      await this.delay(150);
    }
    return false;
  },

  getContactIdentity(row) {
    const identityNode = row.matches('[data-id], [data-chat-id]')
      ? row
      : row.querySelector('[data-id], [data-chat-id]');
    const candidate = identityNode
      ? (identityNode.getAttribute('data-chat-id') || identityNode.getAttribute('data-id') || '').trim()
      : '';
    return /(?:@c\.us|@s\.whatsapp\.net|@g\.us|^\+?\d{7,}$)/i.test(candidate) ? candidate : '';
  },

  findSearchInput() {
    const selectors = [
      '#side [contenteditable="true"][data-tab="3"]',
      '#side [contenteditable="true"][aria-placeholder*="pesquis" i]',
      '#side [contenteditable="true"][aria-placeholder*="search" i]',
      '#side input[placeholder*="pesquis" i]',
      '#side input[placeholder*="search" i]'
    ];
    return selectors.map(selector => document.querySelector(selector)).find(element => this.isInteractable(element)) || null;
  },

  async returnToChatList() {
    for (let attempt = 0; attempt < 4; attempt++) {
      const searchInput = this.findSearchInput();
      if (searchInput) return searchInput;
      if (!await this.clickBack()) break;
      await this.delay(500);
    }
    return this.findSearchInput();
  },

  async openContactBySearch(contact) {
    const searchInput = await this.returnToChatList();
    if (!searchInput) return false;

    searchInput.focus();
    if (searchInput.isContentEditable) {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, contact.name);
    } else {
      searchInput.value = contact.name;
      searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: contact.name }));
    }
    await this.delay(1200);

    const contactRow = await this.findContactRowWithScroll(contact);
    if (!contactRow) return false;
    contactRow.click();
    return true;
  },

  async findLabelRowByName(name) {
    const normalizedName = (name || '').toLocaleLowerCase();
    const labels = await this.getLabelsList();
    return labels.find(row => this.getRowName(row).toLocaleLowerCase() === normalizedName) || null;
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
      if (this.isSavedContactName(name)) contacts.push({ name, chatId: this.getContactIdentity(row) });
    }
    return contacts;
  },

  async scrapeAllContacts() {
    const contactsByName = new Map();
    const collectVisible = async () => {
      const contacts = await this.scrapeContactsInView();
      contacts.forEach(contact => {
        const key = contact.chatId || contact.name.toLocaleLowerCase();
        if (!contactsByName.has(key)) {
          contactsByName.set(key, {
            id: contact.chatId || window.IS.generateUUID(),
            chatId: contact.chatId || '',
            name: contact.name
          });
        }
      });
    };

    let rows = this.getChatRows();
    const pane = this.findScrollableParent(rows[0]);
    if (!pane) {
      await collectVisible();
      return Array.from(contactsByName.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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
    return Array.from(contactsByName.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },

  findContactRow(contact) {
    const expectedName = (contact && contact.name || '').trim().toLocaleLowerCase();
    const expectedId = (contact && contact.chatId || '').trim();
    return this.getChatRows().find(row => {
      const rowId = this.getContactIdentity(row);
      if (expectedId && rowId && rowId === expectedId) return true;
      return this.getContactName(row).trim().toLocaleLowerCase() === expectedName;
    }) || null;
  },

  async findContactRowWithScroll(contact) {
    let rows = this.getChatRows();
    const pane = this.findScrollableParent(rows[0]);
    if (!pane) return this.findContactRow(contact);

    pane.scrollTop = 0;
    await this.delay(350);
    for (let step = 0; step < 40; step++) {
      const row = this.findContactRow(contact);
      if (row) return row;
      const previousTop = pane.scrollTop;
      pane.scrollTop = Math.min(pane.scrollHeight, previousTop + Math.max(300, Math.floor(pane.clientHeight * 0.8)));
      await this.delay(350);
      if (pane.scrollTop === previousTop) break;
    }
    return this.findContactRow(contact);
  },

  async openContact(labelName, contact) {
    let labelRow = await this.findLabelRowByName(labelName);
    if (!labelRow) {
      if (!await this.clickEtiquetas() && await this.clickMenu()) {
        await this.delay(600);
        await this.clickEtiquetas();
      }
      await this.delay(1200);
      labelRow = await this.findLabelRowByName(labelName);
    }
    let opened = false;
    if (labelRow) {
      this.clickRow(labelRow);
      if (!await this.waitForLabelView(labelName, labelRow)) labelRow = null;
      await this.delay(500);
    }
    if (labelRow) {
      const contactRow = await this.findContactRowWithScroll(contact);
      if (contactRow) {
        contactRow.click();
        opened = true;
      }
    }
    if (!opened) opened = await this.openContactBySearch(contact);
    if (!opened) throw new Error(`O contato ${contact.name} não foi encontrado no WhatsApp.`);

    const expectedName = contact.name.trim().toLocaleLowerCase();
    for (let attempt = 0; attempt < 20; attempt++) {
      await this.delay(200);
      const currentName = window.IS.WhatsAppDOM.getCurrentChatName().trim().toLocaleLowerCase();
      if (currentName === expectedName) return true;
    }
    throw new Error(`A conversa de ${contact.name} não foi aberta.`);
  },
  
  async run() {
    window.IS.log("Iniciando scraper de etiquetas...");
    const results = [];
    
    try {
      let labels = await this.ensureLabelsMenuOpen();

      if (labels.length === 0) {
         throw new Error("Não encontrei suas etiquetas. Por favor, ABRA O MENU DE ETIQUETAS no seu WhatsApp manualmente, e depois clique em Sincronizar na extensão!");
      }
      
      const labelNames = Array.from(new Set(labels.map(row => this.getRowName(row)).filter(Boolean)));
      window.IS.log(`Encontradas ${labelNames.length} etiquetas`);
      
      for (let i = 0; i < labelNames.length; i++) {
        const labelName = labelNames[i];
        const currentLabels = await this.ensureLabelsMenuOpen(i > 0);
        const expectedLabelName = this.normalizeText(labelName);
        const row = currentLabels.find(candidate => this.normalizeText(this.getRowName(candidate)) === expectedLabelName) || null;
        if (!row) {
          window.IS.error(`A etiqueta ${labelName} não foi reencontrada para sincronização.`);
          results.push({ id: window.IS.generateUUID(), name: labelName, contacts: [] });
          continue;
        }

        window.IS.log(`Sincronizando etiqueta ${i + 1}/${labelNames.length}: ${labelName}`);
        this.clickRow(row);
        const labelViewOpened = await this.waitForLabelView(labelName, row);
        const uniqueContacts = labelViewOpened ? await this.scrapeAllContacts() : [];
        if (!labelViewOpened) window.IS.error(`A etiqueta ${labelName} não abriu; nenhuma conversa geral foi importada.`);
        
        results.push({ id: window.IS.generateUUID(), name: labelName, contacts: uniqueContacts });
        
        if (i === labelNames.length - 1 && labelViewOpened) await this.clickBack();
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
