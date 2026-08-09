RRD FINAL — GITHUB TEST STRUCTURE

Upload the CONTENTS of this folder to your GitHub repository.
Keep index.html in the repository root.

GitHub Pages:
Settings → Pages → Deploy from a branch → main → /(root)

Prepared folders:
assets/images
assets/videos
assets/panoramas
assets/icons
uploads/projects
uploads/videos
uploads/panoramas
admin
api
css
js

IMPORTANT:
The current V7 admin/demo data is stored in the browser's localStorage.
GitHub Pages is static hosting and cannot securely provide a server-side admin,
database, or private file-upload API.

Do NOT place Cloudflare R2 secret keys, passwords, or API tokens in index.html
or browser JavaScript.

Production architecture:
Frontend → GitHub Pages
Auth/API → secure backend or Cloudflare Worker
Database → projects/settings/requests
Media → Cloudflare R2
Media domain → e.g. media.rrd.kz
