
# Glamox GPE Siseaudit — Render deploy

Üks-URL Node server, mis teenindab **/api** ja serveerib **frontend'i** `server/public` alt.
Valmis Render.com jaoks.

## Kohalik arendus

```bash
# server (port 4000)
cd server
cp .env.example .env
npm install
npm run seed
npm run dev

# client (port 5173)
cd ../client
echo VITE_API_URL=http://127.0.0.1:4000 > .env
npm install
npm run dev
```

## Prod-build samasse serverisse (üks URL)
```bash
cd client && npm run build && cd ..
mkdir -p server/public
cp -r client/dist/* server/public/
cd server && npm install --omit=dev && node index.js
```

## Render.com
- Build Command:
```bash
bash -lc "cd client && npm ci && npm run build && mkdir -p ../server/public && cp -r dist/* ../server/public && cd ../server && npm ci --omit=dev"
```
- Start Command:
```bash
node server/index.js
```
- Env vars:
```
JWT_SECRET=<pikk juhuslik>
ADMIN_EMAIL=krister.saks@glamox.com
ADMIN_PASSWORD=<vali tugev>
DATA_DIR=/var/data
```
- Lisa *Disks* → Add Disk (1GB) → Mount Path `/var/data`

## SharePoint embed
Lisa SharePointi lehele **Embed** web part ja pane Renderi HTTPS URL.
