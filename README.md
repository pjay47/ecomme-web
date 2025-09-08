# ShopSphere — E‑commerce SPA

A single-page e-commerce app with:
- Backend (Node + Express)
  - JWT auth (`/api/auth/signup`, `/api/auth/login`)
  - Items CRUD with filters (`/api/items` + POST/PUT/DELETE)
  - Cart APIs: persistent per user (`/api/cart`, `/api/cart/add`, `/api/cart/remove`)
- Frontend (React via CDN + Tailwind)
  - Signup & Login
  - Listing with search/category/price filters
  - Cart page: add/remove items
  - Cart persists after logout (stored server-side tied to user)

## Quick Start (Local)
```bash
# 1) Extract and install
npm install

# 2) Run
npm start
# App: http://localhost:3000
```

> Optional: set `JWT_SECRET` env var for production.

## Deploy (Render)
1. Create a new Web Service from this repo/zip.
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add `JWT_SECRET` to environment.
5. Open the generated URL.

## API Overview
- POST `/api/auth/signup` JSON: `{ name, email, password }` → `{ token, user }`
- POST `/api/auth/login` JSON: `{ email, password }` → `{ token, user }`
- GET `/api/items?q=&category=&minPrice=&maxPrice=` → `{ items: [...] }`
- POST `/api/items` (Bearer) → create
- PUT `/api/items/:id` (Bearer) → update
- DELETE `/api/items/:id` (Bearer) → delete
- GET `/api/cart` (Bearer) → `{ cart: [...] }`
- POST `/api/cart/add` (Bearer) JSON: `{ itemId, qty }`
- POST `/api/cart/remove` (Bearer) JSON: `{ itemId }`

## Notes
- Data stored in `data/*.json` for simplicity. Use a DB (Postgres/Mongo) for production.
- Cart is tied to user and persisted in `users.json`.
- Frontend uses hash routing; professional UI via Tailwind.
