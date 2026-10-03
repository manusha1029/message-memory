/**
 * Message Memory v4 — Application Controller
 */

import { parseWhatsAppChat } from './parser.js';
import { vaultStorage, CATEGORIES } from './storage.js';
import { localAI } from './ai.js';
import { SAMPLE_CHAT_TEXT } from './sample_data.js';

class App {
  constructor() {
    this.messages = [];
    this.currentCategoryFilter = 'All';
    this.currentSearchQuery = '';
    this.editingMemoryId = null;
    this.deletingMemoryId = null;

    this.initElements();
    this.bindEvents();
    this.renderVault();
    this.updateCategoryPills();
  }

  initElements() {
    // Import Section
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.btnLoadSample = document.getElementById('btnLoadSample');
    this.chatMetaBar = document.getElementById('chatMetaBar');
    this.metaMsgCount = document.getElementById('metaMsgCount');
    this.metaParticipants = document.getElementById('metaParticipants');
    this.metaDateSpan = document.getElementById('metaDateSpan');

    // Search & Ask Section
    this.chatSearchInput = document.getElementById('chatSearchInput');
    this.chatSearchResults = document.getElementById('chatSearchResults');
    this.chatQuestionInput = document.getElementById('chatQuestionInput');
    this.btnAskQuestion = document.getElementById('btnAskQuestion');
    this.aiAnswerContainer = document.getElementById('aiAnswerContainer');
    this.aiAnswerText = document.getElementById('aiAnswerText');
    this.aiEvidenceList = document.getElementById('aiEvidenceList');

    // Memory Vault Section
    this.btnExtractMemories = document.getElementById('btnExtractMemories');
    this.btnAddManualMemory = document.getElementById('btnAddManualMemory');
    this.vaultSearchInput = document.getElementById('vaultSearchInput');
    this.categoryFilterBar = document.getElementById('categoryFilterBar');
    this.memoryGrid = document.getElementById('memoryGrid');
    this.aiLoaderBar = document.getElementById('aiLoaderBar');
    this.aiLoaderText = document.getElementById('aiLoaderText');
    this.vaultBadgeCount = document.getElementById('vaultBadgeCount');
    this.modelStatusIndicator = document.getElementById('modelStatusIndicator');
    this.modelStatusText = document.getElementById('modelStatusText');

    // Modals
    this.editModalOverlay = document.getElementById('editModalOverlay');
    this.editForm = document.getElementById('editForm');
    this.editTitle = document.getElementById('editTitle');
    this.editCategory = document.getElementById('editCategory');
    this.editSummary = document.getElementById('editSummary');
    this.editPeople = document.getElementById('editPeople');
    this.editDate = document.getElementById('editDate');
    this.editEvidence = document.getElementById('editEvidence');
    this.btnCloseEditModal = document.getElementById('btnCloseEditModal');
    this.btnCancelEdit = document.getElementById('btnCancelEdit');

    this.confirmModalOverlay = document.getElementById('confirmModalOverlay');
    this.btnCloseConfirmModal = document.getElementById('btnCloseConfirmModal');
    this.btnCancelDelete = document.getElementById('btnCancelDelete');
    this.btnConfirmDelete = document.getElementById('btnConfirmDelete');

    this.toastContainer = document.getElementById('toastContainer');
  }

  bindEvents() {
    // Drag & Drop
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('dragover');
    });
    this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragover'));
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        this.handleFileUpload(e.dataTransfer.files[0]);
      }
    });
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.handleFileUpload(e.target.files[0]);
      }
    });

    // Sample Chat Loader
    this.btnLoadSample.addEventListener('click', () => this.loadSampleChat());

    // Conversation Search
    this.chatSearchInput.addEventListener('input', (e) => this.handleChatSearch(e.target.value));

    // Conversation QA
    this.btnAskQuestion.addEventListener('click', () => this.handleAskQuestion());
    this.chatQuestionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAskQuestion();
    });

    // Vault Memory Extraction
    this.btnExtractMemories.addEventListener('click', () => this.handleExtractMemories());

    // Vault Manual Add
    this.btnAddManualMemory.addEventListener('click', () => this.openAddModal());

    // Vault Search
    this.vaultSearchInput.addEventListener('input', (e) => {
      this.currentSearchQuery = e.target.value;
      this.renderVault();
    });

    // Model Progress Hook
    localAI.onProgress((info) => {
      this.modelStatusText.textContent = info.message || 'Model Active';
      if (info.status === 'downloading') {
        this.modelStatusIndicator.className = 'status-indicator-dot loading';
      } else if (info.status === 'ready') {
        this.modelStatusIndicator.className = 'status-indicator-dot active';
      }
    });

    // Storage update event
    window.addEventListener('vault:updated', () => {
      this.renderVault();
      this.updateCategoryPills();
    });

    // Edit Modal events
    this.btnCloseEditModal.addEventListener('click', () => this.closeEditModal());
    this.btnCancelEdit.addEventListener('click', () => this.closeEditModal());
    this.editForm.addEventListener('submit', (e) => this.handleSaveEdit(e));

    // Confirm Modal events
    this.btnCloseConfirmModal.addEventListener('click', () => this.closeConfirmModal());
    this.btnCancelDelete.addEventListener('click', () => this.closeConfirmModal());
    this.btnConfirmDelete.addEventListener('click', () => this.executeDelete());
  }

  /* ---------------- Chat Processing ---------------- */
  handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.processChatText(text, file.name);
    };
    reader.readAsText(file);
  }

  async loadSampleChat() {
    try {
      if (SAMPLE_CHAT_TEXT) {
        this.processChatText(SAMPLE_CHAT_TEXT, 'sample_chat.txt');
        this.showToast('Sample WhatsApp chat loaded successfully.');
        return;
      }
      const res = await fetch('data/sample_chat.txt');
      const text = await res.text();
      this.processChatText(text, 'sample_chat.txt');
      this.showToast('Sample WhatsApp chat loaded successfully.');
    } catch (e) {
      console.warn('Failed to fetch sample_chat.txt, using inline text', e);
      this.processChatText(SAMPLE_CHAT_TEXT, 'sample_chat.txt');
    }
  }

  processChatText(rawText, filename) {
    this.messages = parseWhatsAppChat(rawText);

    if (this.messages.length === 0) {
      this.showToast('No messages recognized in this file.');
      return;
    }

    const senders = [...new Set(this.messages.map(m => m.sender))];
    const dates = [...new Set(this.messages.map(m => m.date))];

    this.chatMetaBar.style.display = 'flex';
    this.metaMsgCount.textContent = this.messages.length;
    this.metaParticipants.textContent = senders.join(', ');
    this.metaDateSpan.textContent = dates.length > 1 ? `${dates[0]} — ${dates[dates.length - 1]}` : (dates[0] || 'Unknown');

    // Populate initial conversation search preview
    this.handleChatSearch('');
    this.showToast(`Loaded ${this.messages.length} messages from ${filename}`);
  }

  handleChatSearch(query) {
    const q = (query || '').trim().toLowerCase();
    if (!this.messages.length) {
      this.chatSearchResults.innerHTML = '<div style="color: var(--text-subtle); text-align: center; padding: 40px 0;">Import a chat file to search messages.</div>';
      return;
    }

    const filtered = q
      ? this.messages.filter(m => m.text.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q))
      : this.messages.slice(0, 15);

    if (filtered.length === 0) {
      this.chatSearchResults.innerHTML = '<div style="color: var(--text-subtle); text-align: center; padding: 40px 0;">No matching messages found.</div>';
      return;
    }

    this.chatSearchResults.innerHTML = filtered.map(m => {
      let displayText = this.escapeHtml(m.text);
      if (q) {
        const regex = new RegExp(`(${this.escapeRegex(q)})`, 'gi');
        displayText = displayText.replace(regex, '<span class="highlight">$1</span>');
      }

      return `
        <div class="chat-bubble">
          <div class="chat-bubble-header">
            <span class="chat-bubble-sender">${this.escapeHtml(m.sender)}</span>
            <span>${this.escapeHtml(m.dateTimeStr)}</span>
          </div>
          <div class="chat-bubble-text">${displayText}</div>
        </div>
      `;
    }).join('');
  }

  async handleAskQuestion() {
    const question = this.chatQuestionInput.value.trim();
    if (!question) return;

    if (!this.messages.length) {
      this.showToast('Please import a chat conversation first.');
      return;
    }

    this.aiAnswerText.textContent = 'Thinking with Qwen2.5 (100% in-browser)...';
    this.aiEvidenceList.innerHTML = '';
    this.btnAskQuestion.disabled = true;

    try {
      const result = await localAI.answerQuestion(question, this.messages);
      this.aiAnswerText.textContent = result.answer;

      if (result.evidence && result.evidence.length > 0) {
        this.aiEvidenceList.innerHTML = `
          <div class="evidence-tag-title">Verified Evidence Citations:</div>
          ${result.evidence.map(e => `
            <div class="evidence-item-pill">
              <strong>${this.escapeHtml(e.sender)}</strong> (${e.dateTimeStr}): "${this.escapeHtml(e.text)}"
            </div>
          `).join('')}
        `;
      }
    } catch (e) {
      this.aiAnswerText.textContent = 'Error answering question. Check console logs.';
      console.error(e);
    } finally {
      this.btnAskQuestion.disabled = false;
    }
  }

  /* ---------------- Memory Vault Operations ---------------- */
  async handleExtractMemories() {
    if (!this.messages || this.messages.length === 0) {
      this.showToast('Please import a WhatsApp conversation first.');
      return;
    }

    this.aiLoaderBar.classList.add('active');
    this.aiLoaderText.textContent = 'Analyzing conversation and extracting structured memory cards...';
    this.btnExtractMemories.disabled = true;

    try {
      const extracted = await localAI.extractMemories(this.messages);
      const count = vaultStorage.addBatch(extracted);

      this.showToast(`Extracted and saved ${count} new memories to Vault.`);
      this.renderVault();
      this.updateCategoryPills();
    } catch (e) {
      console.error('Extraction error:', e);
      this.showToast('Extraction failed. Check browser console.');
    } finally {
      this.aiLoaderBar.classList.remove('active');
      this.btnExtractMemories.disabled = false;
    }
  }

  renderVault() {
    const memories = vaultStorage.search({
      query: this.currentSearchQuery,
      category: this.currentCategoryFilter
    });

    const allMemories = vaultStorage.getAll();
    this.vaultBadgeCount.textContent = `${allMemories.length} Saved`;

    if (memories.length === 0) {
      this.memoryGrid.innerHTML = `
        <div class="vault-empty-state">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div class="empty-title">No memories found</div>
          <p class="empty-desc">
            ${this.currentSearchQuery ? 'Try a different search query or clear your filter.' : 'Click "Extract memories from this chat" or add a memory manually to start building your vault.'}
          </p>
        </div>
      `;
      return;
    }

    this.memoryGrid.innerHTML = memories.map(mem => this.renderMemoryCardHtml(mem)).join('');
    this.bindCardActionEvents();
  }

  renderMemoryCardHtml(mem) {
    const catSlug = (mem.category || 'other').toLowerCase().replace(/\s+/g, '-');
    const isPinned = !!mem.isPinned;
    const peopleStr = Array.isArray(mem.people) && mem.people.length > 0 ? mem.people.join(', ') : 'Everyone';
    const createdStr = mem.createdAt ? new Date(mem.createdAt).toLocaleDateString('en-GB') : '';

    return `
      <div class="memory-card ${isPinned ? 'pinned' : ''}" data-id="${mem.id}">
        <div class="memory-card-top">
          <span class="category-badge cat-${catSlug}">${this.escapeHtml(mem.category || 'Other')}</span>
          <div class="card-top-actions">
            <button class="pin-btn ${isPinned ? 'is-pinned' : ''}" data-action="pin" title="${isPinned ? 'Unpin Memory' : 'Pin to top'}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>

        <h3 class="memory-card-title">${this.escapeHtml(mem.title)}</h3>
        <p class="memory-card-summary">${this.escapeHtml(mem.summary)}</p>

        <div class="memory-card-meta">
          <span>${this.escapeHtml(peopleStr)}</span>
          <span class="meta-dot">·</span>
          <span>${this.escapeHtml(mem.date || '')}</span>
        </div>

        ${mem.evidence ? `
          <div class="source-evidence-box">
            <div class="source-header">Source Evidence</div>
            <div class="source-text">"${this.escapeHtml(mem.evidence)}"</div>
          </div>
        ` : ''}

        <div class="memory-card-footer">
          <span>Saved ${createdStr}</span>
          <div class="card-action-btns">
            <button class="card-icon-btn" data-action="edit" title="Edit Memory">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit
            </button>
            <button class="card-icon-btn danger" data-action="delete" title="Delete Memory">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindCardActionEvents() {
    this.memoryGrid.querySelectorAll('.memory-card').forEach(card => {
      const id = card.dataset.id;

      const pinBtn = card.querySelector('[data-action="pin"]');
      if (pinBtn) {
        pinBtn.addEventListener('click', () => {
          const isPinned = vaultStorage.togglePin(id);
          this.showToast(isPinned ? 'Memory pinned to top' : 'Memory unpinned');
        });
      }

      const editBtn = card.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener('click', () => this.openEditModal(id));
      }

      const deleteBtn = card.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.openDeleteConfirm(id));
      }
    });
  }

  updateCategoryPills() {
    const counts = vaultStorage.getCategoryCounts();
    const categoriesWithAll = ['All', ...CATEGORIES];

    this.categoryFilterBar.innerHTML = categoriesWithAll.map(cat => {
      const count = counts[cat] || 0;
      const isActive = this.currentCategoryFilter.toLowerCase() === cat.toLowerCase();
      return `
        <button class="category-filter-pill ${isActive ? 'active' : ''}" data-category="${cat}">
          <span>${cat}</span>
          <span class="filter-count">${count}</span>
        </button>
      `;
    }).join('');

    this.categoryFilterBar.querySelectorAll('.category-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCategoryFilter = btn.dataset.category;
        this.updateCategoryPills();
        this.renderVault();
      });
    });
  }

  /* ---------------- Modals & CRUD ---------------- */
  openAddModal() {
    this.editingMemoryId = null;
    document.getElementById('modalHeading').textContent = 'Create New Memory';
    this.editTitle.value = '';
    this.editCategory.value = 'Recommendation';
    this.editSummary.value = '';
    this.editPeople.value = '';
    this.editDate.value = new Date().toLocaleDateString('en-GB');
    this.editEvidence.value = '';
    this.editModalOverlay.classList.add('active');
  }

  openEditModal(id) {
    const mem = vaultStorage.getById(id);
    if (!mem) return;

    this.editingMemoryId = id;
    document.getElementById('modalHeading').textContent = 'Edit Memory Card';
    this.editTitle.value = mem.title || '';
    this.editCategory.value = mem.category || 'Other';
    this.editSummary.value = mem.summary || '';
    this.editPeople.value = Array.isArray(mem.people) ? mem.people.join(', ') : (mem.people || '');
    this.editDate.value = mem.date || '';
    this.editEvidence.value = mem.evidence || '';
    this.editModalOverlay.classList.add('active');
  }

  closeEditModal() {
    this.editModalOverlay.classList.remove('active');
    this.editingMemoryId = null;
  }

  handleSaveEdit(e) {
    e.preventDefault();
    const title = this.editTitle.value.trim();
    if (!title) return;

    const data = {
      title,
      category: this.editCategory.value,
      summary: this.editSummary.value.trim(),
      people: this.editPeople.value.split(',').map(s => s.trim()).filter(Boolean),
      date: this.editDate.value.trim(),
      evidence: this.editEvidence.value.trim(),
      sourceMessage: this.editEvidence.value.trim()
    };

    if (this.editingMemoryId) {
      vaultStorage.update(this.editingMemoryId, data);
      this.showToast('Memory updated.');
    } else {
      vaultStorage.add(data);
      this.showToast('New memory added to Vault.');
    }

    this.closeEditModal();
    this.renderVault();
    this.updateCategoryPills();
  }

  openDeleteConfirm(id) {
    this.deletingMemoryId = id;
    this.confirmModalOverlay.classList.add('active');
  }

  closeConfirmModal() {
    this.confirmModalOverlay.classList.remove('active');
    this.deletingMemoryId = null;
  }

  executeDelete() {
    if (this.deletingMemoryId) {
      vaultStorage.delete(this.deletingMemoryId);
      this.showToast('Memory deleted.');
      this.closeConfirmModal();
      this.renderVault();
      this.updateCategoryPills();
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-lime)" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${this.escapeHtml(message)}</span>
    `;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Bootstrap safely regardless of readyState
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.messageMemoryApp = new App();
  });
} else {
  window.messageMemoryApp = new App();
}
