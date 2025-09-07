# Glamox GPE Siseaudit — Restore Snapshot

See repo-snapshot vastab "viimasele heale" seisule (enne tänaseid katseid).
- Client: Vite + React + Tailwind, küsitavuste loetelu VS/PE/MV, Märkus/Tõendid, Summary (ilma klausli chipita; saab hiljem lisada).
- Server: Express, staatilise buildi serveerimine, lihtne andmepoe initsialiseerimine.

Render buildi käsud (varasest heast seisust):
  bash -lc "cd client && npm ci && npm run build && mkdir -p ../server/public && cp -r dist/* ../server/public && cd ../server && npm ci --omit=dev"
Start (Render): 
  node server/seed.js && node server/index.js
Env: 
  DATA_DIR=/tmp
