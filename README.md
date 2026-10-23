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
- Frontend Vercel : https://mern-wiam-khemrich-frontend.vercel.app
- Backend Vercel : https://mern-wiam-khemrich-backend.vercel.app
- Backend Cloudflare : https://mern-api-wiam.khemrich.workers.dev

## Sécurité
Aucun secret n'est commité (`.env` ignoré, `.env.example` fictif). L'accès réseau `0.0.0.0/0` sur Atlas est une consigne pédagogique et sera retiré après l'évaluation.
## Choix technique Cloudflare
Express et Mongoose ne s'exécutent pas directement sur Cloudflare Workers. Le Worker est écrit avec l'API `fetch` native et le driver officiel `mongodb` (flag `nodejs_compat`). Il utilise la même base et la même collection `items` que le modèle Mongoose du backend Vercel, donc les deux backends affichent les mêmes données. Le secret `MONGODB_URI` est configuré avec `wrangler secret put`, et `CORS_ORIGINS` comme variable du Worker.

## Variables de production
- Vercel (projet backend) : `MONGODB_URI`, `CORS_ORIGINS`
- Cloudflare (Worker) : secret `MONGODB_URI`, variable `CORS_ORIGINS`
Ces variables sont configurées séparément et ne sont jamais exposées dans le frontend.
## Bascule automatique vers le backend de secours
Le frontend (`frontend/app.js`) contient une URL principale (Vercel) et une URL secondaire (Cloudflare Workers) dans `CONFIG.BACKENDS`. Chaque requête est tentée sur le premier backend, puis sur le second en cas d'échec. Sont considérés comme échec : une erreur réseau, un délai dépassé (`AbortController`, 6 s) ou une réponse HTTP non réussie (`response.ok === false`).

### Tests
- Test A : backend principal disponible → la requête réussit, l'interface indique le serveur Vercel.
- Test B : `?test=B` rend le principal indisponible → la requête bascule sur Cloudflare.
- Test C : `?test=C` rend les deux indisponibles → message clair « Impossible de joindre les serveurs ».
- Test D : voir idempotence ci-dessous.

### Stratégie d'idempotence (POST)
Le frontend génère un UUID (`crypto.randomUUID()`) pour chaque ajout et l'envoie dans l'en-tête `Idempotency-Key`. Le même UUID est réutilisé pour toutes les tentatives (autre backend, nouveau clic après une erreur) jusqu'au succès. Les deux backends le stockent dans le champ `requestId`, protégé par un index unique. Si le document existe déjà, le serveur renvoie l'existant (HTTP 200) au lieu d'en créer un second : une nouvelle tentative ne crée donc pas de doublon.

### Limites
- Les deux backends utilisent la même base Atlas : si elle tombe, la bascule ne sert à rien.
- Un délai dépassé peut basculer alors que le premier serveur a quand même traité la requête (d'où l'idempotence).
- Chaque bascule ajoute un délai (jusqu'à 6 s).
- Une réponse 4xx (validation) déclenche aussi un essai sur le second serveur, conformément à la consigne `response.ok === false`.
- L'accès réseau Atlas `0.0.0.0/0` est nécessaire car les IP de Vercel et Cloudflare changent.