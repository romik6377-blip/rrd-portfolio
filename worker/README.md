# RRD Cloudflare Worker setup

This Worker is the secure bridge between the GitHub Pages frontend, Cloudflare R2 and D1.

## 1. Create D1
Create a D1 database named `rrd-db` in Cloudflare and copy its database ID into `wrangler.toml`.
Then run `sql/schema.sql` in the D1 console.

## 2. Bind R2
The `wrangler.toml` expects an R2 bucket named `rrd-media` with binding `MEDIA`.

## 3. Set secrets
In Worker Settings → Variables and Secrets, create:
- `ADMIN_EMAIL` (secret)
- `ADMIN_PASSWORD` (secret)
- `SESSION_SECRET` (secret; use a long random value)

Set `ALLOWED_ORIGIN` to the exact GitHub Pages origin, e.g. `https://username.github.io`.
Set `PUBLIC_MEDIA_BASE` to the Worker URL, e.g. `https://rrd-admin-api.username.workers.dev`.

## 4. Deploy
Using Wrangler:

```bash
cd worker
npx wrangler deploy
```

Or create a Worker in the Cloudflare dashboard and deploy the contents of `src/index.js`, then add the R2 and D1 bindings and variables/secrets there.

## 5. Connect the website
Edit `/rrd-config.js`:

```js
window.RRD_CONFIG = {
  API_BASE: "https://YOUR-WORKER.workers.dev"
};
```

Upload both `index.html` and `rrd-config.js` to the GitHub repository.

## Security
- The public site has no Admin button.
- Admin is only entered through `?admin=1` and requires server authentication.
- Upload/delete/state writes are protected by the Worker.
- R2 credentials are never placed in browser code.
- The R2 bucket can remain private; the Worker exposes only the `/media/*` public read path.

## Large files
The current Worker uses direct PUT uploads, suitable for small/medium files. For very large videos, switch the upload UI to R2 multipart/presigned uploads so uploads can resume after interruption.
