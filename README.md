# mern-wiam-khemrich

## Objectif
Application MERN (MongoDB Atlas, Express, HTML/CSS/JS natif, Node.js) permettant d'afficher et d'ajouter des éléments. Elle est déployée avec un frontend sur Vercel, un backend Express sur Vercel et un backend de secours sur Cloudflare Workers.

## Installation
```bash
git clone https://github.com/kwiam/mern-wiam-khemrich.git
cd mern-wiam-khemrich/backend
npm install
cp .env.example .env   # puis renseigner les vraies valeurs (jamais commitées)
npm run wiam
```
Frontend : ouvrir `frontend/index.html` avec Live Server (port 5500).

## Scripts (backend)
- `npm start` : lance `node index.js`
- `npm run wiam` : lance `nodemon index.js`

## Variables requises
| Variable | Rôle |
|---|---|
| `MONGODB_URI` | URI MongoDB Atlas (secret) |
| `PORT` | Port local (3000 par défaut) |
| `CORS_ORIGINS` | Origines frontend autorisées, séparées par des virgules |

## Routes API
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | Vérifie que l'API répond |
| GET | `/api/items` | Liste les éléments |
| POST | `/api/items` | Crée un élément (`name` requis, `description` optionnelle) |

Codes : 200, 201, 400 (données invalides), 404, 500, 503 (base indisponible).

## URLs de déploiement
- GitHub : https://github.com/kwiam/mern-wiam-khemrich
- Frontend Vercel : à compléter
- Backend Vercel : à compléter
- Backend Cloudflare : à compléter

## Sécurité
Aucun secret n'est commité (`.env` ignoré, `.env.example` fictif). L'accès réseau `0.0.0.0/0` sur Atlas est une consigne pédagogique et sera retiré après l'évaluation.