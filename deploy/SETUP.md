# Putting Karasu on the BlackCrown EC2 box

One-time setup. After this, pushes to `main` go live through the existing deploy timer.

1. **DNS.** Point the Karasu domain at the box with an A record in Route 53.

2. **Code.** On the box:
   ```
   cd ~ && git clone https://github.com/Vxmpira/Karasu.git karasu && cd karasu
   node -v            # needs 20 or newer
   npm ci --omit=dev
   cp .env.example .env
   ```
   If the repo is private, the box needs a read-only deploy key first.

3. **Settings.** Open `.env` and fill in what you have. Every setting is listed in `docs/APIS.md`. The site runs with none of them; each one switches something on.
   - Set `ADMIN_TOKEN` to a long random value now. It is what lets you move an account to the paid plan:
     `ADMIN_TOKEN=... node scripts/set-plan.mjs someone@example.com paid`
   - Accounts are saved in `data/store.json` and contact messages in `data/contact.jsonl`. Add both to the box's backups.

4. **Service.**
   ```
   sudo cp deploy/karasu.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now karasu
   curl -s localhost:3010/api/health
   ```

5. **Site.**
   ```
   sudo cp deploy/nginx-karasu.conf /etc/nginx/sites-available/karasu
   sudo sed -i 's/KARASU_DOMAIN/your.domain/' /etc/nginx/sites-available/karasu
   sudo ln -s /etc/nginx/sites-available/karasu /etc/nginx/sites-enabled/karasu
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d your.domain
   ```

6. **Auto-deploy.** Add Karasu to `/etc/blackcrown-deploy.conf` the same way the other repos are listed, with this as its step after each pull:
   ```
   npm ci --omit=dev && sudo systemctl restart karasu
   ```

7. **Company list.** Once, and then monthly:
   ```
   SEC_USER_AGENT="Karasu your@email" npm run companies
   ```
   This rebuilds `web/app/companies.json` from SEC EDGAR with every listed company and its state. It takes about 20 minutes the first time.

8. **Before opening sign-ups to the public.** Have a lawyer review `/terms`, `/privacy` and `/disclosure`, and fill in every placeholder in square brackets.

After a key is added to `.env`: `sudo systemctl restart karasu`.
