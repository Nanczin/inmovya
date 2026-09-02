// popup/popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const IS = window.IS;
  let replies = [];
  let categories = [];
  let settings = {};
  
  let currentEditId = null;

  // Init
  await loadData();
  renderTabs();
  renderReplies();
  renderCategories();
  renderSettings();

  async function loadData() {
    replies = await IS.Storage.getReplies();
    categories = await IS.Storage.getCategories();
    settings = await IS.Storage.getSettings();
  }

  // --- TABS ---
  function renderTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  // --- REPLIES ---
  function renderReplies(filter = "") {
    const list = document.getElementById('replies-list');
    let filtered = replies;
    if (filter) {
      const term = IS.removeAccents(filter.toLowerCase());
      filtered = filtered.filter(r => 
        IS.removeAccents(r.title.toLowerCase()).includes(term) || 
        (r.shortcut && IS.removeAccents(r.shortcut.toLowerCase()).includes(term))
      );
    }

    if (filtered.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--text-sec);font-size:13px;margin-top:20px;">Nenhuma resposta encontrada.</p>`;
      return;
    }

    list.innerHTML = filtered.map(r => `
      <div class="list-item">
        <div class="item-info">
          <h4>${r.favorite ? '⭐ ' : ''}${IS.escapeHTML(r.title)}</h4>
          <p>${r.shortcut ? IS.escapeHTML(r.shortcut) : 'Sem atalho'} • Usada: ${r.usageCount || 0}x</p>
        </div>
        <div class="item-actions">
          <button onclick="editReply('${r.id}')" title="Editar">✏️</button>
          <button onclick="duplicateReply('${r.id}')" title="Duplicar">📄</button>
          <button class="delete" onclick="deleteReply('${r.id}')" title="Excluir">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('search-replies').addEventListener('input', (e) => {
    renderReplies(e.target.value);
  });

  document.getElementById('btn-new-reply').addEventListener('click', () => {
    currentEditId = null;
    document.getElementById('modal-title').textContent = 'Nova Resposta';
    document.getElementById('form-title').value = '';
    document.getElementById('form-shortcut').value = '';
    document.getElementById('form-message').value = '';
    document.getElementById('form-favorite').checked = false;
    
    // Load categories into select
    const catSelect = document.getElementById('form-category');
    catSelect.innerHTML = categories.map(c => `<option value="${c.id}">${IS.escapeHTML(c.name)}</option>`).join('');
    
    document.getElementById('modal-reply').classList.add('open');
  });

  document.getElementById('btn-cancel-reply').addEventListener('click', () => {
    document.getElementById('modal-reply').classList.remove('open');
  });

  document.getElementById('btn-save-reply').addEventListener('click', async () => {
    const title = document.getElementById('form-title').value.trim();
    let shortcut = document.getElementById('form-shortcut').value.trim();
    const message = document.getElementById('form-message').value.trim();
    const categoryId = document.getElementById('form-category').value;
    const favorite = document.getElementById('form-favorite').checked;

    if (!title || !message) {
      showToast("Título e Mensagem são obrigatórios.");
      return;
    }
    
    if (shortcut && !shortcut.startsWith('/')) {
      shortcut = '/' + shortcut;
    }

    // Duplicate shortcut check
    if (shortcut) {
      const existing = replies.find(r => r.shortcut && r.shortcut.toLowerCase() === shortcut.toLowerCase() && r.id !== currentEditId);
      if (existing) {
        showToast("Este atalho já está sendo utilizado.");
        return;
      }
    }

    if (currentEditId) {
      const idx = replies.findIndex(r => r.id === currentEditId);
      if (idx !== -1) {
        replies[idx] = { ...replies[idx], title, shortcut, message, categoryId, favorite, updatedAt: new Date().toISOString() };
        showToast("Resposta atualizada.");
      }
    } else {
      replies.push({
        id: IS.generateUUID(),
        title, shortcut, message, categoryId, favorite,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast("Resposta criada com sucesso.");
    }

    await IS.Storage.saveReplies(replies);
    document.getElementById('modal-reply').classList.remove('open');
    renderReplies(document.getElementById('search-replies').value);
  });

  window.editReply = (id) => {
    const r = replies.find(x => x.id === id);
    if (!r) return;
    currentEditId = id;
    document.getElementById('modal-title').textContent = 'Editar Resposta';
    document.getElementById('form-title').value = r.title;
    document.getElementById('form-shortcut').value = r.shortcut || '';
    document.getElementById('form-message').value = r.message;
    document.getElementById('form-favorite').checked = !!r.favorite;
    
    const catSelect = document.getElementById('form-category');
    catSelect.innerHTML = categories.map(c => `<option value="${c.id}" ${c.id === r.categoryId ? 'selected' : ''}>${IS.escapeHTML(c.name)}</option>`).join('');
    
    document.getElementById('modal-reply').classList.add('open');
  };

  window.deleteReply = async (id) => {
    if (confirm("Deseja realmente excluir esta resposta?")) {
      replies = replies.filter(r => r.id !== id);
      await IS.Storage.saveReplies(replies);
      renderReplies(document.getElementById('search-replies').value);
      showToast("Resposta excluída.");
    }
  };
  
  window.duplicateReply = async (id) => {
    const r = replies.find(x => x.id === id);
    if (!r) return;
    const newReply = { ...r, id: IS.generateUUID(), title: r.title + " (Cópia)", shortcut: "", createdAt: new Date().toISOString() };
    replies.push(newReply);
    await IS.Storage.saveReplies(replies);
    renderReplies();
    showToast("Resposta duplicada.");
  }

  // --- CATEGORIES ---
  function renderCategories() {
    const list = document.getElementById('categories-list');
    list.innerHTML = categories.map(c => `
      <div class="list-item">
        <div class="item-info"><h4>${IS.escapeHTML(c.name)}</h4></div>
        <div class="item-actions">
          <button class="delete" onclick="deleteCategory('${c.id}')" title="Excluir">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('btn-add-category').addEventListener('click', async () => {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    if (!name) return;
    
    categories.push({ id: IS.generateUUID(), name, createdAt: new Date().toISOString() });
    await IS.Storage.saveCategories(categories);
    input.value = '';
    renderCategories();
    showToast("Categoria adicionada.");
  });

  window.deleteCategory = async (id) => {
    if (confirm("Deseja excluir esta categoria? As respostas serão movidas para 'Sem categoria'.")) {
      categories = categories.filter(c => c.id !== id);
      replies = replies.map(r => r.categoryId === id ? { ...r, categoryId: 'default-category' } : r);
      await IS.Storage.saveCategories(categories);
      await IS.Storage.saveReplies(replies);
      renderCategories();
      renderReplies();
      showToast("Categoria excluída.");
    }
  };

  // --- SETTINGS & BACKUP ---
  function renderSettings() {
    document.getElementById('set-username').value = settings.userName || '';
    document.getElementById('set-shortcuts').checked = !!settings.shortcutsEnabled;
    document.getElementById('set-trigger').value = settings.shortcutTrigger || 'Space';
    document.getElementById('set-autoopen').checked = !!settings.autoOpenPanel;
    document.getElementById('set-favfirst').checked = !!settings.favoritesFirst;
  }

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    settings.userName = document.getElementById('set-username').value.trim();
    settings.shortcutsEnabled = document.getElementById('set-shortcuts').checked;
    settings.shortcutTrigger = document.getElementById('set-trigger').value;
    settings.autoOpenPanel = document.getElementById('set-autoopen').checked;
    settings.favoritesFirst = document.getElementById('set-favfirst').checked;
    
    await IS.Storage.saveSettings(settings);
    showToast("Configurações salvas.");
  });
  
  document.getElementById('btn-export').addEventListener('click', () => {
    IS.Storage.exportData();
  });
  
  document.getElementById('file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (confirm("Isto irá substituir seus dados atuais. Deseja continuar?")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target.result);
          await IS.Storage.importData(json);
          await loadData();
          renderReplies();
          renderCategories();
          renderSettings();
          showToast("Backup importado com sucesso!");
        } catch(err) {
          showToast("Erro ao importar arquivo inválido.");
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  });

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
});
