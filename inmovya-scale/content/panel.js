// content/panel.js
window.IS = window.IS || {};

window.IS.Panel = {
  container: null,
  replies: [],
  categories: [],
  settings: {},
  isOpen: false,
  searchTerm: "",
  activeCategory: "all",
  showFavoritesOnly: false,

  async init() {
    this.settings = await window.IS.Storage.getSettings();
    this.replies = await window.IS.Storage.getReplies();
    this.categories = await window.IS.Storage.getCategories();
    this.isOpen = this.settings.autoOpenPanel;

    this.render();
    this.setupListeners();
    this.setupDragResizer();
  },

  async reloadData() {
    this.replies = await window.IS.Storage.getReplies();
    this.categories = await window.IS.Storage.getCategories();
    this.settings = await window.IS.Storage.getSettings();
    this.updateList();
  },

  render() {
    if (document.getElementById('inmovya-scale-root')) {
      this.container = document.getElementById('inmovya-scale-root');
    } else {
      this.container = document.createElement('div');
      this.container.id = 'inmovya-scale-root';
      document.body.appendChild(this.container);
    }

    this.container.innerHTML = `
      <div id="is-toggle-button" class="${this.isOpen ? 'is-hidden' : ''}" title="Abrir Inmovya Scale">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </div>
      
      <div id="is-sidebar" class="${this.isOpen ? 'is-open' : ''}" style="width: ${this.settings.panelWidth}px">
        <div id="is-resizer"></div>
        <div class="is-header">
          <div class="is-brand">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
            <span>Inmovya Scale</span>
          </div>
          <button id="is-close-btn" title="Fechar painel">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
                <div class="is-filters">
          <div class="is-search-wrapper" style="display:flex; gap:5px;">
            <input type="text" id="is-search-input" placeholder="Pesquisar respostas..." style="flex:1;" />
            <button id="is-btn-new" title="Nova Resposta" style="background:var(--inmovya-primary); color:white; border:none; border-radius:4px; padding:0 10px; cursor:pointer;">+ Nova</button>
          </div>
                    <div class="is-filter-actions" style="margin-top: 5px; display: flex; gap: 5px; width: 100%;">
            <select id="is-category-select" style="flex: 1;">
              <option value="all">Todas as categorias</option>
              ${this.categories.map(c => `<option value="${c.id}">${window.IS.escapeHTML(c.name)}</option>`).join('')}
            </select>
            <button id="is-settings-btn-main" title="Configurações (Adicionar respostas)" style="background: var(--inmovya-primary); color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; flex-shrink: 0;">
              ⚙️ Gerenciar
            </button>
            <button id="is-fav-filter" class="${this.showFavoritesOnly ? 'active' : ''}" title="Mostrar apenas favoritos">
              ⭐
            </button>
          </div>
        </div>
        
        <div id="is-replies-list"></div>
        </div> <!-- End main view -->
        
        <div id="is-settings-view" style="display:none; width:100%; height:calc(100% - 50px);">
          <iframe id="is-settings-iframe" src="" style="width:100%; height:100%; border:none; background:white;"></iframe>
        </div>
      </div>
    `;

    this.updateList();
  },

  updateList() {
    const listEl = document.getElementById('is-replies-list');
    if (!listEl) return;

    let filtered = this.replies;

    // Filter by favorites
    if (this.showFavoritesOnly) {
      filtered = filtered.filter(r => r.favorite);
    }

    // Filter by category
    if (this.activeCategory !== 'all') {
      filtered = filtered.filter(r => r.categoryId === this.activeCategory);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = window.IS.removeAccents(this.searchTerm.toLowerCase());
      filtered = filtered.filter(r => {
        const title = window.IS.removeAccents((r.title || "").toLowerCase());
        const shortcut = window.IS.removeAccents((r.shortcut || "").toLowerCase());
        const message = window.IS.removeAccents((r.message || "").toLowerCase());
        return title.includes(term) || shortcut.includes(term) || message.includes(term);
      });
    }

    // Sorting (Favorites first, then order or title)
    filtered.sort((a, b) => {
      if (this.settings.favoritesFirst) {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
      }
      return (a.order || 0) - (b.order || 0);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="is-empty-state">
          <p>${this.replies.length === 0 ? "Você ainda não possui respostas rápidas." : "Nenhuma resposta encontrada."}</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(reply => {
      const cat = this.categories.find(c => c.id === reply.categoryId) || window.IS.DEFAULT_CATEGORY;
      return `
        <div class="is-reply-item" data-id="${reply.id}">
          <div class="is-reply-header">
            <span class="is-reply-title">${reply.favorite ? '⭐ ' : ''}${window.IS.escapeHTML(reply.title)}</span>
            ${reply.shortcut ? `<span class="is-reply-shortcut">${window.IS.escapeHTML(reply.shortcut)}</span>` : ''}
          </div>
          <div class="is-reply-category">${window.IS.escapeHTML(cat.name)}</div>
          <div class="is-reply-preview">${window.IS.escapeHTML(reply.message).substring(0, 80)}...</div>
        </div>
      `;
    }).join('');

    // Attach click events
    listEl.querySelectorAll('.is-reply-item').forEach(item => {
      item.addEventListener('click', () => this.handleReplyClick(item.getAttribute('data-id')));
    });
  },

  async handleReplyClick(id) {
    const reply = this.replies.find(r => r.id === id);
    if (!reply) return;

    const contactName = window.IS.WhatsAppDOM.getCurrentChatName();
    const finalMessage = await window.IS.Variables.parseMessage(reply.message, contactName);

    const success = await window.IS.WhatsAppDOM.insertSequenceAndAttachments(finalMessage, reply.attachments);
    
    if (success) {
      this.showToast("Mensagem inserida.");
      // Increment usage count
      reply.usageCount = (reply.usageCount || 0) + 1;
      reply.lastUsedAt = new Date().toISOString();
      await window.IS.Storage.saveReplies(this.replies);
    }
  },

    setupListeners() {
    const toggleBtn = document.getElementById('is-toggle-button');
    const closeBtn = document.getElementById('is-close-btn');
    const searchInput = document.getElementById('is-search-input');
    const catSelect = document.getElementById('is-category-select');
    const favBtn = document.getElementById('is-fav-filter');
    const settingsBtnHeader = document.getElementById('is-settings-btn');
    const settingsBtnMain = document.getElementById('is-settings-btn-main');
    const mainView = document.getElementById('is-main-view');
    const settingsView = document.getElementById('is-settings-view');
    const iframe = document.getElementById('is-settings-iframe');
    
    let isSettingsOpen = false;
    
    const toggleSettings = (e) => {
      if(e) e.preventDefault();
      isSettingsOpen = !isSettingsOpen;
      if (isSettingsOpen) {
        if(mainView) mainView.style.display = 'none';
        if(settingsView) settingsView.style.display = 'block';
        if (iframe && (!iframe.src || iframe.src === window.location.href)) {
          iframe.src = chrome.runtime.getURL('popup/popup.html');
        }
      } else {
        if(mainView) mainView.style.display = 'flex';
        if(settingsView) settingsView.style.display = 'none';
        this.reloadData(); 
      }
    };

    if (settingsBtnHeader) settingsBtnHeader.addEventListener('click', toggleSettings);
    if (settingsBtnMain) settingsBtnMain.addEventListener('click', toggleSettings);

    if (toggleBtn) toggleBtn.addEventListener('click', () => this.togglePanel(true));
    if (closeBtn) closeBtn.addEventListener('click', () => this.togglePanel(false));
    
    if (searchInput) {
      searchInput.addEventListener('input', window.IS.debounce((e) => {
        this.searchTerm = e.target.value;
        this.updateList();
      }, 300));
    }

    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.activeCategory = e.target.value;
        this.updateList();
      });
    }

    if (favBtn) {
      favBtn.addEventListener('click', () => {
        this.showFavoritesOnly = !this.showFavoritesOnly;
        favBtn.classList.toggle('active', this.showFavoritesOnly);
        this.updateList();
      });
    }
    
    // Listen for storage changes to sync with popup
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        let changed = false;
        if (changes.replies) {
          this.replies = changes.replies.newValue || [];
          changed = true;
        }
        if (changes.categories) {
          this.categories = changes.categories.newValue || [];
          // Need to re-render to update the category select dropdown
          this.render(); 
        }
        if (changes.settings) {
          this.settings = { ...this.settings, ...changes.settings.newValue };
          changed = true;
        }
        if (changed) this.updateList();
      }
    });
  },

    toggle() {
    this.togglePanel(!this.isOpen);
  },
  togglePanel(open) {
    this.isOpen = open;
    const sidebar = document.getElementById('is-sidebar');
    const toggleBtn = document.getElementById('is-toggle-button');
    
    if (open) {
      sidebar.classList.add('is-open');
      toggleBtn.classList.add('is-hidden');
    } else {
      sidebar.classList.remove('is-open');
      toggleBtn.classList.remove('is-hidden');
    }
  },
  
  setupDragResizer() {
    const resizer = document.getElementById('is-resizer');
    const sidebar = document.getElementById('is-sidebar');
    if (!resizer || !sidebar) return;
    
    let isResizing = false;
    
    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      // Calculate width from the right edge
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 280) newWidth = 280;
      if (newWidth > 600) newWidth = 600;
      sidebar.style.width = newWidth + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        this.settings.panelWidth = parseInt(sidebar.style.width, 10);
        window.IS.Storage.saveSettings(this.settings);
      }
    });
  },
  
  showToast(message) {
    let toast = document.createElement('div');
    toast.className = 'is-toast';
    toast.textContent = message;
    this.container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};













