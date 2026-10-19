# Deploying the dApp

The dApp is a static site. `npm run build` writes it to `dist/` and there is
no server component — the browser talks straight to the Asentum RPC and the
chain is the database. Any static host works.

```
dist/
  index.html            5.9 kB
  assets/index-*.js     6.1 kB
```

`vite.config.js` already sets `base: './'`, so the build works from any
subpath (GitHub Pages project sites, IPFS, a `/guestbook/` folder on nginx).

## Fastest: Netlify Drop (no CLI, no repo)

1. Build: `npm run build`
2. Go to <https://app.netlify.com/drop>
3. Sign in (email is fine), then drag the whole `dist` folder onto the page.
4. You get a URL like `https://lucky-name-1234.netlify.app` immediately.

Set a custom path later if you want. Nothing else to configure.

## Best for a portfolio: GitHub Pages

The repo is already initialised with a first commit pending. You need a
GitHub account and a personal access token (classic, scope `repo` +
`public_repo`):

```powershell
cd D:\MISC\ASENTUM\asentum-guestbook
git remote add origin https://github.com/<your-user>/asentum-guestbook.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: Deploy from a branch →
`main` / `root` → Save.** The site appears at
`https://<your-user>.github.io/asentum-guestbook/` in about a minute.

If you prefer to publish from `dist/` instead, add a GitHub Actions workflow
that runs `npm ci && npm run build` and uploads `dist/` as Pages artifacts.

## Also fine

| Host | Command / steps |
|------|-----------------|
| Vercel | `npx vercel` → login in the browser → `dist` auto-detected |
| Cloudflare Pages | Connect the GitHub repo, build `npm run build`, output `dist` |
| IPFS | `ipfs add -r dist` → pin the CID → gateway URL. Thematically on-brand for a post-quantum chain, and the content is immutable |
| Your own nginx | `scp -r dist/* user@host:/var/www/guestbook/` |

## Verify after deploying

1. Open the public URL in a **private window** (no extension) — the entries
   must still load, because reads need no wallet.
2. Connect the Asentum Wallet extension and sign one entry — writes need the
   extension and gas, and that is the part a stranger has to be able to do.
3. Confirm the new entry appears in the list within ~10 s (auto-refresh).

If step 1 fails, the RPC host or CORS is the problem, not the build.
