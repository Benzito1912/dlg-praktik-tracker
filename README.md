# DLG Praktik

Dansk timetracker til praktikperioden 15. juni–30. november 2026 med et mål på 230 timer.

## Lokal udvikling

1. Installer Node.js 22 eller nyere og kør `npm ci`.
2. Kopiér `.env.example` til `.env.local`, og indsæt projektets Supabase-URL og offentlige publishable/anon-nøgle. Brug aldrig en service-role-nøgle i frontend.
3. Kør `npm run dev`.

`npm run build` bygger til `dist`. Netlify bruger den eksisterende `netlify.toml` og sine egne miljøvariabler. Manglende databasekonfiguration vises som en fejl i brugerfladen frem for en blank side.

## Kontrol

Kør `npx playwright install chromium` én gang og derefter `npm run check`. Browsertestene bruger en separat testadresse med simulerede API-svar. De ændrer ikke produktionsdata. Skærmbilleder gemmes i den git-ignorerede mappe `artifacts`.

## Kode

- `src/App.jsx`: dashboard, formular, historik og databaseforespørgsler.
- `src/lib/tracker.js`: datoer, timeberegning, validering og CSV-eksport.
- `src/lib/supabase.js`: klientkonfiguration via miljøvariabler.
- `src/index.css` og `src/App.css`: grundstil og responsive komponenter.
- `tests/tracker.spec.js`: beregning, CRUD, fejl, API-paginering og tilgængelighed.

## Kendt adgangsforhold

Det eksisterende Supabase-projekt har en `Allow all`-politik på `public.time_entries` med `USING (true)` og `WITH CHECK (true)` for rollen `public`. Appen har ikke login. Det betyder, at tabellen ikke er privat: anonyme klienter med den offentlige API-nøgle kan læse og ændre registreringer. Den offentlige nøgle er tiltænkt frontend; adgang skal begrænses med autentifikation og RLS, ikke ved at skjule nøglen.

Før privat brug skal ejeren vælge adgangsmodel (personlig konto eller delt team), hvorefter login, ejerskab for eksisterende poster og passende RLS-politikker kan implementeres samlet. UX-opdateringen ændrer ikke disse adgangsregler.
