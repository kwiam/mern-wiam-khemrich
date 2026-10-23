// ---- Configuration non secrète (URLs centralisées) ----
const CONFIG = {
  BACKENDS: ['http://localhost:3000'], // sera complété avec les URLs Vercel et Cloudflare
  TIMEOUT_MS: 6000,
};
const API_URL = CONFIG.BACKENDS[0];

const form = document.getElementById('item-form');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('items');

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'error' : '';
}

async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  try {
    const response = await fetch(API_URL + path, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error('Erreur HTTP ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function render(items) {
  listEl.replaceChildren(...items.map((it) => {
    const li = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = it.name;
    const desc = document.createElement('p');
    desc.textContent = it.description || '';
    li.append(title, desc);
    return li;
  }));
}

async function loadItems() {
  try {
    setStatus('Chargement…');
    render(await apiFetch('/api/items'));
    setStatus('');
  } catch (e) {
    setStatus('Impossible de charger les éléments : ' + e.message, true);
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = form.querySelector('button');
  btn.disabled = true;
  try {
    await apiFetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
      }),
    });
    form.reset();
    await loadItems();
  } catch (e) {
    setStatus("Impossible d'ajouter l'élément : " + e.message, true);
  } finally {
    btn.disabled = false;
  }
});

loadItems();