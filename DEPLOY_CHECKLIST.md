# RRD deployment checklist

## Test now
- Create a GitHub repository.
- Upload all contents of `RRD_FINAL`.
- Keep `index.html` in the repository root.
- Enable GitHub Pages from `main` / root.
- Open the generated Pages URL.
- Test the public portfolio.

## Before production launch
- Replace prototype localStorage admin with server-side authentication.
- Add secure sessions/cookies.
- Add database.
- Add authenticated upload endpoint.
- Create Cloudflare R2 bucket.
- Connect `media.rrd.kz`.
- Add file validation, size limits and backups.
- Remove demo/admin bypasses.
- Test admin access from a non-admin device.
