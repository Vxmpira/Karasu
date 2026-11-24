# Karasu API record

Every outside service the terminal needs. This file is generated from `web/app/apis.json`: edit that file, then run `npm run apis`.

Keys go in `.env` on the server under the setting names below. They never go in the repo or in the page.

Key requirements are as each provider documents them to the best of our knowledge. Lines with a date under Checked were confirmed against the provider documentation on that date. The rest get confirmed when their feed is built.

Totals: 41 services. 19 need no key, 15 need a free key, 7 need a decision.

## Free key needed

Sign up once for each. No cost.

| Service | What it feeds | Layers | Setting name | Status | Checked | Notes |
|---|---|---|---|---|---|---|
| aisstream.io | Live ship positions, identity, speed, course, draught, destination | Ships, Energy, Goods | `AISSTREAM_API_KEY` | Built, waiting for its key | Nov 24th, 2026 | Server-side only. Browsers may not connect directly. 3 connections per account. No uptime guarantee. |
| USDA NASS Quick Stats | Cattle, hogs, poultry, dairy and crops by state | Livestock, Crops, States | `NASS_API_KEY` | To build |  |  |
| FRED (St. Louis Fed) | Rates, inflation, jobs and thousands of US and state series | Macro, States | `FRED_API_KEY` | To build |  |  |
| US Energy Information Administration | Oil and gas inventories, refinery runs, output and prices by state | Energy, States | `EIA_API_KEY` | To build |  |  |
| Bureau of Economic Analysis | GDP and personal income by state and industry | States | `BEA_API_KEY` | To build |  |  |
| Bureau of Labor Statistics | Jobs, unemployment and wages by state and metro | States | `BLS_API_KEY` | To build | Nov 24th, 2026 | Free registration key: 500 queries a day. The key must be renewed once a year. |
| US Census Bureau | Population, income, building permits, and trade by port and product | States, Goods | `CENSUS_API_KEY` | To build |  |  |
| UN Comtrade | Imports and exports by product between any two countries | Countries, Goods | `COMTRADE_API_KEY` | To build |  | Free tier has daily limits. |
| OpenFIGI | Matches a ticker on any exchange to one company identity | Tickers | `OPENFIGI_API_KEY` | To build |  |  |
| NASA FIRMS | Satellite wildfire detections worldwide | All layers | `FIRMS_MAP_KEY` | To build |  |  |
| openFDA | Drug and device approvals and recalls by company | Health | `OPENFDA_API_KEY` | To build |  | Works without a key at lower limits. |
| USPTO PatentsView | Patents filed and granted by company | Tickers | `PATENTSVIEW_API_KEY` | To build | Nov 24th, 2026 | Key required on every request. New key requests may be paused at the moment, so confirm before counting on it. |
| USDA Foreign Agricultural Service | Weekly export sales and world crop and meat supply | Livestock, Crops | `FAS_API_KEY` | To build |  |  |
| SAM.gov | Federal contract opportunities before they are awarded | Contracts | `SAM_API_KEY` | To build | Nov 24th, 2026 | Free personal key, but only 10 requests a day without a role in SAM. The nightly public extract needs no key and suits a daily pull better. |
| Stripe | Takes payment and tells the server when someone subscribes or cancels | Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | To build |  | The account is free. Stripe keeps a fee from each payment. Until this is built, a paid plan is switched on by hand with the admin command. |

## No key needed

Public data. These can be built without anything from the owner.

| Service | What it feeds | Layers | Setting name | Status | Checked | Notes |
|---|---|---|---|---|---|---|
| SEC EDGAR | Every US-listed company with its state, filings, insider trades, fund holdings | Tickers, States | `SEC_USER_AGENT` | Built, not yet run on the server | Nov 24th, 2026 | No key. Requires a contact email in the request header. 10 requests a second. A nightly bulk file has every company at once. |
| USAspending.gov | Federal contract awards by company, agency, state and county | Contracts, States |  | To build |  |  |
| CFTC Commitments of Traders | Who is long and short each US futures contract | Energy, Livestock |  | To build |  |  |
| ICE Futures Europe reports | Brent positioning by trader group | Energy |  | To build |  | Weekly files, no API. Parsed from the published reports. |
| Port authority releases | Monthly container counts at Los Angeles, Long Beach, New York, Savannah, Houston and others | Goods |  | To build |  | No API. Each port publishes its own page or file. |
| Railroad weekly traffic reports | Rail carloads and intermodal units | Goods |  | To build |  | No API. Parsed from the weekly release. |
| World Bank Indicators | GDP, inflation, trade and population for every country | Countries |  | To build |  |  |
| IMF Data | Country forecasts, reserves, balance of payments | Countries |  | To build |  |  |
| Eurostat | European economy, trade and energy statistics | Countries |  | To build |  |  |
| Wikidata | Companies listed on exchanges outside the US, with country and exchange | Countries, Tickers |  | To build |  | Free but patchy. Good enough to start, not complete. |
| GLEIF legal entity records | Legal name, country and parent company for firms worldwide | Tickers, Countries |  | To build |  |  |
| USGS Earthquakes | Earthquakes near mines, plants and ports | All layers |  | To build |  |  |
| National Weather Service | Storms, freezes and floods over US crops, ports and plants | All layers |  | To build |  | No key. Requires a contact in the request header. |
| GDELT | World news events pinned to places: strikes, protests, conflicts, policy moves | All layers |  | To build |  |  |
| Treasury sanctions lists | Sanctioned people, companies and ships | All layers, Ships |  | To build |  |  |
| UK Contracts Finder | UK government contract awards | Contracts |  | To build |  |  |
| EU Tenders Electronic Daily | European Union and member state contract awards | Contracts |  | To build | Nov 24th, 2026 | Searching published notices needs no key or account. |
| Amazon SES | Password reset emails and copies of contact form messages | Accounts | `MAIL_FROM` | To build |  | Uses the mail setup the brand site already has in us-east-2. Until this is built, contact messages are saved on the server and password resets are done by hand. |
| Admin token | Lets the owner switch an account between free and paid from the server | Accounts | `ADMIN_TOKEN` | Built, not yet run on the server |  | Not an outside service. A long random value you make up and keep private. |

## Decision needed

Paid, or a vendor still to choose.

| Service | What it feeds | Layers | Setting name | Status | Checked | Notes |
|---|---|---|---|---|---|---|
| OpenSky Network | Live aircraft positions, for cargo flights | Goods | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | Decision needed | Nov 24th, 2026 | Free access is licensed for research and internal testing only. Showing it in a paid product needs a commercial license from OpenSky. |
| Delayed market prices | Stock and futures prices, delayed or end of day | All layers | `PRICES_API_KEY` | Decision needed |  | Vendor to choose. Low cost for delayed data. Real-time quotes need exchange licenses and cost far more. |
| Ship registry details | Each ship's design draught, deadweight and owner | Ships, Energy | `VESSEL_API_KEY` | Decision needed |  | This is what tells a loaded tanker from an empty one. Usually paid. Vendor to choose. |
| Exchange listings outside the US | Complete company lists for London, Tokyo, Hong Kong and other exchanges | Countries, Tickers | `LISTINGS_API_KEY` | Decision needed |  | Wikidata and OpenFIGI cover part of this for free. A paid vendor makes it complete. |
| Ocean bills of lading | Which company imported what, from which supplier, on which ship | Goods, Tickers |  | Decision needed |  | Public record. Route to choose: the dataset on AWS Marketplace under the existing AWS account, or a records request to US Customs. |
| Satellite ship tracking | Ship positions in mid-ocean, beyond the reach of shore stations | Ships |  | Decision needed |  | Paid. Only needed if the gaps in the free feed matter. |
| Paid plan prices and checkout links | The prices shown on the site and where the upgrade buttons send people | Billing | `PRICE_MONTHLY`, `PRICE_YEARLY`, `CHECKOUT_LINK_MONTHLY`, `CHECKOUT_LINK_YEARLY` | Decision needed |  | Prices to set. Paste the two payment links and the upgrade buttons switch on. Until then the site says pricing is being set. |
