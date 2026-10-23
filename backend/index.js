require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origine non autorisée'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));
app.use(express.json({ limit: '10kb' }));

// --- Schéma et modèle ---
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  requestId: { type: String, index: { unique: true, sparse: true } }, // idempotence
}, { timestamps: true });
const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);

// --- Connexion (réutilisée entre requêtes, utile en serverless) ---
let connPromise;
function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI manquante');
  if (!connPromise) {
    connPromise = mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
      .catch((e) => { connPromise = null; throw e; });
  }
  return connPromise;
}
async function requireDb(req, res, next) {
  try { await connectDB(); next(); }
  catch (e) { console.error(e.message); res.status(503).json({ error: 'Base de données indisponible' }); }
}

// --- Routes ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', service: 'express',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/items', requireDb);

app.get('/api/items', async (req, res, next) => {
  try { res.json(await Item.find().sort({ createdAt: -1 }).limit(100).lean()); }
  catch (e) { next(e); }
});

app.post('/api/items', async (req, res, next) => {
  try {
    const { name, description = '' } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
      return res.status(400).json({ error: 'Le champ "name" est requis (1 à 100 caractères)' });
    if (typeof description !== 'string' || description.length > 500)
      return res.status(400).json({ error: 'Description : 500 caractères maximum' });

    const requestId = req.get('Idempotency-Key') || req.body.requestId;
    if (requestId !== undefined && !/^[\w-]{8,64}$/.test(requestId))
      return res.status(400).json({ error: 'Idempotency-Key invalide' });

    if (requestId) {
      const existing = await Item.findOne({ requestId }).lean();
      if (existing) return res.status(200).json(existing); // doublon évité
    }
    try {
      const item = await Item.create({ name, description, ...(requestId && { requestId }) });
      res.status(201).json(item);
    } catch (e) {
      if (e.code === 11000 && requestId) return res.status(200).json(await Item.findOne({ requestId }).lean());
      throw e;
    }
  } catch (e) { next(e); }
});

app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  if (err.message && err.message.startsWith('CORS')) return res.status(403).json({ error: err.message });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

  module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log("Serveur sur le port " + PORT));
}
