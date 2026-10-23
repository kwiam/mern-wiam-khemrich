require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const items = [{ id: 1, name: 'Exemple', description: 'Élément de démonstration' }];

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: "L'API répond", timestamp: new Date().toISOString() });
});

app.get('/api/items', (req, res) => res.json(items));

app.post('/api/items', (req, res) => {
  const { name, description = '' } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
    return res.status(400).json({ error: 'Le champ "name" est requis (1 à 100 caractères)' });
  if (typeof description !== 'string' || description.length > 500)
    return res.status(400).json({ error: 'La description doit faire 500 caractères maximum' });
  const item = { id: items.length + 1, name: name.trim(), description: description.trim() };
  items.push(item);
  res.status(201).json(item);
});

app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => console.log(`API sur le port ${PORT}`));