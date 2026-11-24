# Karasu

A market-intelligence terminal by BlackCrown. One map of real-world data points (ships, ports, feedyards, contract awards), each tied to the stocks and futures it bears on, with a read and a way to check it.

Karasu is a research tool. Nothing in it is investment advice.

## What is here

| Path | What it is |
|---|---|
| `web/` | The public site, built from `site-src/`: front page, login, sign-up, contact, account, terms, privacy, disclosure. |
| `web/app/` | The terminal: map, tickers, desks, sources. Only signed-in accounts can load it. |
| `web/app/data.js` | Data points, ties, tickers, desks and sources. Entered by hand until collectors replace it. |
| `web/app/apis.json` | The record of every outside service Karasu needs. Single source of truth. |
| `web/app/companies.json` | Listed companies. A stand-in built from public lists. `npm run companies` rebuilds it from SEC EDGAR. |
| `site-src/` | Source for the public pages. Edit here, then `npm run site`. |
| `server/` | Node server: accounts, the login gate, plan-aware data, the live ship feed. |
| `collectors/` | Scripts that pull from outside sources. |
| `docs/APIS.md` | The API record as a readable table. Generated: `npm run apis`. |
| `deploy/` | systemd unit, nginx site and setup steps for the BlackCrown EC2 box. |
| `preview/site.html` | The public pages in one file, for review without a server. |
| `test/` | Server tests. `npm test`. |

## Run it

```
npm install
cp .env.example .env     # fill in keys as they arrive
npm start                # http://127.0.0.1:3010
```

With no keys the site still runs. Ships are simulated until `AISSTREAM_API_KEY` is set.

To see the live ship layer without a key:

```
npm run mock
AISSTREAM_API_KEY=dev AISSTREAM_URL=ws://127.0.0.1:8790 npm start
```

## Accounts and plans

- Sign-up needs an email and a password of 10 or more characters. Passwords are stored as salted scrypt hashes. Sessions are an HttpOnly cookie that lasts 30 days.
- `/app/` and `/account` redirect to `/login` without a session. Every `/api` data route answers 401.
- Accounts start on the free plan. A free account is sent the facts only: the server removes the reads, checks and ties from `data.js` before sending it. A paid account gets everything.
- Billing is not automated yet. Switch an account by hand: `ADMIN_TOKEN=... node scripts/set-plan.mjs someone@example.com paid`
- Prices and checkout links come from `.env` (`PRICE_MONTHLY`, `CHECKOUT_LINK_MONTHLY` and the yearly pair). Until they are set, the site says pricing is being set.
- Accounts live in `data/store.json` and contact messages in `data/contact.jsonl`. Back both up. Neither is in git.
- Not built yet: email verification, password reset by email, Stripe webhooks. Each is on the API record.

## Live ships

`server/ais.mjs` holds one connection to aisstream.io and keeps every ship's latest position, identity, speed, course, draught and destination in memory (`server/fleet.mjs`). The page asks `/api/ships?bbox=west,south,east,north` for the ships in view and `/api/ships/near` for a count around a data point. The key never reaches the browser, which aisstream requires.

Known limits: positions come from shore stations, so mid-ocean coverage has gaps. Ship state lives in memory and starts empty after a restart. AIS does not carry a ship's design draught, so telling a loaded tanker from an empty one needs a ship registry (see the API record).

## Status

- Built and tested (21 server tests, plus a browser walk-through of every page): accounts, the login gate, free and paid data, the ship connector and API against a stand-in feed.
- Built, not yet run against the live service: `collectors/sec-companies.mjs`, and the ship connector against the real aisstream feed.
- Entered by hand: everything in `web/app/data.js`.
- Stand-in: `web/app/companies.json`, from third-party public lists. Replace it with the SEC build before launch.
- Drafts that need a lawyer: the terms, privacy policy and disclosure. Placeholders in square brackets must be filled in.

## Rules for the product

- Dates read like "Nov 10th".
- No em dashes in copy.
- Reads are research, never buy or sell calls.
