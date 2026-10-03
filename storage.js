/**
 * Persistent Memory Vault Storage Engine (v4)
 * Uses browser localStorage. No data is sent to any server.
 */

const STORAGE_KEY = 'message_memory_vault_v4';

export const CATEGORIES = [
  'Recommendation',
  'Plan',
  'Decision',
  'Important Fact',
  'Resource',
  'Place',
  'Preference',
  'Other'
];

export const CATEGORY_MAP = {
  'recommendations': 'Recommendation',
  'plans': 'Plan',
  'decisions': 'Decision',
  'facts': 'Important Fact',
  'resources': 'Resource',
  'places': 'Place',
  'preferences': 'Preference',
  'all': 'All'
};

const DEFAULT_SEEDS = [
  {
    id: 'mem_seed_1',
    title: 'Zaitoon Biryani',
    category: 'Recommendation',
    summary: 'Arun recommended Zaitoon and said their chicken biryani is good.',
    people: ['Arun'],
    date: '12/03/2026',
    evidence: 'Zaitoon. My cousin said the chicken biryani is good.',
    sourceMessage: 'Arun: Zaitoon. My cousin said the chicken biryani is good and the Arabian platter is worth trying.',
    createdAt: '2026-10-03T08:30:00.000Z',
    isPinned: true
  },
  {
    id: 'mem_seed_2',
    title: 'Coorg Weekend Road Trip',
    category: 'Plan',
    summary: 'Trip confirmed for March 21st to 23rd. Rahul is driving the SUV and leaving at 5:30 AM.',
    people: ['Arun', 'Priya', 'Rahul', 'Sneha'],
    date: '12/03/2026',
    evidence: 'Final decision: Coorg trip confirmed for March 21st to 23rd. Rahul is driving the SUV.',
    sourceMessage: 'Arun: Agreed. Final decision: Coorg trip confirmed for March 21st to 23rd. Rahul is driving the SUV.',
    createdAt: '2026-10-03T08:32:00.000Z',
    isPinned: true
  },
  {
    id: 'mem_seed_3',
    title: 'Breakfast at Bidadi Tatte Idli',
    category: 'Decision',
    summary: 'Stop at Sri Renukamba Thatte Idli in Bidadi for breakfast on the road trip.',
    people: ['Priya', 'Arun'],
    date: '12/03/2026',
    evidence: 'Bidadi Tatte Idli is the best stop for road trips. Let\'s do Sri Renukamba Thatte Idli.',
    sourceMessage: 'Priya: Bidadi Tatte Idli is the best stop for road trips. Let\'s do Sri Renukamba Thatte Idli.',
    createdAt: '2026-10-03T08:35:00.000Z',
    isPinned: false
  },
  {
    id: 'mem_seed_4',
    title: 'Transformers.js WebGPU Offline LLM',
    category: 'Resource',
    summary: 'HuggingFace Transformers.js v3 enables local Qwen2.5 execution inside the browser without backend servers.',
    people: ['Rahul'],
    date: '12/03/2026',
    evidence: 'https://huggingface.co/docs/transformers.js - it runs Qwen2.5 directly in WebGPU without any backend server.',
    sourceMessage: 'Rahul: Yes! Check out HuggingFace Transformers.js v3 at https://huggingface.co/docs/transformers.js - it runs Qwen2.5 directly in WebGPU without any backend server.',
    createdAt: '2026-10-03T08:40:00.000Z',
    isPinned: false
  }
];

export class MemoryVaultStorage {
  constructor() {
    this.init();
  }

  init() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      this.saveAll(DEFAULT_SEEDS);
    }
  }

  getAll() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const list = JSON.parse(data);
      // Sort pinned memories first, then newest createdAt first
      return list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } catch (e) {
      console.error('Failed to parse memories from localStorage:', e);
      return [];
    }
  }

  saveAll(memories) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
      window.dispatchEvent(new CustomEvent('vault:updated'));
      return true;
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      return false;
    }
  }

  getById(id) {
    const list = this.getAll();
    return list.find(m => m.id === id) || null;
  }

  add(memory) {
    const list = this.getAll();
    const newRecord = {
      id: memory.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      title: memory.title || 'Untitled Memory',
      category: memory.category || 'Other',
      summary: memory.summary || '',
      people: Array.isArray(memory.people) ? memory.people : (memory.people ? [memory.people] : []),
      date: memory.date || new Date().toLocaleDateString('en-GB'),
      evidence: memory.evidence || '',
      sourceMessage: memory.sourceMessage || memory.evidence || '',
      createdAt: memory.createdAt || new Date().toISOString(),
      isPinned: !!memory.isPinned
    };

    // Avoid duplicate title + evidence
    const isDuplicate = list.some(
      item => item.title.toLowerCase() === newRecord.title.toLowerCase() &&
              item.evidence.toLowerCase() === newRecord.evidence.toLowerCase()
    );

    if (!isDuplicate) {
      list.unshift(newRecord);
      this.saveAll(list);
      return newRecord;
    }
    return null;
  }

  addBatch(memories) {
    let addedCount = 0;
    const list = this.getAll();

    for (const mem of memories) {
      const newRecord = {
        id: mem.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        title: (mem.title || 'Untitled Memory').trim(),
        category: mem.category || 'Other',
        summary: (mem.summary || '').trim(),
        people: Array.isArray(mem.people) ? mem.people : (mem.people ? [mem.people] : []),
        date: mem.date || new Date().toLocaleDateString('en-GB'),
        evidence: (mem.evidence || '').trim(),
        sourceMessage: (mem.sourceMessage || mem.evidence || '').trim(),
        createdAt: mem.createdAt || new Date().toISOString(),
        isPinned: false
      };

      const isDuplicate = list.some(
        item => item.title.toLowerCase() === newRecord.title.toLowerCase() &&
                item.evidence.toLowerCase() === newRecord.evidence.toLowerCase()
      );

      if (!isDuplicate) {
        list.push(newRecord);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this.saveAll(list);
    }
    return addedCount;
  }

  update(id, updates) {
    const list = this.getAll();
    const index = list.findIndex(m => m.id === id);
    if (index === -1) return false;

    list[index] = {
      ...list[index],
      ...updates,
      people: Array.isArray(updates.people)
        ? updates.people
        : (typeof updates.people === 'string'
            ? updates.people.split(',').map(s => s.trim()).filter(Boolean)
            : list[index].people)
    };

    this.saveAll(list);
    return list[index];
  }

  delete(id) {
    const list = this.getAll();
    const updated = list.filter(m => m.id !== id);
    if (updated.length !== list.length) {
      this.saveAll(updated);
      return true;
    }
    return false;
  }

  togglePin(id) {
    const list = this.getAll();
    const item = list.find(m => m.id === id);
    if (item) {
      item.isPinned = !item.isPinned;
      this.saveAll(list);
      return item.isPinned;
    }
    return false;
  }

  search({ query = '', category = 'All' }) {
    let list = this.getAll();
    const q = query.trim().toLowerCase();

    if (category && category !== 'All') {
      list = list.filter(m => {
        if (!m.category) return false;
        return m.category.toLowerCase() === category.toLowerCase();
      });
    }

    if (q) {
      list = list.filter(m => {
        const titleMatch = (m.title || '').toLowerCase().includes(q);
        const summaryMatch = (m.summary || '').toLowerCase().includes(q);
        const categoryMatch = (m.category || '').toLowerCase().includes(q);
        const evidenceMatch = (m.evidence || '').toLowerCase().includes(q);
        const peopleMatch = Array.isArray(m.people) && m.people.some(p => p.toLowerCase().includes(q));
        const dateMatch = (m.date || '').toLowerCase().includes(q);

        return titleMatch || summaryMatch || categoryMatch || evidenceMatch || peopleMatch || dateMatch;
      });
    }

    return list;
  }

  getCategoryCounts() {
    const list = this.getAll();
    const counts = { All: list.length };

    for (const cat of CATEGORIES) {
      counts[cat] = 0;
    }

    for (const m of list) {
      const cat = m.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    }

    return counts;
  }

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('vault:updated'));
  }
}

export const vaultStorage = new MemoryVaultStorage();
