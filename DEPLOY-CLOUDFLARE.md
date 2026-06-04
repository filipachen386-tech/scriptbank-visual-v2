# Cloudflare Deploy Steps

This version is designed for a mostly free Cloudflare setup.

## 1. Create a GitHub repo

Upload this folder as the repository root:

- `wrangler.toml`
- `README.md`
- `DEPLOY-CLOUDFLARE.md`
- `src/`
- `public/`

## 2. Create a Cloudflare account

Go to:

- <https://dash.cloudflare.com/>

## 3. Create the D1 database

In Cloudflare dashboard:

1. Click `Workers & Pages`
2. Click `D1`
3. Click `Create`
4. Database name:
   - `scriptbank-db`
5. Click `Create`

Important:

- Keep the database name exactly `scriptbank-db`
- It matches the `wrangler.toml` file

## 4. Deploy from GitHub

In Cloudflare dashboard:

1. Click `Workers & Pages`
2. Click `Create`
3. Click `Import a repository`
4. Connect GitHub if needed
5. Select your repository
6. Click `Begin setup`

## 5. Build settings

Use:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: leave empty

Cloudflare will use `wrangler.toml`.

## 6. Environment variable

In the project settings before final deploy, add:

- Key: `UPLOAD_PASSWORD`
- Value: your own password

If you do not set it, the default password stays:

- `kwai666`

## 7. Finish deploy

Click:

- `Save and Deploy`

## 8. First login after deploy

After the site is live:

1. Open the public URL
2. Click `Adicionar Novo Script`
3. Enter the upload password
4. Open the admin panel

## 9. Import your current library

Inside the admin panel:

1. Use `Importar JSON Atual`
2. Select your local `script_library.json`
3. Import it into D1

After that, your deployed site will have the same script base.

## Notes

- This Cloudflare version stores data in D1, not local JSON
- Your current local Python app is still separate
- You can continue using local JSON as backup/export
