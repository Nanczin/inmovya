// content/wa-labels.js
// Coloca/tira etiquetas (WhatsApp Business) na conversa aberta.
// O Inmovya manda quais etiquetas o lead deve ter (ex.: ["50%"]) e quais são
// "gerenciadas" pelo funil (20%, 50%, 75%, Fechado, Lead...). As gerenciadas que
// não estão na lista são desmarcadas; as outras etiquetas do contato ficam como estão.
window.IS = window.IS || {};

window.IS.WhatsAppLabels = {
  norm(value) {
    return String(value || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  },

  visible(el) {
    return !!el && el.offsetParent !== null && !el.closest('#inmovya-scale-root');
  },

  // Menus do WhatsApp reagem a eventos de ponteiro, não só ao click()
  press(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  },

  async waitFor(fn, timeoutMs = 4000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const found = fn();
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return null;
  },

  findChatMenuButton() {
    const header = document.querySelector('#main header');
    if (!header) return null;
    const buttons = Array.from(header.querySelectorAll('button, div[role="button"], [data-icon]'))
      .map(el => el.closest('button, div[role="button"]') || el)
      .filter(el => this.visible(el));
    return buttons.find(el => {
      const text = this.norm(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`);
      const icons = Array.from(el.querySelectorAll('[data-icon]')).map(i => i.getAttribute('data-icon')).join(' ');
      return /mais opcoes|more options|menu/.test(text) || /\b(menu|more|kebab)/.test(icons);
    }) || buttons[buttons.length - 1] || null;
  },

  findMenuItem(pattern) {
    const items = document.querySelectorAll('[role="application"] li, [role="menu"] [role="menuitem"], [role="menu"] li, [data-animate-dropdown-menu] li, [data-animate-dropdown-menu] [role="button"]');
    for (const item of items) {
      if (!this.visible(item)) continue;
      const text = this.norm(item.getAttribute('aria-label') || item.innerText || item.textContent);
      if (pattern.test(text)) return item;
    }
    return null;
  },

  findLabelDialog() {
    const dialogs = document.querySelectorAll('[role="dialog"], [data-animate-modal-popup], [data-animate-modal-body]');
    for (const dialog of dialogs) {
      if (!this.visible(dialog)) continue;
      const text = this.norm(dialog.innerText);
      if (/etiquet|label/.test(text) && dialog.querySelector('[role="checkbox"], input[type="checkbox"], [aria-checked]')) return dialog;
    }
    return null;
  },

  // Linhas do diálogo: cada uma tem um nome de etiqueta e um checkbox
  labelRows(dialog) {
    const rows = [];
    const boxes = dialog.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
    boxes.forEach(box => {
      let row = box;
      for (let level = 0; row && level < 6; level++, row = row.parentElement) {
        const name = String(row.innerText || '').split('\n').map(s => s.trim()).filter(Boolean)[0];
        if (name) {
          rows.push({ name, key: this.norm(name), box, row });
          return;
        }
      }
    });
    return rows;
  },

  isChecked(box) {
    if (box.matches('input[type="checkbox"]')) return box.checked;
    const own = box.getAttribute('aria-checked');
    if (own != null) return own === 'true';
    const inner = box.querySelector('[aria-checked]');
    return inner ? inner.getAttribute('aria-checked') === 'true' : false;
  },

  findSaveButton(dialog) {
    const buttons = dialog.querySelectorAll('button, div[role="button"]');
    for (const button of buttons) {
      if (!this.visible(button)) continue;
      const text = this.norm(`${button.getAttribute('aria-label') || ''} ${button.innerText || ''}`);
      if (/^(salvar|save|ok|concluir|done)$/.test(text) || /salvar|save/.test(text)) return button;
    }
    // ícone de confirmação (✓)
    const check = dialog.querySelector('[data-icon="checkmark"], [data-icon="checkmark-medium"], [data-icon*="check" i]');
    return check ? (check.closest('button, div[role="button"]') || check) : null;
  },

  closeDialog() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  },

  // ---------- Modo rápido: abre a conversa pela pesquisa da aba já aberta (sem recarregar) ----------
  digitsOf(value) {
    return String(value || '').replace(/\D/g, '');
  },

  // Linhas de resultado que são conversas/contatos (não trechos de mensagens)
  searchResultRows() {
    const S = window.IS.Scraper;
    const rows = S.getChatRows();
    const messagesHeader = Array.from(document.querySelectorAll('#pane-side div, #side div'))
      .find(el => el.childElementCount === 0 && /^(mensagens|messages)$/.test(this.norm(el.textContent)) && this.visible(el));
    if (!messagesHeader) return rows;
    const limit = messagesHeader.getBoundingClientRect().top;
    return rows.filter(row => row.getBoundingClientRect().top < limit);
  },

  rowMatchesPhone(row, phoneDigits) {
    const S = window.IS.Scraper;
    const tail = phoneDigits.slice(-8);
    const identity = this.digitsOf(S.getContactIdentity(row));
    if (identity.length >= 8 && identity.endsWith(tail)) return true;
    // contato não salvo: o título da conversa é o próprio número
    const titleDigits = this.digitsOf(S.getContactName(row));
    return titleDigits.length >= 8 && titleDigits.endsWith(tail);
  },

  async openChatByPhone(phone) {
    const S = window.IS.Scraper;
    const digits = this.digitsOf(phone);
    if (digits.length < 10) return false;
    const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
    for (const query of [national, digits]) {
      if (!await S.clearContactSearch()) return false;
      const input = S.findSearchInput();
      if (!input || !await S.setContactSearchQuery(input, query)) return false;
      let row = null;
      for (let attempt = 0; attempt < 12 && !row; attempt++) {
        await this.delay(250);
        const rows = this.searchResultRows();
        // número exato no identificador/título; senão, um único resultado de conversa
        row = rows.find(r => this.rowMatchesPhone(r, digits)) || (rows.length === 1 && attempt >= 3 ? rows[0] : null);
      }
      if (!row) continue;
      const contact = { name: S.getContactName(row), chatId: S.getContactIdentity(row) };
      if (await S.openChatRow(row, contact)) {
        await this.waitFor(() => document.querySelector('#main header'), 3000);
        return true;
      }
    }
    return false;
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /** Etiqueta vários leads na aba já aberta. Quem não for achado na pesquisa volta com notFound. */
  async applyBatch(items = []) {
    const results = [];
    for (const item of items) {
      try {
        if (!await this.openChatByPhone(item.phone)) {
          results.push({ id: item.id, ok: false, notFound: true, error: 'Conversa não encontrada na pesquisa.' });
          continue;
        }
        await this.apply(item.set || [], item.managed || []);
        results.push({ id: item.id, ok: true });
      } catch (error) {
        this.closeDialog();
        results.push({ id: item.id, ok: false, error: error.message || String(error) });
      }
      await this.delay(300);
    }
    await window.IS.Scraper.clearContactSearch().catch(() => {});
    return results;
  },

  /** wanted: etiquetas que o lead deve ter; managed: etiquetas controladas pelo Inmovya. */
  async apply(wanted = [], managed = []) {
    const wantedKeys = new Set(wanted.map(name => this.norm(name)).filter(Boolean));
    const managedKeys = new Set([...managed, ...wanted].map(name => this.norm(name)).filter(Boolean));
    if (!managedKeys.size) return { ok: true, changed: false };

    const menuButton = this.findChatMenuButton();
    if (!menuButton) throw new Error('Menu da conversa (⋮) não encontrado.');
    this.press(menuButton);
    const item = await this.waitFor(() => this.findMenuItem(/etiquetar|label chat|^etiquetas?$|^labels?$/), 3000);
    if (!item) {
      this.closeDialog();
      throw new Error('Opção "Etiquetar conversa" não encontrada (precisa do WhatsApp Business).');
    }
    this.press(item);
    const dialog = await this.waitFor(() => this.findLabelDialog(), 4000);
    if (!dialog) throw new Error('A janela de etiquetas do WhatsApp não abriu.');

    const rows = this.labelRows(dialog);
    const existing = new Set(rows.map(r => r.key));
    const missing = [...wantedKeys].filter(key => !existing.has(key));
    let changed = false;
    for (const row of rows) {
      if (!managedKeys.has(row.key)) continue;
      const shouldCheck = wantedKeys.has(row.key);
      if (this.isChecked(row.box) !== shouldCheck) {
        this.press(row.box);
        changed = true;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    if (!changed) {
      this.closeDialog();
    } else {
      const save = this.findSaveButton(dialog);
      if (!save) {
        this.closeDialog();
        throw new Error('Botão Salvar da janela de etiquetas não encontrado.');
      }
      this.press(save);
      await this.waitFor(() => !this.findLabelDialog(), 4000);
    }
    if (missing.length) {
      throw new Error(`Etiqueta não existe no WhatsApp: ${wanted.filter(name => missing.includes(this.norm(name))).join(', ')}. Crie no WhatsApp Business com esse nome.`);
    }
    return { ok: true, changed };
  }
};
