# Karasu

A market-intelligence terminal by BlackCrown. One map of real-world data points (ships, ports, feedyards, contract awards), each tied to the stocks and futures it bears on, with a read and a way to check it.

Karasu is a research tool. Nothing in it is investment advice.

## What is here

| Path | What it is |
|---|---|
| `web/` | The terminal: map, tickers, desks, sources. Plain HTML and JavaScript, no build step. |
| `web/data.js` | Data points, ties, tickers, desks and sources. Entered by hand until collectors replace it. |
| `web/apis.json` | The record of every outside API the terminal needs. Single source of truth. |
| `web/companies.json` | Listed companies. A stand-in built from public lists. `npm run companies` rebuilds it from SEC EDGAR. |
| `server/` | Node server. Serves `web/` and the live ship feed. |
| `collectors/` | Scripts that pull from outside sources. |
| `docs/APIS.md` | The API record as a readable table. Generated: run `npm run apis` after editing `web/apis.json`. |
| `deploy/` | systemd unit, nginx site and setup steps for the BlackCrown EC2 box. |
| `test/` | Server tests. `npm test`. |

## Run it

```
npm install
cp .env.example .env     # fill in keys as they arrive
npm start                # http://127.0.0.1:3010
```

With no keys the terminal still runs. Ships are simulated until `AISSTREAM_API_KEY` is set.

To see the live ship layer without a key, run the stand-in feed in one terminal and the server in another:

```
npm run mock
AISSTREAM_API_KEY=dev AISSTREAM_URL=ws://127.0.0.1:8790 npm start
```

## Live ships

`server/ais.mjs` holds one connection to aisstream.io and keeps every ship's latest position, identity, speed, course, draught and destination in memory (`server/fleet.mjs`). The page asks `/api/ships?bbox=west,south,east,north` for the ships in view. The key never reaches the browser, which aisstream requires.

Known limits: positions come from shore stations, so mid-ocean coverage has gaps. Ship state lives in memory and starts empty after a restart. AIS does not carry a ship's design draught, so telling a loaded tanker from an empty one needs a ship registry (see the API record).

## Status

- Built and tested against a stand-in feed: the ship connector, the ship API, the ship layer and ship card.
- Built, not yet run against the live service: `collectors/sec-companies.mjs`.
- Entered by hand: everything in `web/data.js`.
- `web/companies.json` is a stand-in from third-party public lists. Replace it with the SEC build before launch.

## Rules for the product

- Dates read like "Nov 10th".
- No em dashes in copy.
- Reads are research, never buy or sell calls.
