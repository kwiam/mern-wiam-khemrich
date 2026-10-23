// ---- Configuration non secrète (URLs centralisées) ----
const CONFIG = {
  BACKENDS: [
    'https://mern-wiam-khemrich-backend.vercel.app',   // principal
    'https://mern-api-wiam.khemrich.workers.dev',      // secours
  ],
  TIMEOUT_MS: 6000,
};

// Aide pour la démonstration : ?test=B (principal HS) ou ?test=C (les deux HS)
const TEST_MODE = new URLSearchParams(location.search).get('test');
const BAD_URL = 'https://backend-indisponible.invalid';
if (TEST_MODE === 'B') CONFIG.BACKENDS[0] = BAD_URL;
if (TEST_MODE === 'C') CONFIG.BACKENDS = [BAD_URL, BAD_URL + '/secours'];

// ---- Appel avec bascule automatique ----
async function fetchWithFallback(path, options = {}) {
  const errors = [];
  for (const base of CONFIG.BACKENDS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    try {
      const response = await fetch(base + path, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return { data: await response.json(), backend: base };
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'délai dépassé' : err.message;
      errors.push(base + ' : ' + reason);
      console.warn('Échec sur', base, '-', reason);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Aucun serveur disponible. ' + errors.join(' | '));
}

// ---- Interface ----
const form = document.getElementById('item-form');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('items');
let pendingRequestId = null; // même clé réutilisée tant que le POST n'a pas réussi

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'error' : '';
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
    const { data, backend } = await fetchWithFallback('/api/items');
    render(data);
    setStatus('Serveur utilisé : ' + backend);
  } catch (e) {
    render([]);
    setStatus('Impossible de joindre les serveurs. Réessayez plus tard.', true);
    console.error(e);
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = form.querySelector('button');
  btn.disabled = true;
  pendingRequestId = pendingRequestId || crypto.randomUUID();
  try {
    await fetchWithFallback('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pendingRequestId },
      body: JSON.stringify({
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
      }),
    });
    pendingRequestId = null;
    form.reset();
    await loadItems();
  } catch (e) {
    setStatus("L'élément n'a pas pu être ajouté : aucun serveur ne répond.", true);
    console.error(e);
  } finally {
    btn.disabled = false;
  }
});

loadItems();