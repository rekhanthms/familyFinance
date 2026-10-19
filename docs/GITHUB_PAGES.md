# Publish on GitHub Pages (free)

The public build (`npm run build:pages`) swaps `seed.ts` for `seed.public.ts`, so the hosted app starts EMPTY.
Your real loans are never in the repository. Open the hosted app, then Settings > Restore, and import your backup file
(make it on your PC first: Settings > Back up now).

1. Create a GitHub repository (it must be public on the free plan) and push this folder to the `main` branch.
2. Repository > Settings > Pages > Build and deployment > Source: choose "GitHub Actions".
3. Push (or run the "Publish to GitHub Pages" workflow). In about 2 minutes the app is at
   `https://<your-user>.github.io/<repo-name>/`.
4. Open that link on your phone and add it to the home screen.

Do not commit `.env` files, backup JSON files or Supabase service keys. The Supabase anon key in `sync-config.ts` is meant to be public;
access is protected by the email allowlist (see SYNC_SETUP.md).

## Deploying from a new branch (not main)

```
git checkout -b family-finance
git add .
git commit -m "Family Finance app"
git push -u origin family-finance
```

Then, once, in the repository:
1. Settings > Pages > Source: GitHub Actions.
2. Settings > Environments > github-pages > Deployment branches and tags: add the branch `family-finance`
   (by default only `main` may deploy, so the publish step fails with "Branch is not allowed to deploy" until you do this).
3. Actions tab > "Publish to GitHub Pages" > Re-run all jobs.

## Your real data stays out of GitHub

The code only contains sample data with generic names (Member A to D) and fake account endings. Your real register is in
`my-register-backup.json`, which is NOT part of the project. Keep it on your PC and phone only, and import it with
Settings > Restore on each device. Never commit it (`*.backup.json` and `my-register-backup.json` are in `.gitignore`).
