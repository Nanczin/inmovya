window.IS = window.IS || {};

window.IS.SettingsUI = {
  initialized: false,
  waLabels: [],
  editingId: null,
  draftAttachments: [],

  get htmlTemplate() {
    return `<div id="is-native-settings-container" style="display:flex; flex-direction:column; height:100%; width:100%; background:var(--inmovya-background); color:var(--inmovya-text); overflow-y:auto; overflow-x:hidden;">
  <div class="is-header" style="flex-shrink:0;">
    <div class="is-brand">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
      <span>Configurações</span>
    </div>
    <button id="is-settings-close-btn" title="Voltar" style="background:transparent;border:none;cursor:pointer;color:var(--inmovya-text-secondary);">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  </div>
  
  <div style="display:flex; flex-wrap:wrap; background:var(--inmovya-surface); border-bottom:1px solid var(--inmovya-border);">
    <button class="is-set-tab active" data-tab="is-tab-replies">Respostas</button>
    <button class="is-set-tab" data-tab="is-tab-categories">Categorias</button>
    <button class="is-set-tab" data-tab="is-tab-crm">CRM</button>
    <button class="is-set-tab" data-tab="is-tab-config">Config</button>
    <button class="is-set-tab" data-tab="is-tab-backup">Backup</button>
  </div>

  <div id="is-settings-body" style="padding:15px; flex:1;">
    <!-- TAB: REPLIES -->
    <div id="is-tab-replies" class="is-tab-content" style="display:block;">
      <div style="display:flex; gap:10px; margin-bottom:15px;">
        <input type="text" id="is-set-search" placeholder="Buscar..." style="flex:1; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; font-family:inherit;">
        <button id="is-btn-new-reply" style="background:var(--inmovya-primary); color:white; border:none; padding:0 15px; border-radius:4px; cursor:pointer; font-weight:bold;">+ Nova</button>
      </div>
      <div id="is-set-replies-list" style="display:flex; flex-direction:column; gap:10px;"></div>
    </div>

    <!-- TAB: CATEGORIES -->
    <div id="is-tab-categories" class="is-tab-content" style="display:none;">
      <div style="display:flex; gap:10px; margin-bottom:15px;">
        <input type="text" id="is-new-cat-name" placeholder="Nova categoria..." style="flex:1; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px;">
        <button id="is-btn-add-cat" style="background:var(--inmovya-primary); color:white; border:none; padding:0 15px; border-radius:4px; cursor:pointer; font-weight:bold;">Adicionar</button>
      </div>
      <div id="is-set-categories-list" style="display:flex; flex-direction:column; gap:10px;"></div>
    </div>

    <!-- TAB: CRM -->
    <div id="is-tab-crm" class="is-tab-content" style="display:none; text-align:center;">
      <button id="is-btn-sync-labels" style="background:var(--inmovya-primary); color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer; font-weight:bold; margin-bottom:15px;">🔄 Sincronizar Etiquetas</button>
      <div style="font-size:12px; color:var(--inmovya-text-secondary); margin-bottom:15px;">Isso fará com que a extensão navegue no seu WhatsApp Business para capturar os contatos.</div>
      <div id="is-set-labels-list" style="text-align:left; display:flex; flex-direction:column; gap:10px;"></div>
    </div>

    <!-- TAB: CONFIG -->
    <div id="is-tab-config" class="is-tab-content" style="display:none; display:flex; flex-direction:column; gap:15px;">
      <div>
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Seu Nome (usado em {{meu_nome}})</label>
        <input type="text" id="is-set-username" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;">
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="is-set-shortcuts">
        <label for="is-set-shortcuts" style="font-size:13px;">Ativar atalhos digitados</label>
      </div>
      <div>
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Tecla para disparar atalho</label>
        <select id="is-set-trigger" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;">
          <option value="Space">Espaço</option>
          <option value="Enter">Enter</option>
          <option value="Tab">Tab</option>
        </select>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="is-set-autoopen">
        <label for="is-set-autoopen" style="font-size:13px;">Abrir painel automaticamente</label>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="is-set-favfirst">
        <label for="is-set-favfirst" style="font-size:13px;">Favoritos no topo</label>
      </div>
      <button id="is-btn-save-settings" style="background:var(--inmovya-primary); color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; font-weight:bold;">Salvar Configurações</button>
    </div>

    <!-- TAB: BACKUP -->
    <div id="is-tab-backup" class="is-tab-content" style="display:none; text-align:center;">
      <div style="font-size:13px; color:var(--inmovya-text-secondary); margin-bottom:20px;">Exporte todas as suas respostas e configurações, ou importe de um arquivo existente.</div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button id="is-btn-export" style="background:transparent; border:1px solid var(--inmovya-primary); color:var(--inmovya-primary); padding:10px; border-radius:4px; cursor:pointer; font-weight:bold;">Exportar Backup (JSON)</button>
        <label for="is-file-import" style="background:var(--inmovya-primary); color:white; padding:10px; border-radius:4px; cursor:pointer; font-weight:bold; display:block;">Importar Backup</label>
        <input type="file" id="is-file-import" accept=".json" style="display:none;">
      </div>
    </div>
  </div>
</div>

<!-- Modal Overlay for Form and Confirm -->
<div id="is-modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; justify-content:center; align-items:center;">
  
  <!-- Reply Form Modal -->
  <div id="is-reply-modal" style="display:none; background:var(--inmovya-background); color:var(--inmovya-text); width:calc(100% - 32px); max-width:400px; max-height:calc(100% - 32px); border-radius:8px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,0.28);">
    <div style="padding:15px; border-bottom:1px solid var(--inmovya-border);">
      <h3 id="is-modal-title" style="margin:0; font-size:16px;">Nova Resposta</h3>
    </div>
    <div style="padding:15px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:15px;">
      <div>
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Título</label>
        <input type="text" id="is-form-title" placeholder="Ex: Primeiro Contato" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;">
      </div>
      <div style="display:flex; gap:10px;">
        <div style="flex:1;">
          <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Atalho (opcional)</label>
          <input type="text" id="is-form-shortcut" placeholder="Ex: /oi" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;">
        </div>
        <div style="flex:1;">
          <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Categoria</label>
          <select id="is-form-category" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;"></select>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="is-form-favorite">
        <label for="is-form-favorite" style="font-size:13px;">Marcar como favorito</label>
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <label style="margin:0; font-size:12px; font-weight:bold;">Mensagens (Sequência)</label>
          <button id="is-btn-add-block" style="background:transparent; border:none; color:var(--inmovya-primary); cursor:pointer; font-size:12px; font-weight:bold;">+ Adicionar</button>
        </div>
        <div id="is-form-blocks" style="display:flex; flex-direction:column; gap:10px;"></div>
        <div style="font-size:11px; color:var(--inmovya-text-secondary); margin-top:5px;">Variáveis: {{nome}}, {{saudacao}}, {{meu_nome}}, {{data}}, {{hora}}</div>
      </div>
      <div>
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Imagens e anexos da sequência</label>
        <input type="file" id="is-form-attachments" accept="image/*,.pdf" multiple style="font-size:12px; max-width:100%;">
        <div style="font-size:11px; color:var(--inmovya-text-secondary); margin-top:5px;">Selecione várias imagens de uma vez ou adicione novos lotes. Elas serão enviadas na ordem exibida.</div>
        <div id="is-form-attachments-preview" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;"></div>
      </div>
    </div>
    <div style="padding:15px; border-top:1px solid var(--inmovya-border); display:flex; justify-content:flex-end; gap:10px; background:var(--inmovya-surface); flex-shrink:0;">
      <button id="is-btn-cancel-reply" style="background:transparent; border:1px solid #ccc; padding:8px 15px; border-radius:4px; cursor:pointer;">Cancelar</button>
      <button id="is-btn-save-reply" style="background:var(--inmovya-primary); color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">Salvar</button>
    </div>
  </div>

  <!-- Confirm Modal -->
  <div id="is-confirm-modal" style="display:none; background:var(--inmovya-background); color:var(--inmovya-text); width:90%; max-width:300px; border-radius:8px; padding:20px; text-align:center; box-shadow:0 8px 28px rgba(0,0,0,0.28);">
    <h3 id="is-confirm-title" style="margin-top:0; font-size:16px;">Confirmação</h3>
    <p id="is-confirm-text" style="color:var(--inmovya-text-secondary); margin-bottom:20px; font-size:14px;">Tem certeza?</p>
    <div style="display:flex; justify-content:center; gap:10px;">
      <button id="is-btn-confirm-cancel" style="background:transparent; border:1px solid #ccc; padding:8px 15px; border-radius:4px; cursor:pointer;">Cancelar</button>
      <button id="is-btn-confirm-ok" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">Confirmar</button>
    </div>
  </div>
</div>
<div id="is-native-toast" style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--inmovya-primary); color:white; padding:8px 16px; border-radius:20px; font-size:13px; opacity:0; transition:opacity 0.3s; pointer-events:none; z-index:9999999;"></div>
    `;
  },

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Bind Tab Switching
    document.querySelectorAll('.is-set-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.is-set-tab').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.is-tab-content').forEach(c => c.style.display = 'none');
        document.getElementById(e.target.getAttribute('data-tab')).style.display = 'block';
        if (e.target.getAttribute('data-tab') === 'is-tab-replies') {
          document.getElementById('is-tab-replies').style.display = 'block';
        } else if (e.target.getAttribute('data-tab') === 'is-tab-config') {
          document.getElementById('is-tab-config').style.display = 'flex';
        }
      });
    });

    // Close settings view
    document.getElementById('is-settings-close-btn').addEventListener('click', () => {
      window.IS.Panel.closeSettings();
    });

    // --- REPLIES ---
    document.getElementById('is-btn-new-reply').addEventListener('click', () => {
      this.openReplyForm(null);
    });

    document.getElementById('is-set-replies-list').addEventListener('click', async (e) => {
      const target = e.target;
      const id = target.getAttribute('data-id');
      if (target.classList.contains('is-btn-edit-reply')) {
        this.openReplyForm(id);
      } else if (target.classList.contains('is-btn-delete-reply')) {
        if (await this.showConfirm("Excluir", "Deseja excluir esta resposta?")) {
          let replies = await window.IS.Storage.getReplies();
          replies = replies.filter(r => r.id !== id);
          await window.IS.Storage.saveReplies(replies);
          this.renderReplies();
          this.showToast("Excluído com sucesso.");
        }
      }
    });

    // --- CATEGORIES ---
    document.getElementById('is-btn-add-cat').addEventListener('click', async () => {
      const input = document.getElementById('is-new-cat-name');
      const name = input.value.trim();
      if (!name) return;
      let categories = await window.IS.Storage.getCategories();
      categories.push({ id: window.IS.generateUUID(), name, createdAt: new Date().toISOString() });
      await window.IS.Storage.saveCategories(categories);
      input.value = '';
      this.renderCategories();
      this.showToast("Categoria adicionada.");
    });

    document.getElementById('is-set-categories-list').addEventListener('click', async (e) => {
      const target = e.target;
      if (target.classList.contains('is-btn-delete-cat')) {
        const id = target.getAttribute('data-id');
        if (await this.showConfirm("Excluir", "Deseja excluir esta categoria?")) {
          let categories = await window.IS.Storage.getCategories();
          let replies = await window.IS.Storage.getReplies();
          categories = categories.filter(c => c.id !== id);
          replies = replies.map(r => r.categoryId === id ? { ...r, categoryId: 'default-category' } : r);
          await window.IS.Storage.saveCategories(categories);
          await window.IS.Storage.saveReplies(replies);
          this.renderCategories();
          this.renderReplies();
          this.showToast("Excluído.");
        }
      }
    });

    // --- FORM MODAL ---
    document.getElementById('is-btn-cancel-reply').addEventListener('click', () => {
      document.getElementById('is-modal-overlay').style.display = 'none';
      document.getElementById('is-reply-modal').style.display = 'none';
    });

    document.getElementById('is-btn-save-reply').addEventListener('click', async () => {
      const title = document.getElementById('is-form-title').value.trim();
      if (!title) return this.showToast("O título é obrigatório");
      
      const shortcut = document.getElementById('is-form-shortcut').value.trim().replace(/^\//, '');
      const categoryId = document.getElementById('is-form-category').value;
      const favorite = document.getElementById('is-form-favorite').checked;
      const messageInputs = Array.from(document.querySelectorAll('.is-form-message-input'));
      if (this.draftAttachments.length && messageInputs.some(input => !input.value.trim())) {
        return this.showToast("Preencha todas as mensagens que possuem anexos.");
      }
      const message = this.getMessageBlocksData();
      
      let replies = await window.IS.Storage.getReplies();
      if (this.editingId) {
        const rIndex = replies.findIndex(r => r.id === this.editingId);
        if (rIndex > -1) {
          replies[rIndex] = { ...replies[rIndex], title, shortcut, categoryId, favorite, message, attachments: [...this.draftAttachments] };
        }
      } else {
        const newReply = { id: window.IS.generateUUID(), title, shortcut, categoryId, favorite, message, attachments: [...this.draftAttachments], order: replies.length };
        replies.push(newReply);
      }
      
      await window.IS.Storage.saveReplies(replies);
      document.getElementById('is-modal-overlay').style.display = 'none';
      document.getElementById('is-reply-modal').style.display = 'none';
      this.renderReplies();
      this.showToast("Resposta salva.");
    });

    document.getElementById('is-btn-add-block').addEventListener('click', () => {
      const currentTexts = Array.from(document.querySelectorAll('.is-form-message-input')).map(input => input.value);
      currentTexts.push("");
      this.renderMessageBlocks(currentTexts);
      this.renderAttachmentsPreview(this.draftAttachments);
    });

    document.getElementById('is-form-blocks').addEventListener('click', (e) => {
      if (e.target.classList.contains('is-btn-remove-block')) {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        const currentTexts = Array.from(document.querySelectorAll('.is-form-message-input')).map(input => input.value);
        currentTexts.splice(idx, 1);
        this.draftAttachments = this.draftAttachments.map(attachment => ({
          ...attachment,
          messageIndex: attachment.messageIndex > idx
            ? attachment.messageIndex - 1
            : Math.min(attachment.messageIndex || 0, Math.max(0, currentTexts.length - 1))
        }));
        this.renderMessageBlocks(currentTexts);
        this.renderAttachmentsPreview(this.draftAttachments);
      }
    });

    document.getElementById('is-form-attachments').addEventListener('change', (e) => {
      this.handleAttachmentsUpload(e);
    });
    
    document.getElementById('is-form-attachments-preview').addEventListener('click', async (e) => {
      if (e.target.classList.contains('is-btn-remove-attachment')) {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        this.draftAttachments.splice(idx, 1);
        this.renderAttachmentsPreview(this.draftAttachments);
      }
    });

    document.getElementById('is-form-attachments-preview').addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      if (!Number.isInteger(idx) || !this.draftAttachments[idx]) return;

      if (e.target.classList.contains('is-attachment-message')) {
        this.draftAttachments[idx].messageIndex = parseInt(e.target.value);
      } else if (e.target.classList.contains('is-attachment-caption')) {
        this.draftAttachments[idx].useCaption = e.target.value === 'caption';
      }
    });

    // --- CRM ---
    document.getElementById('is-btn-sync-labels').addEventListener('click', async () => {
      const btn = document.getElementById('is-btn-sync-labels');
      btn.textContent = "Sincronizando... (Não mexa no WA)";
      btn.disabled = true;
      
      try {
        if (!window.IS.Scraper || typeof window.IS.Scraper.run !== 'function') {
          throw new Error("Sincronizador de etiquetas indisponível.");
        }

        const result = await window.IS.Scraper.run();
        if (!Array.isArray(result)) {
          throw new Error(result && result.error ? result.error : "Não foi possível ler as etiquetas.");
        }

        this.waLabels = result;
        await chrome.storage.local.set({ waLabels: this.waLabels });
        this.renderWaLabels();
        this.showToast(`${result.length} etiqueta${result.length === 1 ? '' : 's'} sincronizada${result.length === 1 ? '' : 's'}.`);
      } catch(e) {
        window.IS.error("Erro ao sincronizar etiquetas", e);
        this.showToast(e.message || "Erro ao sincronizar etiquetas.");
      } finally {
        btn.textContent = "🔄 Sincronizar Etiquetas";
        btn.disabled = false;
      }
    });

    // --- CONFIG ---
    document.getElementById('is-btn-save-settings').addEventListener('click', async () => {
      let settings = await window.IS.Storage.getSettings();
      settings.userName = document.getElementById('is-set-username').value.trim();
      settings.shortcutsEnabled = document.getElementById('is-set-shortcuts').checked;
      settings.shortcutTrigger = document.getElementById('is-set-trigger').value;
      settings.autoOpenPanel = document.getElementById('is-set-autoopen').checked;
      settings.favoritesFirst = document.getElementById('is-set-favfirst').checked;
      await window.IS.Storage.saveSettings(settings);
      this.showToast("Configurações salvas.");
    });
    
    // --- BACKUP ---
    document.getElementById('is-btn-export').addEventListener('click', () => {
      window.IS.Storage.exportData();
    });
    
    document.getElementById('is-file-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (await this.showConfirm("Importar Backup", "Isto irá substituir seus dados. Continuar?")) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const json = JSON.parse(event.target.result);
            await window.IS.Storage.importData(json);
            this.refreshData();
            this.showToast("Backup importado.");
          } catch(err) {
            this.showToast("Erro ao importar.");
          }
        };
        reader.readAsText(file);
      }
      e.target.value = '';
    });
    
    this.refreshData();
  },

  async refreshData() {
    this.renderReplies();
    this.renderCategories();
    this.renderSettings();
    const data = await chrome.storage.local.get('waLabels');
    if(data.waLabels) {
      this.waLabels = data.waLabels;
      this.renderWaLabels();
    }
  },

  async renderReplies() {
    const list = document.getElementById('is-set-replies-list');
    const replies = await window.IS.Storage.getReplies();
    const categories = await window.IS.Storage.getCategories();
    
    const grouped = {};
    replies.forEach(r => {
      const catId = r.categoryId || 'uncategorized';
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(r);
    });

    let html = "";
    const renderItem = (r) => `
      <div style="border:1px solid var(--inmovya-border); padding:10px; border-radius:6px; display:flex; flex-direction:column; gap:5px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:13px;">${window.IS.escapeHTML(r.title)}</strong>
          <div style="display:flex; gap:5px;">
            <button class="is-btn-edit-reply" data-id="${r.id}" style="padding:3px 8px; font-size:11px; cursor:pointer; background:var(--inmovya-primary); color:white; border:none; border-radius:4px;">Editar</button>
            <button class="is-btn-delete-reply" data-id="${r.id}" style="padding:3px 8px; font-size:11px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:4px;">Excluir</button>
          </div>
        </div>
        <div style="font-size:11px; color:#888; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
          ${window.IS.escapeHTML(r.message || "").replace(/===/g, ' ⤶ ')}
        </div>
      </div>
    `;

    categories.forEach(c => {
      if (grouped[c.id] && grouped[c.id].length > 0) {
        html += `<div style="font-size:12px; font-weight:bold; color:var(--inmovya-primary); margin-top:10px;">📁 ${window.IS.escapeHTML(c.name)}</div>`;
        html += grouped[c.id].map(r => renderItem(r)).join('');
        delete grouped[c.id];
      }
    });

    if (grouped['uncategorized'] && grouped['uncategorized'].length > 0) {
      html += `<div style="font-size:12px; font-weight:bold; color:var(--inmovya-text-secondary); margin-top:10px;">📁 Geral</div>`;
      html += grouped['uncategorized'].map(r => renderItem(r)).join('');
    }

    if (replies.length === 0) {
      list.innerHTML = `<div style="color:#888; text-align:center; padding:20px;">Nenhuma resposta.</div>`;
    } else {
      list.innerHTML = html;
    }
  },

  async renderCategories() {
    const list = document.getElementById('is-set-categories-list');
    const categories = await window.IS.Storage.getCategories();
    
    if (categories.length === 0) {
      list.innerHTML = `<div style="color:#888; text-align:center; padding:20px;">Nenhuma categoria.</div>`;
    } else {
      list.innerHTML = categories.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border:1px solid var(--inmovya-border); border-radius:4px;">
          <strong style="font-size:13px;">${window.IS.escapeHTML(c.name)}</strong>
          ${c.id !== 'default-category' ? `<button class="is-btn-delete-cat" data-id="${c.id}" style="padding:3px 8px; font-size:11px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:4px;">Excluir</button>` : ''}
        </div>
      `).join('');
    }
  },
  
  async renderSettings() {
    const settings = await window.IS.Storage.getSettings();
    document.getElementById('is-set-username').value = settings.userName || '';
    document.getElementById('is-set-shortcuts').checked = !!settings.shortcutsEnabled;
    document.getElementById('is-set-trigger').value = settings.shortcutTrigger || 'Space';
    document.getElementById('is-set-autoopen').checked = !!settings.autoOpenPanel;
    document.getElementById('is-set-favfirst').checked = !!settings.favoritesFirst;
  },

  renderWaLabels() {
    const list = document.getElementById('is-set-labels-list');
    if (this.waLabels.length === 0) {
      list.innerHTML = `<div style="text-align:center; color:#888;">Nenhuma etiqueta.</div>`;
      return;
    }
    list.innerHTML = this.waLabels.map(label => `
      <div style="padding:10px; border:1px solid var(--inmovya-border); border-radius:4px;">
        <h4 style="margin:0 0 5px 0; font-size:13px;">🏷️ ${window.IS.escapeHTML(label.name)} (${label.contacts.length})</h4>
        <div style="font-size:11px; color:#888;">${label.contacts.map(c => window.IS.escapeHTML(c.name)).join(', ')}</div>
      </div>
    `).join('');
  },

  async openReplyForm(id) {
    this.editingId = id;
    this.draftAttachments = [];
    const modal = document.getElementById('is-reply-modal');
    document.getElementById('is-modal-overlay').style.display = 'flex';
    modal.style.display = 'flex';
    
    const catSelect = document.getElementById('is-form-category');
    const categories = await window.IS.Storage.getCategories();
    catSelect.innerHTML = categories.map(c => `<option value="${c.id}">${window.IS.escapeHTML(c.name)}</option>`).join('');

    if (id) {
      document.getElementById('is-modal-title').textContent = "Editar Resposta";
      const replies = await window.IS.Storage.getReplies();
      const r = replies.find(x => x.id === id);
      if (r) {
        const messageCount = Math.max(1, (r.message || '').split('===').filter(part => part.trim()).length);
        this.draftAttachments = Array.isArray(r.attachments)
          ? r.attachments.map(attachment => ({
              ...attachment,
              messageIndex: Number.isInteger(attachment.messageIndex)
                ? Math.min(attachment.messageIndex, messageCount - 1)
                : messageCount - 1,
              useCaption: !!attachment.useCaption
            }))
          : [];
        document.getElementById('is-form-title').value = r.title || '';
        document.getElementById('is-form-shortcut').value = r.shortcut || '';
        document.getElementById('is-form-category').value = r.categoryId || 'default-category';
        document.getElementById('is-form-favorite').checked = !!r.favorite;
        this.renderMessageBlocks((r.message || "").split('===').map(s => s.trim()));
        this.renderAttachmentsPreview(this.draftAttachments);
      }
    } else {
      document.getElementById('is-modal-title').textContent = "Nova Resposta";
      document.getElementById('is-form-title').value = '';
      document.getElementById('is-form-shortcut').value = '';
      document.getElementById('is-form-category').value = categories[0] ? categories[0].id : 'default-category';
      document.getElementById('is-form-favorite').checked = false;
      this.renderMessageBlocks([""]);
      this.renderAttachmentsPreview(this.draftAttachments);
    }
  },

  renderMessageBlocks(messagesArray) {
    const container = document.getElementById('is-form-blocks');
    if (!messagesArray || messagesArray.length === 0) messagesArray = [""];
    
    container.innerHTML = messagesArray.map((msg, idx) => `
      <div style="position:relative; display:flex; align-items:flex-start; gap:5px;">
        <div style="background:#f0f2f5; color:#666; padding:5px 8px; border-radius:4px; font-size:10px; font-weight:bold;">${idx + 1}</div>
        <textarea class="is-form-message-input" rows="${msg.length > 50 ? 4 : 2}" style="flex:1; width:100%; box-sizing:border-box; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; font-family:inherit; resize:vertical; font-size:12px;">${window.IS.escapeHTML(msg)}</textarea>
        ${messagesArray.length > 1 ? `<button class="is-btn-remove-block" data-idx="${idx}" style="background:none; border:none; color:red; cursor:pointer; font-size:14px; padding:0 5px;">&times;</button>` : ''}
      </div>
    `).join('');
  },

  getMessageBlocksData() {
    const inputs = document.querySelectorAll('.is-form-message-input');
    const texts = Array.from(inputs).map(input => input.value.trim()).filter(val => val.length > 0);
    return texts.join('\n\n===\n\n');
  },

  renderAttachmentsPreview(attachments) {
    const container = document.getElementById('is-form-attachments-preview');
    if (!attachments || attachments.length === 0) {
      container.innerHTML = '';
      return;
    }
    const messageCount = Math.max(1, document.querySelectorAll('.is-form-message-input').length);
    container.innerHTML = attachments.map((att, idx) => {
      let preview = '';
      if (att.type.startsWith('image/')) {
        preview = `<img src="${att.data}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">`;
      } else {
        preview = `<div style="width:40px; height:40px; background:#f0f2f5; display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:20px;">📄</div>`;
      }
      return `
        <div style="position:relative; display:flex; gap:8px; align-items:center; width:100%; border:1px solid var(--inmovya-border); padding:7px; border-radius:6px;">
          <div style="flex:0 0 auto;">${preview}</div>
          <div style="display:flex; flex-direction:column; gap:5px; flex:1; min-width:0;">
            <div style="font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${window.IS.escapeHTML(att.name)}">${idx + 1}. ${window.IS.escapeHTML(att.name)}</div>
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
              <select class="is-attachment-message" data-idx="${idx}" style="flex:1; min-width:110px; padding:4px; font-size:10px; border:1px solid var(--inmovya-border); border-radius:4px;">
                ${Array.from({ length: messageCount }, (_, messageIndex) => `<option value="${messageIndex}" ${messageIndex === (att.messageIndex || 0) ? 'selected' : ''}>Mensagem ${messageIndex + 1}</option>`).join('')}
              </select>
              <select class="is-attachment-caption" data-idx="${idx}" style="flex:1; min-width:100px; padding:4px; font-size:10px; border:1px solid var(--inmovya-border); border-radius:4px;">
                <option value="separate" ${att.useCaption ? '' : 'selected'}>Sem legenda</option>
                <option value="caption" ${att.useCaption ? 'selected' : ''}>Com legenda</option>
              </select>
            </div>
          </div>
          <button class="is-btn-remove-attachment" data-idx="${idx}" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">X</button>
        </div>
      `;
    }).join('');
  },

  async handleAttachmentsUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files || files.length === 0) return;

    this.showToast("Processando anexos...");

    let addedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        this.showToast(`Arquivo ${file.name} ignorado (>5MB).`);
        continue;
      }
      try {
        const base64Data = await this.fileToBase64(file);
        this.draftAttachments.push({
          id: window.IS.generateUUID(),
          name: file.name,
          type: file.type,
          data: base64Data,
          messageIndex: Math.max(0, document.querySelectorAll('.is-form-message-input').length - 1),
          useCaption: false
        });
        addedCount++;
      } catch (err) {
        console.error("Erro ao ler arquivo", err);
      }
    }

    this.renderAttachmentsPreview(this.draftAttachments);
    e.target.value = '';
    this.showToast(addedCount === 1 ? "1 anexo adicionado." : `${addedCount} anexos adicionados.`);
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  },

  showConfirm(title, text) {
    return new Promise((resolve) => {
      document.getElementById('is-confirm-title').textContent = title;
      document.getElementById('is-confirm-text').textContent = text;
      document.getElementById('is-modal-overlay').style.display = 'flex';
      document.getElementById('is-confirm-modal').style.display = 'block';
      
      const btnCancel = document.getElementById('is-btn-confirm-cancel');
      const btnOk = document.getElementById('is-btn-confirm-ok');
      
      const cleanup = () => {
        document.getElementById('is-confirm-modal').style.display = 'none';
        document.getElementById('is-modal-overlay').style.display = 'none';
        btnCancel.replaceWith(btnCancel.cloneNode(true));
        btnOk.replaceWith(btnOk.cloneNode(true));
      };
      
      btnCancel.addEventListener('click', () => { cleanup(); resolve(false); }, { once: true });
      btnOk.addEventListener('click', () => { cleanup(); resolve(true); }, { once: true });
    });
  },

  showToast(msg) {
    const t = document.getElementById('is-native-toast');
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => t.style.opacity = '0', 3000);
  }
};
