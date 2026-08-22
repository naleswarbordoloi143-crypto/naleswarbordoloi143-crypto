# Kishan Bhai — Small Farms. One Powerful Network.

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-wvctak5d)

An AI-powered digital farming platform for small and marginal Indian farmers. Kishan Bhai helps farmers work together digitally — bulk buying, machinery sharing, harvest pooling, AI crop disease detection, real-time market prices, weather alerts, and direct buyer access.

## Features

### For Farmers
- **Farm Management** — Register farms, track crops, planting dates, expected yields, and soil type
- **Virtual Clusters** — Join or form farmer clusters to pool harvests and coordinate with a local champion
- **Bulk Buying** — Group-purchase seeds, fertilizers, and equipment at wholesale prices
- **Machinery Sharing** — List, rent, and book farm machinery by the hour from other farmers
- **Harvest Pooling** — Combine harvests into lots for better pricing and quality grading
- **Collection Centers** — Book slots at local collection centers for produce drop-off
- **Quality Assessment** — Get AI-assisted and champion-verified quality grades for your produce
- **AI Assistant** — Chat with an AI farming assistant that uses real-time weather and market data
- **Crop Disease Detection** — Upload a photo of your crop and get a full diagnostic report with treatment and fertilizer recommendations
- **Weather Alerts** — 7-day weather forecast with rain, temperature, and humidity data for your location
- **Market Prices** — Live mandi prices from the government Agmarknet API with AI-powered 30-day price predictions
- **Farm Records** — Track expenses, production, and sales history
- **Group Chat** — Chat with other farmers in your village or cluster
- **Rewards** — Earn points for platform activity

### For Champions
- All farmer features, plus:
- **Cluster Coordination** — Create and manage farmer clusters in your village
- **Quality Verification** — Verify and grade harvest contributions from cluster members

### For Buyers
- **Marketplace** — Browse harvest lots and farmer produce directly
- **Buyer Requirements** — Post crop requirements with quantity, quality grade, and delivery details
- **Buyer Offers** — Make offers on harvest lots or against requirements
- **Order Management** — Track orders from offer to delivery

### For Admins
- Full dashboard with user management, platform oversight, and audit logs
- Manage reference data (crops, villages, collection centers, market prices, weather alerts)

### NFC Identity & Harvest Traceability

Kishan Bhai uses NFC tags as a physical-to-digital bridge — a tap on a tag links to a secure digital record in the database. NFC tags store **only** a unique identifier (e.g., `KB-F-1024` for farmers, `KB-WHT-2026-001` for harvest lots). No sensitive personal data (Aadhaar, phone, bank details) is ever written to a tag.

**Farmer NFC Identity:**
- Each farmer gets a unique NFC ID (e.g., `KB-F-1024`)
- Scanning the tag opens the farmer's authorized profile (name, village, cluster, farm size, current crop)
- NFC tags can be written via Web NFC API on supported Android devices
- QR code fallback for devices without NFC

**Harvest NFC Traceability:**
- Each harvest lot gets a unique Lot ID (e.g., `KB-WHT-2026-001`)
- Scanning a harvest tag shows crop, quantity, quality grade, cluster, contributors, and status
- Full traceability timeline tracks the lot from creation through collection, quality check, buyer viewing, and order confirmation
- Buyers see only public harvest info — individual farmer details are hidden

**Admin NFC Management:**
- View, search, and filter all NFC tags by type and status
- Assign, unassign, block, or mark tags as lost
- View scan history and last scanned time

**Demo Mode:**
- Try the full NFC flow with clearly-labeled demo data (no real data is faked as production)

**NFC API (Edge Function):**
- `POST /register` — Register a new NFC tag
- `POST /scan` — Scan a tag and retrieve associated entity
- `POST /assign` — Assign a tag to a farmer/harvest/machinery
- `POST /unassign` — Unassign a tag
- `POST /generate-id` — Generate a unique NFC ID
- `POST /status` — Update tag status (admin only)
- `GET /traceability/:lotId` — Get traceability timeline for a lot
- `GET /tags` — List all tags (admin only)

**Database Tables:**
- `nfc_tags` — Tag registry (UID, entity type, entity ID, status)
- `nfc_scan_logs` — Audit log of all scans
- `nfc_traceability_events` — Timeline events for harvest lots

**QR Code Fallback:**
Every NFC-enabled farmer and harvest lot also has a QR code containing the same unique ID, so the feature works on phones without NFC support.

**NFC Hardware Requirements:**
- NFC scanning and writing use the Web NFC API, currently supported on Chrome for Android
- On unsupported devices, the app shows a clear message and offers QR code scanning as an alternative
- NFC writing is only available on NFC-enabled Android devices — the app will not fake a write

### Future RFID Expansion

The NFC architecture is designed to extend to RFID for warehouse and logistics tracking:
- **NFC** — Farmer identity, harvest lots, individual machinery
- **RFID** (future) — Warehouse inventory, logistics, multiple bags/crates, large-scale tracking

RFID readers at collection centers and warehouses will be able to automatically identify multiple tagged assets simultaneously.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS with custom design system |
| Icons | Lucide React |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) |
| AI | Google Gemini / OpenAI GPT-4o-mini (configurable) |
| Weather | Open-Meteo API (free, no key required) |
| Market Prices | Government of India Agmarknet API (data.gov.in) |
| Geolocation | OpenStreetMap Nominatim |

## User Roles

The app supports four roles with role-based navigation and access control:

1. **Farmer** — Full farm management, AI tools, marketplace selling, group chat, rewards
2. **Champion** — Farmer features + cluster coordination and quality verification
3. **Buyer** — Marketplace browsing, requirements posting, offers, and order management
4. **Admin** — Platform-wide management, reference data, audit logs, user oversight

## Database & Security

- **36 tables** with Row Level Security (RLS) enabled on every table
- All policies scoped to `authenticated` role — anonymous access is fully revoked
- Ownership-based policies: users can only read/modify their own data
- Admin-only policies for reference data management (crops, villages, market prices, etc.)
- Champion-scoped policies for cluster and quality management
- Realtime subscriptions for notifications and group chat

## Edge Functions

All four serverless functions require JWT authentication:

| Function | Purpose |
|----------|---------|
| `ai-assistant` | AI chat with real-time weather + market context (Gemini/OpenAI) |
| `crop-analysis` | Image-based crop disease detection with fertilizer recommendations |
| `market-prices` | Live mandi prices from Agmarknet + AI price predictions |
| `weather` | 7-day weather forecast from Open-Meteo |
| `nfc-api` | NFC tag register, scan, assign, traceability, and admin management |
| `champion-verify` | AI-based champion certificate verification |

## Environment Variables

The following are required in `.env` (frontend) and Supabase Edge Function secrets (server-side):

**Frontend (`.env`):**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon public key

**Edge Function Secrets (set via Supabase dashboard):**
- `GEMINI_API_KEY` — Google Gemini API key (for AI assistant + crop analysis + price predictions)
- `OPENAI_API_KEY` — OpenAI API key (optional fallback for AI assistant + crop analysis)
- `SUPABASE_URL` — Supabase project URL (auto-configured)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (auto-configured)

## Languages

The app supports English and Hindi (Devanagari) with a toggle in the header. Language preference is saved per user.

## Getting Started

This project runs on Bolt. Click the badge above to open it, or run locally:

```bash
npm install
npm run dev
```

For production build:

```bash
npm run build
```
