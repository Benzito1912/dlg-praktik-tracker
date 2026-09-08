# Gennemgang 8. september 2026

Gennemgået: alle versionsstyrede kilde- og konfigurationsfiler, tidligere App.jsx-versioner i Git-historikken, Netlifys publicerede commit, den aktive hjemmeside i Chromium og Supabase-tabellens struktur/adgangspolitikker. Billedfiler fra Vite-skabelonen er ubrugte og indgår ikke i appens importgraf.

## Rettet

- Seneste GitHub-version manglede App.jsx, selv om main.jsx importerede den. Appen kan nu bygges fra en ren checkout.
- Samlet dashboard erstatter en smal, lang liste og inkonsistente inline-stile. Formular og historik ligger ved siden af hinanden på desktop og under hinanden på mobil.
- Dansk sprogmetadata, sidetitel og favicon; tydelige labels, tastaturfokus, spring-link, reduceret bevægelse og status-/fejlmeddelelser.
- Arbejdsdagsberegningen tæller faktiske mandage–fredage i den resterende praktikperiode. Ferie og helligdage trækkes ikke fra; dette fremgår i UI.
- Unikke datoer tælles som dage, og resterende timer bliver aldrig negative. Den lokale kalenderdato bruges frem for UTC.
- API-paginering med stabil sortering giver korrekte summer over API'ets rækkegrænse. Historikken viser 10 poster ad gangen, med mulighed for at vise flere.
- Hurtige timevalg, redigering, søgning, månedsfilter og eksport af filtrerede poster. CSV bruger dansk decimalkomma og beskytter mod formelfortolkning.
- Sletning kræver bekræftelse. Fejl skjules ikke, felter bevares efter gemmefejl, og UI opdateres først efter et bekræftet databasesvar. Samtidige dobbeltklik på skrivninger blokeres.
- Indlæsning, tom historik og forbindelsesfejl er adskilte tilstande. Gamle forespørgsler afbrydes; læsekald har timeout.
- Ubrugt React Router fjernet. Afhængigheder og låsefil opdateret; manglende Babel-afhængighed til lint tilføjet.

## Test og begrænsninger

Playwright tester oprettelse, redigering, slettebekræftelse, fejlbehandling, søgning, eksport, tom tilstand, beregninger og API-paginering med simulerede svar. Visuel kontrol og axe-kontrol køres ved 1440, 768, 390 og 320 pixels. Produktionsdatabasen kontrolleres kun med læseadgang under arbejdet.

UI-validering af højst 24 timer pr. dato beskytter den normale formular, men er ikke en databaseconstraint og forhindrer ikke samtidige skrivninger fra flere klienter. Databasen har allerede en constraint på 0 < hours <= 24 pr. post.

Den eksisterende offentlige databaseadgang skal behandles separat med en aftalt adgangsmodel; se README. Ingen adgangspolitikker eller eksisterende data er ændret af gennemgangen.
