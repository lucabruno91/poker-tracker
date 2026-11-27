# Poker Session Tracker

[![CI](https://github.com/lucabruno91/poker-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/lucabruno91/poker-tracker/actions/workflows/ci.yml)

Webapp local-first per analizzare **dopo la sessione** le hand history di PokerStars
(cash game NL Hold'em): risultati, statistiche, archivio avversari, esportazione per Claude.
Le specifiche complete sono in [SPEC.md](SPEC.md).

Tutto resta nel browser (IndexedDB): nessun server e nessuna richiesta di rete; anche i font sono inclusi nel bundle.

## Requisiti

Node.js 22 o successivo.

## Comandi

```sh
npm install        # dipendenze
npm run dev        # server di sviluppo (http://localhost:5173)
npm test           # test (Vitest)
npm run typecheck  # controllo TypeScript
npm run build      # build di produzione in dist/
```

## Controlli automatici

Ogni pull request verso `main` esegue `.github/workflows/ci.yml`: typecheck, test e build. Il controllo deve essere verde prima del merge. In CI i test di riferimento sulle hand history reali vengono saltati, perché `fixtures/` non è nel repository: vanno eseguiti in locale.

## Versione online

A ogni push su `main`, il workflow `.github/workflows/deploy.yml` esegue test e build e pubblica
l'app su GitHub Pages (https://lucabruno91.github.io/poker-tracker/). Nel repo va attivato
Settings → Pages → Source: «GitHub Actions».

I dati stanno nel browser e sono separati per indirizzo: quelli importati in locale non compaiono
online e viceversa. Per spostarli: Impostazioni → Esporta backup, poi Importa backup sull'altra versione.

## Dati privati (fuori da git)

Il repository è pubblico, quindi i nomi degli altri giocatori non devono finirci, né nel codice
né nella build pubblicata. Restano solo in locale:

| Percorso | Contenuto |
|---|---|
| `fixtures/*.txt` | Hand history reali |
| `fixtures/reference.json` | Hero e valori attesi della SPEC §11 (letti da `tests/reference.test.ts`) |
| `private/seed.json` | Etichette e note di Claude sugli avversari e riepiloghi delle sessioni (SPEC §10) |

`private/seed.json` si carica dall'app: Impostazioni → «Dati iniziali». Formato:

```json
{
  "players": { "nome": { "label": "Fish", "note": "..." } },
  "sessionSummaries": { "Nome tavolo": "riepilogo" }
}
```

Fai una copia di questi file fuori dal repository: non sono su GitHub.

## Fixture

- `tests/fixtures/` — hand history **sintetiche** con nomi inventati, versionate. Coprono:
  - la mano d'esempio della SPEC;
  - side pot e giocatore seduto fuori;
  - heads-up con ricarica;
  - limp;
  - mani da scartare.
- `fixtures/` — le **hand history reali** della SPEC §11 e `reference.json` con i valori attesi.
  Copia lì i file `HH2026112*.txt` originali, senza modificarli: `tests/reference.test.ts` li trova da solo e verifica i
  valori di riferimento. Senza quei file i test risultano «skipped» (succede anche nella CI).

## Struttura

```
src/parser/   testo → Hand (funzioni pure)
src/stats/    contatori, sessioni, ricariche, statistiche dei giocatori
src/labels/   etichetta automatica, import delle etichette di Claude
src/db/       Dexie: schema, import, backup, profili, dati iniziali
src/export/   testo per Claude
src/ui/       React: tema, router hash, schermate
tests/        test di parser, statistiche, database ed esportazione
```
