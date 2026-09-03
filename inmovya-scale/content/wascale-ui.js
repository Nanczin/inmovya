// content/wascale-ui.js
window.IS = window.IS || {};

window.IS.WaScaleUI = {
    if (!document.getElementById('is-wascale-hover-style')) {
      const style = document.createElement('style');
      style.id = 'is-wascale-hover-style';
      style.textContent = `
        .is-wascale-item-hover { transition: background 0.2s; }
        .is-wascale-item-hover:hover { background: var(--inmovya-hover, rgba(0,0,0,0.05)) !important; }
      `;
      document.head.appendChild(style);
    }
  observer: null,
  
  init() {
    window.IS.log("Iniciando interface nativa estilo WaScale...");
    this.startObserver();
  },
  
  startObserver() {
    this.observer = new MutationObserver(window.IS.debounce(() => {
      this.injectButton();
    }, 500));
    this.observer.observe(document.body, { childList: true, subtree: true });
  },

  injectButton() {
    const footer = document.querySelector('footer');
    if (!footer) return;
    
    if (document.getElementById('is-wascale-btn')) return;
    
    const leftContainer = footer.querySelector('div.copyable-area')?.parentElement || footer.firstElementChild;
    if (!leftContainer) return;
    
    const btn = document.createElement('div');
    btn.id = 'is-wascale-btn';
    btn.innerHTML = `
      <div role="button" title="Inmovya Scale (Respostas Rápidas)" style="padding: 8px; margin: 0 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s;">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="var(--inmovya-primary, #00a884)">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
        </svg>
      </div>
    `;
    
    if (leftContainer.firstChild) {
      leftContainer.insertBefore(btn, leftContainer.firstChild);
    } else {
      leftContainer.appendChild(btn);
    }
    
    btn.addEventListener('mouseenter', () => btn.style.opacity = '0.7');
    btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMenu(btn);
    });
  },

  async toggleMenu(anchor) {
    let menu = document.getElementById('is-wascale-menu');
    if (menu) {
      menu.remove();
      return;
    }
    
    menu = document.createElement('div');
    menu.id = 'is-wascale-menu';
    
    const isDark = document.body.classList.contains('dark');
    const bgColor = isDark ? '#202c33' : '#ffffff';
    const textColor = isDark ? '#e9edef' : '#111b21';
    const borderColor = isDark ? '#222d34' : '#d1d7db';
    
    Object.assign(menu.style, {
      position: 'absolute',
      bottom: '65px',
      left: '10px',
      width: '400px',
      height: '550px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: '10000',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    });
    
    anchor.parentNode.appendChild(menu);
    this.renderList();
    
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu) return;
        if (!menu.contains(e.target) && !anchor.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 100);
  },

  async renderList() {
    const menu = document.getElementById('is-wascale-menu');
    if (!menu) return;

    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e9edef' : '#111b21';
    const borderColor = isDark ? '#222d34' : '#d1d7db';
    const hoverColor = isDark ? '#2a3942' : '#f5f6f6';

    const replies = await window.IS.Storage.getReplies();

    let html = `
      <div style="padding: 12px 16px; background: ${isDark ? '#111b21' : '#f0f2f5'}; border-bottom: 1px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; color: ${textColor};">Inmovya Scale</span>
        <button id="is-btn-new-reply" style="background: #00a884; color: white; border: none; padding: 4px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;">+ Nova</button>
      </div>
      <div style="overflow-y: auto; flex: 1; padding: 8px;">
    `;
    
    if (replies.length === 0) {
      html += `<div style="padding: 16px; text-align: center; color: gray; font-size: 14px;">Você não possui mensagens prontas.</div>`;
    } else {
      replies.forEach(r => {
        html += `
          <div class="is-wascale-item is-wascale-item-hover" data-id="${r.id}" style="padding: 12px; cursor: pointer; border-radius: 6px; margin-bottom: 4px; transition: background 0.2s;" onmouseover="this.style.background='${hoverColor}'" onmouseout="this.style.background='transparent'">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: ${textColor};">${r.favorite ? '⭐ ' : ''}${window.IS.escapeHTML(r.title)}</div>
            <div style="font-size: 13px; color: gray; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${window.IS.escapeHTML(r.message)}</div>
          </div>
        `;
      });
    }
    
    html += `</div>`;
    menu.innerHTML = html;

    // Nova Resposta
    document.getElementById('is-btn-new-reply').addEventListener('click', (e) => {
      e.stopPropagation();
      this.renderForm();
    });

    // Clicar em resposta
    menu.querySelectorAll('.is-wascale-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = item.getAttribute('data-id');
        const reply = replies.find(r => r.id === id);
        if (reply) {
          const contactName = window.IS.WhatsAppDOM.getCurrentChatName();
          const finalMessage = await window.IS.Variables.parseMessage(reply.message, contactName);
          window.IS.WhatsAppDOM.insertMessage(finalMessage);
        }
        menu.remove();
      });
    });
  },

  async renderForm() {
    const menu = document.getElementById('is-wascale-menu');
    if (!menu) return;

    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e9edef' : '#111b21';
    const borderColor = isDark ? '#222d34' : '#d1d7db';
    const inputBg = isDark ? '#2a3942' : '#ffffff';

    const categories = await window.IS.Storage.getCategories();
    let catOptions = categories.map(c => `<option value="${c.id}">${window.IS.escapeHTML(c.name)}</option>`).join('');

    menu.innerHTML = `
      <div style="padding: 12px 16px; background: ${isDark ? '#111b21' : '#f0f2f5'}; border-bottom: 1px solid ${borderColor}; display: flex; align-items: center; gap: 10px;">
        <button id="is-btn-back" style="background: transparent; border: none; color: #00a884; cursor: pointer; font-size: 16px;">←</button>
        <span style="font-weight: bold; color: ${textColor}; flex: 1;">Criar Mensagem</span>
      </div>
      <div style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
        
        <div>
          <label style="font-size: 12px; color: gray; margin-bottom: 4px; display: block;">Título / Atalho (ex: /oi)</label>
          <input type="text" id="is-form-title" placeholder="Título" style="width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid ${borderColor}; background: ${inputBg}; color: ${textColor}; outline: none;">
        </div>

        <div>
          <label style="font-size: 12px; color: gray; margin-bottom: 4px; display: flex; justify-content: space-between;">
            Categoria
            <span id="is-btn-add-cat" style="color: #00a884; cursor: pointer;">+ Nova Categoria</span>
          </label>
          <select id="is-form-cat" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid ${borderColor}; background: ${inputBg}; color: ${textColor}; outline: none;">
            <option value="">Sem categoria</option>
            ${catOptions}
          </select>
        </div>

        <div style="display: none; gap: 8px;" id="is-new-cat-container">
          <input type="text" id="is-new-cat-name" placeholder="Nome da categoria" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid ${borderColor}; background: ${inputBg}; color: ${textColor}; outline: none;">
          <button id="is-btn-save-cat" style="background: #00a884; color: white; border: none; padding: 0 12px; border-radius: 6px; cursor: pointer;">Salvar</button>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column;">
          <label style="font-size: 12px; color: gray; margin-bottom: 4px; display: block;">Mensagem (use {{nome}} para Saudação)</label>
          <textarea id="is-form-msg" placeholder="Sua mensagem..." style="flex: 1; min-height: 120px; width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid ${borderColor}; background: ${inputBg}; color: ${textColor}; outline: none; resize: none;"></textarea>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <label style="font-size: 12px; color: gray; margin-bottom: 4px; display: block;">Anexos (Opcional)</label>
          <input type="file" id="is-form-attachments" multiple style="width: 100%; box-sizing: border-box; padding: 4px; border-radius: 6px; border: 1px solid ${borderColor}; background: ${inputBg}; color: ${textColor}; outline: none;">
          <div id="is-form-attachments-preview" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;"></div>
        </div>

        <button id="is-btn-save" style="width: 100%; padding: 12px; background: #00a884; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: auto;">Salvar Mensagem</button>
      </div>
    `;

    document.getElementById('is-btn-back').addEventListener('click', (e) => {
      e.stopPropagation();
      this.renderList();
    });

    // Adicionar Categoria Toggle
    document.getElementById('is-btn-add-cat').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('is-new-cat-container').style.display = 'flex';
      document.getElementById('is-new-cat-name').focus();
    });

    // Salvar Nova Categoria
    document.getElementById('is-btn-save-cat').addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = document.getElementById('is-new-cat-name').value.trim();
      if (!name) return;
      const id = 'cat_' + Date.now();
      const cats = await window.IS.Storage.getCategories();
      cats.push({ id, name });
      await window.IS.Storage.saveCategories(cats);
      
      const select = document.getElementById('is-form-cat');
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      select.appendChild(opt);
      select.value = id;
      
      document.getElementById('is-new-cat-container').style.display = 'none';
      document.getElementById('is-new-cat-name').value = '';
    });

        let currentAttachments = [];

    const fileInput = document.getElementById('is-form-attachments');
    const previewContainer = document.getElementById('is-form-attachments-preview');

    function renderAttachmentsPreview() {
      previewContainer.innerHTML = currentAttachments.map((att, idx) => `
        <div style="position: relative; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
          ${window.IS.escapeHTML(att.name)}
          <span class="is-btn-remove-att" data-idx="${idx}" style="color: red; cursor: pointer; margin-left: 8px;">x</span>
        </div>
      `).join('');
    }

    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      for (let file of files) {
        if (file.size > 5 * 1024 * 1024) continue; // max 5mb
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
        });
        currentAttachments.push({ name: file.name, type: file.type, data: base64 });
      }
      renderAttachmentsPreview();
      e.target.value = '';
    });

    previewContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('is-btn-remove-att')) {
        const idx = e.target.getAttribute('data-idx');
        currentAttachments.splice(idx, 1);
        renderAttachmentsPreview();
      }
    });

    // Impedir que cliques no form fechem o menu
    menu.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('click', e => e.stopPropagation());
    });

    // Salvar Mensagem
    document.getElementById('is-btn-save').addEventListener('click', async (e) => {
      e.stopPropagation();
      const title = document.getElementById('is-form-title').value.trim();
      const message = document.getElementById('is-form-msg').value.trim();
      const categoryId = document.getElementById('is-form-cat').value;

      if (!title || !message) {
        alert("Preencha título e mensagem!");
        return;
      }

      const replies = await window.IS.Storage.getReplies();
      replies.push({
        id: 'reply_' + Date.now(),
        title,
        message,
        categoryId,
        shortcut: title.startsWith('/') ? title : '',
        favorite: false, attachments: currentAttachments,
        usageCount: 0
      });

      await window.IS.Storage.saveReplies(replies);
      this.renderList();
    });
  }
};




