// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  let replies = [];
  let categories = [];
  let settings = {};
  let currentEditId = null;

  // Initialize
  await IS.Storage.initDefaults();
  await loadData();
  renderReplies();
  renderCategories();
  renderSettings();

  async function loadData() {
    replies = await IS.Storage.getReplies();
    categories = await IS.Storage.getCategories();
    settings = await IS.Storage.getSettings();
  }

  // --- TABS LOGIC ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById('tab-' + btn.getAttribute('data-tab')).classList.add('active');
    });
  });

  // --- REPLIES ---
  function renderReplies(filter = '') {
    const list = document.getElementById('replies-list');
    
    let filtered = replies;
    if (filter) {
      const f = filter.toLowerCase();
      filtered = replies.filter(r => 
        r.title.toLowerCase().includes(f) || 
        r.message.toLowerCase().includes(f) ||
        (r.shortcut && r.shortcut.toLowerCase().includes(f))
      );
    }
    
    if (settings.favoritesFirst) {
      filtered.sort((a, b) => (b.favorite === a.favorite) ? 0 : b.favorite ? 1 : -1);
    }

    list.innerHTML = filtered.map(r => `
      <div class="list-item">
        <div class="item-info" style="cursor:pointer;" title="Clique para inserir no WhatsApp" data-id="${r.id}">
          <h4>${r.favorite ? '⭐ ' : ''}${IS.escapeHTML(r.title)}</h4>
          <p>${IS.escapeHTML(r.message)}</p>
          ${r.shortcut ? `<span class="shortcut-badge">${IS.escapeHTML(r.shortcut)}</span>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn-action btn-edit" data-id="${r.id}" title="Editar">✏️</button>
          <button class="btn-action btn-duplicate" data-id="${r.id}" title="Duplicar">📑</button>
          <button class="btn-action delete btn-delete" data-id="${r.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // Event Delegation for Replies List
  document.getElementById('replies-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-action');
    if (btn) {
      const id = btn.getAttribute('data-id');
      if (btn.classList.contains('btn-edit')) {
        editReply(id);
      } else if (btn.classList.contains('btn-delete')) {
        deleteReply(id);
      } else if (btn.classList.contains('btn-duplicate')) {
        duplicateReply(id);
      }
      return;
    }

    // Clique na linha para inserir a mensagem
    const info = e.target.closest('.item-info');
    if (info) {
      const id = info.getAttribute('data-id');
      const r = replies.find(x => x.id === id);
      if (r) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs.length > 0 && tabs[0].url.includes("web.whatsapp.com")) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "insert_message", message: r.message }, (response) => {
              if (chrome.runtime.lastError) {
                showToast("Por favor, recarregue a aba do WhatsApp.");
              } else {
                window.close(); // Fecha o popup aps inserir
              }
            });
          } else {
            showToast("Esta extenso s funciona no WhatsApp Web.");
          }
        });
      }
    }
  });

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

  function editReply(id) {
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
  }

  async function deleteReply(id) {
    if (confirm("Deseja realmente excluir esta resposta?")) {
      replies = replies.filter(r => r.id !== id);
      await IS.Storage.saveReplies(replies);
      renderReplies(document.getElementById('search-replies').value);
      showToast("Resposta excluída.");
    }
  }
  
  async function duplicateReply(id) {
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
        <div class="item-info" style="cursor:pointer;" title="Clique para inserir no WhatsApp" data-id="${r.id}"><h4>${IS.escapeHTML(c.name)}</h4></div>
        <div class="item-actions">
          <button class="btn-action delete btn-delete-cat" data-id="${c.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // Event Delegation for Categories
  document.getElementById('categories-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-cat');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    deleteCategory(id);
  });

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

  async function deleteCategory(id) {
    if (confirm("Deseja excluir esta categoria? As respostas serão movidas para 'Sem categoria'.")) {
      categories = categories.filter(c => c.id !== id);
      replies = replies.map(r => r.categoryId === id ? { ...r, categoryId: 'default-category' } : r);
      await IS.Storage.saveCategories(categories);
      await IS.Storage.saveReplies(replies);
      renderCategories();
      renderReplies();
      showToast("Categoria excluída.");
    }
  }

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

