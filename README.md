# First Trip Assistant

An independent, local-first concept prototype for guided outdoor-gear shopping. It uses authored questions, a small source-backed catalog, and an optional OpenAI tool-calling agent to make a reviewable purchase proposal. It is not affiliated with or endorsed by REI.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The questionnaire and guide links work without an API key. Add `OPENAI_API_KEY` and an account-available `OPENAI_MODEL` to enable the live shopping-agent endpoint.

## Supabase development setup

Create a **development** Supabase project, then add these server-only values to `.env.local` (never commit or paste them into chat):

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SESSION_SECRET=a-unique-random-string-with-at-least-32-characters
```

Apply [`supabase/migrations/202610170001_v4_outfitter.sql`](supabase/migrations/202610170001_v4_outfitter.sql) in the project SQL editor, or with the Supabase CLI. The server issues an anonymous HTTP-only session cookie and persists versioned runs only when all three values are configured. Without them, the UI reports local-only behavior.

## Agent safeguards

`/api/agent` uses the Responses API with strict, server-executed functions:

- `search_catalog`, `get_product_details`, `compare_options`
- `validate_setup`, which calculates cents, covered slots, activity scope, and budget
- `present_proposal`, which stages only a freshly validated exact item list

The requirements snapshot is sent once per run and is never rewritten by the model. The run is bounded to 8 turns, 20 tool calls, 3 validation repairs, and roughly 85 seconds. There are no purchasing, scraping, arbitrary URL, shell, or database-write tools.

## Coverage matrix

| Activity | Current coverage | What works now |
| --- | --- | --- |
| Backpacking | Guided setup | Authored flow plus local pack, shelter, sleeping bag and pad catalog/validation. |
| Camping | Product discovery | Authored context and source-backed shelter/sleep discovery; complete setup rules are not claimed. |
| Hiking, running, cycling, climbing, paddling, snow sports | Guide only | Activity-specific entry question and REI Expert Advice link; no product proposal is claimed until verified category records and validators exist. |

The local catalog is intentionally small. Prices are dated snapshots; inventory, tax, shipping, fit, compatibility, weather, safety, and complete packing needs are not guaranteed. Product images are not seeded, rather than fabricated.

## Checks

```bash
npm test
npm run build
```

The UI uses Georgia and Arial/system fallbacks as screenshot-matching approximations; they are not claimed as REI’s fonts. The generated First Trip Assistant raster logo is stored in `public/first-trip-assistant-logo.png`.
