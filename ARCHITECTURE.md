# RRD production architecture

- Public frontend: GitHub Pages.
- Protected admin: server-side authentication and authorization.
- Database: projects, settings, prices, stats, client requests.
- Media: Cloudflare R2.
- Public media domain: `media.rrd.kz`.
- Upload flow: browser → authenticated upload endpoint → R2.
- R2 credentials remain server-side.

This archive contains the working prototype frontend and the folder scaffold.
Secure authentication, database and R2 upload require a backend/Worker.
