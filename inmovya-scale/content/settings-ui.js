window.IS = window.IS || {};

window.IS.SettingsUI = {
  initialized: false,
  waLabels: [],
  selectedWaLabelName: null,
  selectedCategoryId: 'default-category',
  draggedLeadKey: null,
  suppressLeadClickUntil: 0,
  kanbanFullscreen: false,
  settingsContainerStyle: null,
  settingsContainerParent: null,
  settingsContainerNextSibling: null,
  fullscreenHost: null,
  editingId: null,
  draftAttachments: [],

  get htmlTemplate() {
    return `<div id="is-native-settings-container" style="display:flex; flex-direction:column; height:100%; width:100%; background:var(--inmovya-background); color:var(--inmovya-text); overflow-y:auto; overflow-x:hidden;">
  <div class="is-header" style="flex-shrink:0;">
    <div class="is-brand">
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
      <button type="button" id="is-btn-kanban-fullscreen" style="width:100%; padding:9px; margin-bottom:12px; border:1px solid #0877b5; border-radius:6px; background:#eef8ff; color:#075f91; cursor:pointer; font-weight:bold;">⛶ Abrir Kanban em tela cheia</button>
      <div id="is-set-categories-list" style="display:flex; flex-direction:column; gap:10px;"></div>
    </div>

    <!-- TAB: CRM -->
    <div id="is-tab-crm" class="is-tab-content" style="display:none; text-align:center;">
      <div style="font-size:12px; color:var(--inmovya-text-secondary); margin-bottom:10px; text-align:left; line-height:1.4;">Abra uma etiqueta no WhatsApp Business, informe o nome abaixo e capture. Repita o processo para cada etiqueta.</div>
      <input type="text" id="is-current-label-name" placeholder="Nome da etiqueta aberta" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box; margin-bottom:8px;">
      <button id="is-btn-sync-labels" style="background:var(--inmovya-primary); color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer; font-weight:bold; margin-bottom:15px;">Capturar etiqueta aberta</button>
      <div id="is-set-labels-list" style="text-align:left; display:flex; flex-direction:column; gap:10px;"></div>
    </div>

    <!-- TAB: CONFIG -->
    <div id="is-tab-config" class="is-tab-content" style="display:none; flex-direction:column; gap:15px;">
      <div>
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Seu Nome (usado em {{meu_nome}})</label>
        <input type="text" id="is-set-username" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;">
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
  <div id="is-reply-modal" style="display:none; background:var(--inmovya-background); color:var(--inmovya-text); width:calc(100% - 32px); max-width:400px; max-height:calc(100% - 32px); border-radius:8px; flex-direction:column; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,0.28);">
    <div style="padding:15px; border-bottom:1px solid var(--inmovya-border);">
      <h3 id="is-modal-title" style="margin:0; font-size:16px;">Nova Resposta</h3>
    </div>
    <div style="padding:15px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:15px;">
      <div>
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Título</label>
        <input type="text" id="is-form-title" placeholder="Ex: Primeiro Contato" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Categoria</label>
        <select id="is-form-category" style="width:100%; padding:8px; border:1px solid var(--inmovya-border); border-radius:4px; box-sizing:border-box;"></select>
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
        <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:5px;">Imagens, vídeos e anexos da sequência</label>
        <button type="button" id="is-btn-native-files" style="margin-top:8px; width:100%; padding:8px; border:1px solid var(--inmovya-primary); color:var(--inmovya-primary); background:transparent; border-radius:4px; cursor:pointer; font-weight:bold;">Selecionar arquivo original do computador</button>
        <div style="font-size:11px; color:var(--inmovya-text-secondary); margin-top:5px;">O aplicativo auxiliar lerá os arquivos diretamente da localização original no momento do envio.</div>
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
    document.getElementById('is-settings-close-btn').addEventListener('click', async () => {
      if (this.kanbanFullscreen) await this.toggleKanbanFullscreen(false);
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
          await this.renderReplies();
          await this.renderCategories();
          this.showToast("Excluído com sucesso.");
        }
      }
    });

    // --- CATEGORIES ---
    document.getElementById('is-btn-add-cat').addEventListener('click', () => this.addCategory());
    document.getElementById('is-btn-kanban-fullscreen').addEventListener('click', () => {
      this.toggleKanbanFullscreen(!this.kanbanFullscreen);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.kanbanFullscreen) this.toggleKanbanFullscreen(false);
    });
    document.getElementById('is-new-cat-name').addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.addCategory();
    });

    document.getElementById('is-set-categories-list').addEventListener('click', async (e) => {
      const leadButton = e.target.closest('.is-kanban-lead');
      if (leadButton) {
        if (Date.now() < this.suppressLeadClickUntil) return;
        await this.openKanbanLead(
          decodeURIComponent(leadButton.getAttribute('data-lead-key') || ''),
          leadButton.getAttribute('data-stage-id') || 'unassigned',
          leadButton
        );
        return;
      }

      const filterButton = e.target.closest('.is-category-filter');
      if (filterButton) {
        this.selectedCategoryId = filterButton.getAttribute('data-id') || 'default-category';
        await this.renderCategories();
        return;
      }

      const replyButton = e.target.closest('.is-category-reply');
      if (replyButton) {
        await this.openReplyForm(replyButton.getAttribute('data-id'));
        return;
      }

      const target = e.target.closest('.is-btn-delete-cat');
      if (target) {
        const id = target.getAttribute('data-id');
        if (await this.showConfirm("Excluir", "Deseja excluir esta categoria?")) {
          let categories = await window.IS.Storage.getCategories();
          let replies = await window.IS.Storage.getReplies();
          categories = categories.filter(c => c.id !== id);
          replies = replies.map(r => r.categoryId === id ? { ...r, categoryId: 'default-category' } : r);
          await window.IS.Storage.saveCategories(categories);
          await window.IS.Storage.saveReplies(replies);
          const assignmentData = await chrome.storage.local.get('leadCategoryAssignments');
          const assignments = assignmentData.leadCategoryAssignments || {};
          Object.keys(assignments).forEach(key => {
            if (assignments[key] === id) assignments[key] = 'default-category';
          });
          await chrome.storage.local.set({ leadCategoryAssignments: assignments });
          if (this.selectedCategoryId === id) this.selectedCategoryId = 'default-category';
          await this.renderCategories();
          await this.renderReplies();
          this.showToast("Excluído.");
        }
      }
    });

    document.getElementById('is-set-categories-list').addEventListener('change', async event => {
      const stageSelect = event.target.closest('.is-kanban-lead-stage');
      if (stageSelect) {
        const leadKey = decodeURIComponent(stageSelect.getAttribute('data-lead-key') || '');
        if (!leadKey) return;
        const stageData = await chrome.storage.local.get('leadStageAssignments');
        const stageAssignments = stageData.leadStageAssignments || {};
        stageAssignments[`${this.selectedCategoryId}:${leadKey}`] = stageSelect.value || 'unassigned';
        await chrome.storage.local.set({ leadStageAssignments: stageAssignments });
        await this.renderCategories();
        this.showToast('Lead movido para outra etapa.');
        return;
      }

      const moveSelect = event.target.closest('.is-kanban-lead-category');
      if (!moveSelect) return;
      const leadKey = decodeURIComponent(moveSelect.getAttribute('data-lead-key') || '');
      if (!leadKey) return;
      const assignmentData = await chrome.storage.local.get('leadCategoryAssignments');
      const assignments = assignmentData.leadCategoryAssignments || {};
      assignments[leadKey] = moveSelect.value || 'default-category';
      await chrome.storage.local.set({ leadCategoryAssignments: assignments });
      await this.renderCategories();
      this.showToast('Lead movido para outra categoria.');
    });

    const categoriesList = document.getElementById('is-set-categories-list');
    categoriesList.addEventListener('dragstart', event => {
      const lead = event.target.closest('.is-kanban-lead-card');
      if (!lead) return;
      this.draggedLeadKey = decodeURIComponent(lead.getAttribute('data-lead-key') || '');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', this.draggedLeadKey);
      lead.style.opacity = '0.55';
    });
    categoriesList.addEventListener('dragend', event => {
      const lead = event.target.closest('.is-kanban-lead-card');
      if (lead) lead.style.opacity = '';
      this.suppressLeadClickUntil = Date.now() + 300;
      this.draggedLeadKey = null;
    });
    categoriesList.addEventListener('dragover', event => {
      if (!event.target.closest('.is-kanban-column')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    categoriesList.addEventListener('drop', async event => {
      const column = event.target.closest('.is-kanban-column');
      if (!column) return;
      event.preventDefault();
      const leadKey = event.dataTransfer.getData('text/plain') || this.draggedLeadKey;
      const stageId = column.getAttribute('data-stage-id') || 'unassigned';
      if (!leadKey) return;
      const assignmentData = await chrome.storage.local.get('leadStageAssignments');
      const assignments = assignmentData.leadStageAssignments || {};
      assignments[`${this.selectedCategoryId}:${leadKey}`] = stageId;
      await chrome.storage.local.set({ leadStageAssignments: assignments });
      await this.renderCategories();
      this.showToast('Lead movido para outra etapa.');
    });

    // --- FORM MODAL ---
    document.getElementById('is-btn-cancel-reply').addEventListener('click', () => {
      document.getElementById('is-modal-overlay').style.display = 'none';
      document.getElementById('is-reply-modal').style.display = 'none';
    });

    document.getElementById('is-btn-save-reply').addEventListener('click', async () => {
      const title = document.getElementById('is-form-title').value.trim();
      if (!title) return this.showToast("O título é obrigatório");
      
      const categoryId = document.getElementById('is-form-category').value;
      const favorite = document.getElementById('is-form-favorite').checked;
      const message = this.getMessageBlocksData();
      const hasMessageText = Array.from(document.querySelectorAll('.is-form-message-input'))
        .some(input => input.value.trim().length > 0);
      if (!hasMessageText && this.draftAttachments.length === 0) {
        return this.showToast("Adicione uma mensagem ou uma imagem.");
      }
      
      let replies = await window.IS.Storage.getReplies();
      if (this.editingId) {
        const rIndex = replies.findIndex(r => r.id === this.editingId);
        if (rIndex > -1) {
          replies[rIndex] = { ...replies[rIndex], title, categoryId, favorite, message, attachments: [...this.draftAttachments] };
        }
      } else {
        const newReply = { id: window.IS.generateUUID(), title, categoryId, favorite, message, attachments: [...this.draftAttachments], order: replies.length };
        replies.push(newReply);
      }
      
      await window.IS.Storage.saveReplies(replies);
      document.getElementById('is-modal-overlay').style.display = 'none';
      document.getElementById('is-reply-modal').style.display = 'none';
      await this.renderReplies();
      await this.renderCategories();
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

    document.getElementById('is-btn-native-files').addEventListener('click', () => { this.handleNativeFiles(); });
    
    document.getElementById('is-form-attachments-preview').addEventListener('click', async (e) => {
      if (e.target.classList.contains('is-btn-remove-attachment')) {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        this.draftAttachments.splice(idx, 1);
        this.syncMessageBlocksWithAttachments();
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
      const nameInput = document.getElementById('is-current-label-name');
      const labelName = (nameInput.value || '').replace(/\s+/g, ' ').trim();
      if (!labelName) {
        this.showToast('Informe o nome da etiqueta que está aberta.');
        nameInput.focus();
        return;
      }

      btn.textContent = "Capturando etiqueta...";
      btn.disabled = true;
      
      try {
        if (!window.IS.Scraper || typeof window.IS.Scraper.captureOpenLabel !== 'function') {
          throw new Error("Sincronizador de etiquetas indisponível.");
        }

        const capturedLabel = await window.IS.Scraper.captureOpenLabel(labelName);
        const normalizedName = window.IS.removeAccents(labelName.toLocaleLowerCase());
        const existingIndex = this.waLabels.findIndex(label => window.IS.removeAccents(label.name.toLocaleLowerCase()) === normalizedName);
        if (existingIndex >= 0) this.waLabels[existingIndex] = capturedLabel;
        else this.waLabels.push(capturedLabel);
        this.selectedWaLabelName = capturedLabel.name;
        await chrome.storage.local.set({ waLabels: this.waLabels });
        this.renderWaLabels();
        await this.renderCategories();
        nameInput.value = '';
        this.showToast(`${capturedLabel.name}: ${capturedLabel.contacts.length} contato(s) capturado(s).`);
      } catch(e) {
        window.IS.error("Erro ao sincronizar etiquetas", e);
        this.showToast(e.message || "Erro ao sincronizar etiquetas.");
      } finally {
        btn.textContent = "Capturar etiqueta aberta";
        btn.disabled = false;
      }
    });

    document.getElementById('is-set-labels-list').addEventListener('click', (event) => {
      const deleteButton = event.target.closest('.is-delete-synced-label');
      if (deleteButton) {
        const labelName = deleteButton.getAttribute('data-label-name');
        this.showConfirm('Excluir etiqueta', `Remover ${labelName} da extensão?`).then(async confirmed => {
          if (!confirmed) return;
          this.waLabels = this.waLabels.filter(label => label.name !== labelName);
          if (this.selectedWaLabelName === labelName) {
            this.selectedWaLabelName = this.waLabels[0] ? this.waLabels[0].name : null;
          }
          await chrome.storage.local.set({ waLabels: this.waLabels });
          this.renderWaLabels();
          await this.renderCategories();
          this.showToast('Etiqueta removida da extensão.');
        });
        return;
      }

      const button = event.target.closest('.is-label-selector');
      if (button) {
        this.selectedWaLabelName = button.getAttribute('data-label-name');
        this.renderWaLabels();
        return;
      }

      const contactButton = event.target.closest('.is-label-contact');
      if (!contactButton) return;
      const labelIndex = Number(contactButton.getAttribute('data-label-index'));
      const contactIndex = Number(contactButton.getAttribute('data-contact-index'));
      const label = this.waLabels[labelIndex];
      const contact = label && Array.isArray(label.contacts) ? label.contacts[contactIndex] : null;
      if (!label || !contact) return;

      contactButton.disabled = true;
      contactButton.textContent = `Abrindo ${contact.name}…`;
      window.IS.Scraper.openContact(label.name, contact)
        .then(() => window.IS.Panel.closeSettings())
        .catch(error => {
          window.IS.error('Erro ao abrir contato da etiqueta', error);
          this.showToast(error.message || 'Não foi possível abrir a conversa.');
          this.renderWaLabels();
        });
    });

    // --- CONFIG ---
    document.getElementById('is-btn-save-settings').addEventListener('click', async () => {
      let settings = await window.IS.Storage.getSettings();
      settings.userName = document.getElementById('is-set-username').value.trim();
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
    await this.renderReplies();
    await this.renderSettings();
    const data = await chrome.storage.local.get('waLabels');
    if(data.waLabels) {
      this.waLabels = data.waLabels;
      if (!this.waLabels.some(label => label.name === this.selectedWaLabelName)) {
        this.selectedWaLabelName = this.waLabels[0] ? this.waLabels[0].name : null;
      }
      this.renderWaLabels();
    }
    await this.renderCategories();
  },

  async renderReplies() {
    const list = document.getElementById('is-set-replies-list');
    const replies = await window.IS.Storage.getReplies();
    const categories = await window.IS.Storage.getCategories();
    
    const grouped = {};
    replies.forEach(r => {
      const catId = r.categoryId || 'default-category';
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
      if (c.id === 'default-category') return;
      if (grouped[c.id] && grouped[c.id].length > 0) {
        html += `<div style="font-size:12px; font-weight:bold; color:var(--inmovya-primary); margin-top:10px;">📁 ${window.IS.escapeHTML(c.name)}</div>`;
        html += grouped[c.id].map(r => renderItem(r)).join('');
        delete grouped[c.id];
      }
    });

    if (grouped['default-category'] && grouped['default-category'].length > 0) {
      html += `<div style="font-size:12px; font-weight:bold; color:var(--inmovya-text-secondary); margin-top:10px;">📁 Sem categoria</div>`;
      html += grouped['default-category'].map(r => renderItem(r)).join('');
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
    const replies = await window.IS.Storage.getReplies();
    const assignmentData = await chrome.storage.local.get('leadCategoryAssignments');
    const assignments = assignmentData.leadCategoryAssignments || {};
    const stageData = await chrome.storage.local.get('leadStageAssignments');
    const stageAssignments = stageData.leadStageAssignments || {};
    const boardCategories = [
      { id: 'default-category', name: 'Sem categoria' },
      ...categories.filter(category => category.id !== 'default-category')
    ];
    const categoryIdForReply = reply => reply.categoryId || 'default-category';
    const validCategoryIds = new Set(boardCategories.map(category => category.id));
    const leads = this.getKanbanLeads();
    if (!validCategoryIds.has(this.selectedCategoryId)) this.selectedCategoryId = 'default-category';
    const selectedCategory = boardCategories.find(category => category.id === this.selectedCategoryId) || boardCategories[0];

    const categorySelectors = boardCategories.map(category => {
      const active = category.id === selectedCategory.id;
      const responseCount = replies.filter(reply => categoryIdForReply(reply) === category.id).length;
      return `<button type="button" class="is-category-filter" data-id="${window.IS.escapeHTML(category.id)}" style="flex:0 0 auto; padding:8px 12px; border:1px solid ${active ? '#0877b5' : '#c9d9e5'}; border-radius:18px; background:${active ? 'linear-gradient(135deg,#0877b5,#075f91)' : '#ffffff'}; color:${active ? 'white' : '#36596f'}; cursor:pointer; font-size:11px; font-weight:bold;">${window.IS.escapeHTML(category.name)} (${responseCount})</button>`;
    }).join('');

    const categoryReplies = replies
      .filter(reply => categoryIdForReply(reply) === selectedCategory.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const categoryLeads = leads.filter(lead => {
      const assignedCategory = validCategoryIds.has(assignments[lead.key]) ? assignments[lead.key] : 'default-category';
      return assignedCategory === selectedCategory.id;
    });
    const stages = [
      { id: 'unassigned', title: 'Sem etapa', message: categoryReplies.length ? 'Clique no lead para enviar a primeira resposta' : 'Nenhuma resposta cadastrada' },
      ...categoryReplies.map(reply => ({ id: reply.id, title: reply.title || 'Sem título', message: reply.message || '' })),
      ...(categoryReplies.length ? [{ id: 'completed', title: 'Concluído', message: 'Todas as respostas desta categoria foram enviadas' }] : [])
    ];
    const validStageIds = new Set(stages.map(stage => stage.id));

    const columns = stages.map(stage => {
      const stageLeads = categoryLeads.filter(lead => {
        const assignedStage = stageAssignments[`${selectedCategory.id}:${lead.key}`] || 'unassigned';
        return (validStageIds.has(assignedStage) ? assignedStage : 'unassigned') === stage.id;
      });
      const preview = stage.message.replace(/\s*===\s*/g, ' • ').replace(/\s+/g, ' ').trim().slice(0, 85);
      const leadCards = stageLeads.length
        ? stageLeads.map(lead => `<div draggable="true" class="is-kanban-lead-card" data-lead-key="${encodeURIComponent(lead.key)}" style="padding:8px; border:1px solid #a9d1ea; border-radius:6px; background:#eef8ff; color:#123d59; cursor:grab; box-shadow:0 1px 2px rgba(13,73,110,0.06);">
            <button type="button" class="is-kanban-lead" data-lead-key="${encodeURIComponent(lead.key)}" data-stage-id="${window.IS.escapeHTML(stage.id)}" style="display:block; width:100%; padding:0; border:none; background:transparent; color:inherit; text-align:left; cursor:pointer;">
              <strong style="display:block; font-size:12px;">👤 ${window.IS.escapeHTML(lead.contact.name)}</strong>
              <span style="display:block; margin-top:3px; color:#56798f; font-size:9px;">🏷️ ${window.IS.escapeHTML(lead.labels.join(', '))}</span>
              <span style="display:block; margin-top:5px; color:#0877b5; font-size:9px; font-weight:bold;">${stage.id === 'completed' ? 'Abrir conversa' : 'Enviar resposta e avançar →'}</span>
            </button>
            <select class="is-kanban-lead-stage" data-lead-key="${encodeURIComponent(lead.key)}" style="width:100%; margin-top:7px; padding:5px; border:1px solid #b8cfde; border-radius:5px; background:white; color:#254c64; font-size:10px;">
              ${stages.map(option => `<option value="${window.IS.escapeHTML(option.id)}" ${option.id === stage.id ? 'selected' : ''}>Etapa: ${window.IS.escapeHTML(option.title)}</option>`).join('')}
            </select>
            <select class="is-kanban-lead-category" data-lead-key="${encodeURIComponent(lead.key)}" style="width:100%; margin-top:5px; padding:5px; border:1px solid #b8cfde; border-radius:5px; background:white; color:#254c64; font-size:10px;">
              ${boardCategories.map(option => `<option value="${window.IS.escapeHTML(option.id)}" ${option.id === selectedCategory.id ? 'selected' : ''}>Categoria: ${window.IS.escapeHTML(option.name)}</option>`).join('')}
            </select>
          </div>`).join('')
        : '<div style="font-size:10px; color:#7a8d99; padding:7px; text-align:center;">Nenhum lead nesta etapa</div>';

      return `<section class="is-kanban-column" data-stage-id="${window.IS.escapeHTML(stage.id)}" style="flex:0 0 ${this.kanbanFullscreen ? '270px' : '225px'}; border:1px solid #c9d9e5; border-radius:8px; background:#f5f8fb; min-height:${this.kanbanFullscreen ? 'calc(100vh - 250px)' : '250px'}; overflow:hidden; box-shadow:0 3px 10px rgba(13,73,110,0.08);">
        <div style="padding:10px; background:linear-gradient(135deg,#0877b5,#075f91); color:white;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${window.IS.escapeHTML(stage.title)}</strong>
            <span style="flex:0 0 auto; padding:2px 7px; border-radius:10px; background:rgba(255,255,255,0.2); font-size:10px;">${stageLeads.length}</span>
          </div>
          <div style="margin-top:4px; font-size:9px; line-height:1.3; opacity:0.84;">${window.IS.escapeHTML(preview || 'Etapa da resposta rápida')}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:7px; min-height:80px; padding:9px;">${leadCards}</div>
      </section>`;
    }).join('');

    const manageableCategories = categories.filter(category => category.id !== 'default-category');
    const categoryManagement = manageableCategories.length
      ? manageableCategories.map(category => `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border:1px solid var(--inmovya-border); border-radius:4px;">
          <strong style="font-size:12px;">${window.IS.escapeHTML(category.name)}</strong>
          <button type="button" class="is-btn-delete-cat" data-id="${window.IS.escapeHTML(category.id)}" style="padding:3px 8px; font-size:11px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:4px;">Excluir</button>
        </div>`).join('')
      : `<div style="color:#888; font-size:12px;">Nenhuma categoria personalizada.</div>`;

    list.innerHTML = `
      <div style="font-size:11px; color:var(--inmovya-text-secondary);">Selecione uma categoria. Cada resposta rápida aparece como uma etapa do Kanban.</div>
      <div style="display:flex; gap:7px; overflow-x:auto; padding:7px 0 9px;">${categorySelectors}</div>
      <div style="display:flex; gap:10px; overflow-x:auto; align-items:stretch; padding:0 0 10px; min-height:${this.kanbanFullscreen ? 'calc(100vh - 225px)' : 'auto'};">${columns}</div>
      <div style="font-size:12px; font-weight:bold; margin-top:10px;">Gerenciar categorias</div>
      <div style="display:flex; flex-direction:column; gap:7px;">${categoryManagement}</div>
    `;
  },

  async toggleKanbanFullscreen(enabled) {
    const container = document.getElementById('is-native-settings-container');
    const button = document.getElementById('is-btn-kanban-fullscreen');
    if (!container || !button || this.kanbanFullscreen === enabled) return;

    if (enabled) {
      this.settingsContainerStyle = container.getAttribute('style') || '';
      this.settingsContainerParent = container.parentNode;
      this.settingsContainerNextSibling = container.nextSibling;
      const host = document.createElement('div');
      host.id = 'is-kanban-fullscreen-host';
      host.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;background:#eef3f7;pointer-events:auto;overflow:hidden;';
      host.style.setProperty('--inmovya-primary', '#0877b5');
      host.style.setProperty('--inmovya-primary-hover', '#075f91');
      host.style.setProperty('--inmovya-background', '#ffffff');
      host.style.setProperty('--inmovya-surface', '#f5f8fb');
      host.style.setProperty('--inmovya-text', '#102f43');
      host.style.setProperty('--inmovya-text-secondary', '#60788a');
      host.style.setProperty('--inmovya-border', '#cad8e2');
      document.body.appendChild(host);
      host.appendChild(container);
      this.fullscreenHost = host;
      this.kanbanFullscreen = true;
      Object.assign(container.style, {
        position: 'relative',
        inset: 'auto',
        width: '100%',
        height: '100%',
        zIndex: '1',
        borderRadius: '0',
        boxShadow: 'none'
      });
      button.textContent = '↙ Voltar ao painel lateral';
      await this.renderCategories();
      if (host.animate) {
        host.animate([
          { opacity: 0.35, transform: 'scale(0.96)' },
          { opacity: 1, transform: 'scale(1)' }
        ], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      return;
    }

    this.kanbanFullscreen = false;
    const host = this.fullscreenHost;
    if (host && host.animate) {
      const animation = host.animate([
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0.45, transform: 'scale(0.97)' }
      ], { duration: 180, easing: 'ease-in' });
      try { await animation.finished; } catch (_) {}
    }
    if (this.settingsContainerParent) {
      this.settingsContainerParent.insertBefore(container, this.settingsContainerNextSibling);
    }
    container.setAttribute('style', this.settingsContainerStyle || '');
    if (host) host.remove();
    this.settingsContainerStyle = null;
    this.settingsContainerParent = null;
    this.settingsContainerNextSibling = null;
    this.fullscreenHost = null;
    button.textContent = '⛶ Abrir Kanban em tela cheia';
    await this.renderCategories();
  },

  getKanbanLeads() {
    const leadsByKey = new Map();
    this.waLabels.forEach(label => {
      (Array.isArray(label.contacts) ? label.contacts : []).forEach(contact => {
        const normalizedName = window.IS.removeAccents((contact.name || '').toLocaleLowerCase().trim());
        const key = contact.chatId || normalizedName;
        if (!key) return;
        if (!leadsByKey.has(key)) {
          leadsByKey.set(key, { key, contact, labelName: label.name, labels: [] });
        }
        const lead = leadsByKey.get(key);
        if (!lead.labels.includes(label.name)) lead.labels.push(label.name);
      });
    });
    return Array.from(leadsByKey.values()).sort((a, b) => a.contact.name.localeCompare(b.contact.name, 'pt-BR'));
  },

  async openKanbanLead(leadKey, stageId = 'unassigned', triggerButton = null) {
    const lead = this.getKanbanLeads().find(item => item.key === leadKey);
    if (!lead) return;
    const replies = (await window.IS.Storage.getReplies())
      .filter(reply => (reply.categoryId || 'default-category') === this.selectedCategoryId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const replyIndex = stageId === 'unassigned' ? 0 : replies.findIndex(reply => reply.id === stageId);

    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.style.opacity = '0.65';
    }
    try {
      await window.IS.Scraper.openContact(lead.labelName, lead.contact);
      if (stageId === 'completed') {
        this.showToast('Conversa aberta. Este lead já concluiu as etapas.');
        return;
      }
      if (replyIndex < 0 || !replies[replyIndex]) {
        throw new Error('Não existe uma resposta rápida disponível para esta etapa.');
      }

      const reply = replies[replyIndex];
      const contactName = window.IS.WhatsAppDOM.getCurrentChatName() || lead.contact.name;
      const finalMessage = await window.IS.Variables.parseMessage(reply.message || '', contactName);
      const sent = await window.IS.WhatsAppDOM.insertSequenceAndAttachments(finalMessage, reply.attachments || []);
      if (!sent) throw new Error('A resposta rápida não pôde ser enviada para este lead.');

      const nextStageId = replies[replyIndex + 1] ? replies[replyIndex + 1].id : 'completed';
      const stageData = await chrome.storage.local.get('leadStageAssignments');
      const stageAssignments = stageData.leadStageAssignments || {};
      stageAssignments[`${this.selectedCategoryId}:${lead.key}`] = nextStageId;
      await chrome.storage.local.set({ leadStageAssignments: stageAssignments });

      reply.usageCount = (reply.usageCount || 0) + 1;
      reply.lastUsedAt = new Date().toISOString();
      const allReplies = await window.IS.Storage.getReplies();
      await window.IS.Storage.saveReplies(allReplies.map(item => item.id === reply.id
        ? { ...item, usageCount: reply.usageCount, lastUsedAt: reply.lastUsedAt }
        : item));
      await this.renderCategories();
      this.showToast(`Resposta enviada. Lead avançou para ${replies[replyIndex + 1]?.title || 'Concluído'}.`);
    } catch (error) {
      window.IS.error('Erro ao enviar etapa do Kanban', error);
      this.showToast(error.message || 'Não foi possível enviar a resposta.');
    } finally {
      if (triggerButton && triggerButton.isConnected) {
        triggerButton.disabled = false;
        triggerButton.style.opacity = '';
      }
    }
  },

  async addCategory() {
    const input = document.getElementById('is-new-cat-name');
    const button = document.getElementById('is-btn-add-cat');
    const name = (input?.value || '').replace(/\s+/g, ' ').trim();
    if (!name) {
      this.showToast('Digite o nome da categoria.');
      input?.focus();
      return false;
    }

    button.disabled = true;
    try {
      const categories = await window.IS.Storage.getCategories();
      const normalizedName = window.IS.removeAccents(name.toLocaleLowerCase());
      if (categories.some(category => window.IS.removeAccents((category.name || '').toLocaleLowerCase()) === normalizedName)) {
        this.showToast('Essa categoria já existe.');
        return false;
      }

      const category = { id: window.IS.generateUUID(), name, createdAt: new Date().toISOString() };
      await window.IS.Storage.saveCategories([...categories, category]);
      const savedCategories = await window.IS.Storage.getCategories();
      if (!savedCategories.some(saved => saved.id === category.id)) {
        throw new Error('A categoria não foi confirmada no armazenamento.');
      }

      input.value = '';
      await this.renderCategories();
      await window.IS.Panel.reloadData();
      this.showToast('Categoria adicionada.');
      return true;
    } catch (error) {
      window.IS.error('Erro ao adicionar categoria', error);
      this.showToast(`Não foi possível adicionar: ${error.message}`);
      return false;
    } finally {
      button.disabled = false;
    }
  },
  
  async renderSettings() {
    const settings = await window.IS.Storage.getSettings();
    document.getElementById('is-set-username').value = settings.userName || '';
    document.getElementById('is-set-autoopen').checked = !!settings.autoOpenPanel;
    document.getElementById('is-set-favfirst').checked = !!settings.favoritesFirst;
  },

  renderWaLabels() {
    const list = document.getElementById('is-set-labels-list');
    if (this.waLabels.length === 0) {
      list.innerHTML = `<div style="text-align:center; color:#888;">Nenhuma etiqueta.</div>`;
      return;
    }

    const selectedLabelIndex = Math.max(0, this.waLabels.findIndex(label => label.name === this.selectedWaLabelName));
    const selectedLabel = this.waLabels[selectedLabelIndex] || this.waLabels[0];
    this.selectedWaLabelName = selectedLabel.name;
    const contacts = Array.isArray(selectedLabel.contacts) ? selectedLabel.contacts : [];

    list.innerHTML = `
      <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;">
        ${this.waLabels.map(label => {
          const active = label.name === selectedLabel.name;
          const contactCount = Array.isArray(label.contacts) ? label.contacts.length : 0;
          return `<div style="display:flex; flex:0 0 auto; align-items:center; border:1px solid ${active ? 'var(--inmovya-primary)' : 'var(--inmovya-border)'}; border-radius:16px; overflow:hidden; background:${active ? 'var(--inmovya-primary)' : 'var(--inmovya-surface)'};">
            <button type="button" class="is-label-selector" data-label-name="${window.IS.escapeHTML(label.name)}" style="padding:7px 7px 7px 10px; border:none; cursor:pointer; background:transparent; color:${active ? 'white' : 'var(--inmovya-text)'}; font-size:12px;">🏷️ ${window.IS.escapeHTML(label.name)} (${contactCount})</button>
            <button type="button" class="is-delete-synced-label" data-label-name="${window.IS.escapeHTML(label.name)}" title="Remover etiqueta da extensão" aria-label="Remover ${window.IS.escapeHTML(label.name)} da extensão" style="padding:7px 9px 7px 5px; border:none; cursor:pointer; background:transparent; color:${active ? 'white' : '#dc3545'}; font-size:14px; font-weight:bold;">×</button>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:12px; font-weight:bold; margin-top:6px;">Contatos em ${window.IS.escapeHTML(selectedLabel.name)}</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${contacts.length ? contacts.map((contact, contactIndex) => `
          <button type="button" class="is-label-contact" data-label-index="${selectedLabelIndex}" data-contact-index="${contactIndex}" style="padding:9px 10px; border:1px solid var(--inmovya-border); border-radius:6px; background:var(--inmovya-surface); color:var(--inmovya-text); font-size:12px; text-align:left; cursor:pointer;">
            💬 ${window.IS.escapeHTML(contact.name)}
          </button>
        `).join('') : '<div style="padding:12px; text-align:center; color:#888; font-size:12px;">Nenhum contato nesta etiqueta.</div>'}
      </div>
    `;
  },

  async openReplyForm(id) {
    this.editingId = id;
    this.draftAttachments = [];
    const modal = document.getElementById('is-reply-modal');
    document.getElementById('is-confirm-modal').style.display = 'none';
    document.getElementById('is-modal-overlay').style.display = 'flex';
    modal.style.display = 'flex';
    
    const catSelect = document.getElementById('is-form-category');
    const categories = await window.IS.Storage.getCategories();
    catSelect.innerHTML = `<option value="default-category">Sem categoria</option>` +
      categories
        .filter(c => c.id !== 'default-category')
        .map(c => `<option value="${c.id}">${window.IS.escapeHTML(c.name)}</option>`)
        .join('');

    if (id) {
      document.getElementById('is-modal-title').textContent = "Editar Resposta";
      const replies = await window.IS.Storage.getReplies();
      const r = replies.find(x => x.id === id);
      if (r) {
        const storedMessages = (r.message || '').split('===').map(part => part.trim());
        const messageCount = Math.max(1, storedMessages.length, Array.isArray(r.attachments) ? r.attachments.length : 0);
        while (storedMessages.length < messageCount) storedMessages.push('');
        this.draftAttachments = Array.isArray(r.attachments)
          ? r.attachments.map((attachment, attachmentIndex) => ({
              ...attachment,
              messageIndex: Math.min(attachmentIndex, messageCount - 1),
              useCaption: !!attachment.useCaption
            }))
          : [];
        document.getElementById('is-form-title').value = r.title || '';
        document.getElementById('is-form-category').value = r.categoryId || 'default-category';
        document.getElementById('is-form-favorite').checked = !!r.favorite;
        this.renderMessageBlocks(storedMessages);
        this.renderAttachmentsPreview(this.draftAttachments);
      }
    } else {
      document.getElementById('is-modal-title').textContent = "Nova Resposta";
      document.getElementById('is-form-title').value = '';
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
    const texts = Array.from(inputs).map(input => input.value.trim());
    return texts.join('\n\n===\n\n');
  },

  syncMessageBlocksWithAttachments() {
    const texts = Array.from(document.querySelectorAll('.is-form-message-input')).map(input => input.value);
    const requiredCount = Math.max(1, this.draftAttachments.length);
    while (texts.length < requiredCount) texts.push('');
    this.draftAttachments = this.draftAttachments.map((attachment, index) => ({
      ...attachment,
      messageIndex: Math.min(index, texts.length - 1)
    }));
    this.renderMessageBlocks(texts);
    this.renderAttachmentsPreview(this.draftAttachments);
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
      if (att.type.startsWith('image/') && att.data) {
        preview = `<img src="${att.data}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">`;
      } else if (att.type.startsWith('video/')) {
        preview = `<div style="width:40px; height:40px; background:#e8f4ff; display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:20px;">🎬</div>`;
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
      const maxSize = file.type.startsWith('video/') ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) {
        const limitMb = file.type.startsWith('video/') ? 200 : 20;
        this.showToast(`Arquivo ${file.name} ignorado (>${limitMb}MB).`);
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

    this.syncMessageBlocksWithAttachments();
    e.target.value = '';
    this.showToast(addedCount === 1 ? "1 anexo adicionado." : `${addedCount} anexos adicionados.`);
  },

  async handleNativeFiles() {
    this.showToast("Abrindo arquivos do computador...");
    try {
      const response = await chrome.runtime.sendMessage({ action: 'native_pick_files' });
      if (!response?.ok) throw new Error(response?.error || 'Aplicativo auxiliar indisponível.');
      const files = Array.isArray(response.files) ? response.files : [];
      files.forEach(file => {
        this.draftAttachments.push({
          id: window.IS.generateUUID(),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size || 0,
          nativePath: file.path,
          messageIndex: this.draftAttachments.length,
          useCaption: false
        });
      });
      this.syncMessageBlocksWithAttachments();
      this.showToast(files.length === 1 ? '1 arquivo original adicionado.' : `${files.length} arquivos originais adicionados.`);
    } catch (error) {
      window.IS.error('Erro no aplicativo auxiliar', error);
      this.showToast(`Aplicativo auxiliar: ${error.message}`);
    }
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
      document.getElementById('is-reply-modal').style.display = 'none';
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
