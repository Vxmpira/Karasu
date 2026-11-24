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

3. **Keys.** Open `.env` and fill in what you have. Every setting is listed in `docs/APIS.md`. The terminal runs with none of them; each key switches one feed on.

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
   This rebuilds `web/companies.json` from SEC EDGAR with every listed company and its state. It takes about 20 minutes the first time.

After a key is added to `.env`: `sudo systemctl restart karasu`.
