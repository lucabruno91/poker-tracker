# Poker Session Tracker — specifiche

Webapp React che legge le hand history di PokerStars (cash game No Limit Hold'em), calcola risultati e statistiche e tiene un archivio degli avversari con etichette e note. Serve per l'analisi **dopo** la sessione: non è un HUD e non va usata mentre si gioca.

Questo file è il punto di partenza del repository: descrive cosa costruire, come leggere i dati, come calcolare ogni numero e con quali valori verificare che i calcoli siano giusti.

---

## 1. Obiettivi

1. **Importare** uno o più file di hand history trascinandoli nel browser.
2. **Calcolare** per ogni sessione: mani giocate, risultato netto, ricariche, stack finale, statistiche dell'hero.
3. **Mostrare** il risultato cumulato (grafico mano per mano), le statistiche complessive dell'hero confrontate con valori di riferimento, l'elenco delle sessioni.
4. **Archiviare gli avversari**: statistiche cumulate su tutte le sessioni, etichetta (profilo) e note modificabili.
5. **Esportare per l'analisi con Claude**: un riepilogo testuale della sessione e le mani scelte, nel formato originale, da incollare in chat.
6. **Backup**: esportare e reimportare tutti i dati in un file JSON.

Fuori dagli obiettivi (per ora): HUD in tempo reale, tornei, Omaha, altri siti, sincronizzazione tra dispositivi.

## 2. Principi

- **Local-first.** Tutto avviene nel browser. Nessuna chiamata di rete, nessun server, nessun dato inviato a terzi. Le hand history contengono i nomi di altri giocatori.
- **Uso dopo la sessione.** PokerStars vieta l'assistenza in tempo reale; l'app non deve avere funzioni pensate per essere consultate durante una mano (nessun overlay, nessun consiglio sulla mano in corso).
- **Numeri verificabili.** Ogni statistica ha una definizione esatta (sezione 6) e dei valori di riferimento calcolati su file reali (sezione 11). Un cambiamento al parser che modifica quei valori è un bug finché non si dimostra il contrario.
- **Importi in centesimi interi.** Mai fare somme di denaro in virgola mobile: `€0.07` diventa `7`. Si converte in euro o in big blind solo per la visualizzazione.
- **Interfaccia in italiano, codice in inglese.**

## 3. Stack e struttura del repository

- **Vite + React + TypeScript** (versioni stabili correnti).
- **Vitest** per i test.
- **Dexie** (wrapper di IndexedDB) per la persistenza.
- Grafici in **SVG scritto a mano** (il grafico è uno solo e semplice; nessuna libreria di grafici).
- Nessun framework CSS obbligatorio: CSS modules o un solo foglio di stile con variabili.

```
poker-tracker/
├─ SPEC.md                    ← questo file
├─ README.md                  ← come avviare, testare, fare il build
├─ fixtures/                  ← hand history di test (vedi sezione 11; valutare .gitignore)
├─ src/
│  ├─ parser/
│  │  ├─ splitHands.ts        ← file → array di testi di mano
│  │  ├─ parseHand.ts         ← testo → oggetto Hand
│  │  ├─ money.ts             ← "€0.07" → 7 (centesimi)
│  │  └─ positions.ts
│  ├─ stats/
│  │  ├─ handStats.ts         ← contatori per giocatore di una singola mano
│  │  ├─ aggregate.ts         ← somma dei contatori
│  │  └─ sessions.ts          ← raggruppamento in sessioni, ricariche
│  ├─ labels/autoLabel.ts
│  ├─ db/                     ← schema Dexie, import, backup
│  ├─ export/claudeExport.ts
│  ├─ ui/                     ← componenti React
│  └─ main.tsx
└─ tests/                     ← test del parser e delle statistiche sulle fixture
```

## 4. Formato delle hand history (input)

### 4.1 File

- Testo UTF-8 **con BOM** (`EF BB BF`) e fine riga **CRLF**: togliere il BOM e normalizzare `\r\n` → `\n` prima di tutto.
- Un file contiene le mani di un tavolo; le mani sono separate da **due o più righe vuote**. Dividere con `/\n{3,}/` e scartare i blocchi vuoti; togliere le righe vuote iniziali e finali di ogni blocco.
- Nome tipico del file: `HH20261124_Thusnelda_VII_-__0_01-_0_02_-_EUR_No_Limit_Hold_em.txt`.
- Lo stesso hand ID può comparire in più file (reimportazioni): deduplicare per hand ID.

### 4.2 Esempio di mano

Nomi dei giocatori inventati (è la fixture `tests/fixtures/example.txt`).

```
PokerStars Hand #262800000001:  Hold'em No Limit (€0.01/€0.02 EUR) [ADM ID: TEST0000000000001] - 2026/11/25 12:16:12 CET [2026/11/25 6:16:12 ET]
Table 'Testtable I' 6-max Seat #5 is the button
Seat 1: AlphaOne (€0.85 in chips)
Seat 2: BetaTwo (€2 in chips)
Seat 3: HeroPlayer (€1.99 in chips)
Seat 4: GammaFour (€3.17 in chips)
Seat 5: DeltaFive (€1.77 in chips)
Seat 6: EpsSix (€2.06 in chips)
EpsSix: posts small blind €0.01
AlphaOne: posts big blind €0.02
*** HOLE CARDS ***
Dealt to HeroPlayer [Ad Kc]
BetaTwo: raises €0.03 to €0.05
HeroPlayer: raises €0.09 to €0.14
GammaFour: folds
DeltaFive: folds
EpsSix: folds
AlphaOne: calls €0.12
BetaTwo: folds
*** FLOP *** [Ts 5d 9s]
AlphaOne: checks
HeroPlayer: bets €0.16
AlphaOne: folds
Uncalled bet (€0.16) returned to HeroPlayer
HeroPlayer collected €0.32 from pot
HeroPlayer: doesn't show hand
*** SUMMARY ***
Total pot €0.34 | Rake €0.02
Board [Ts 5d 9s]
Seat 1: AlphaOne (big blind) folded on the Flop
Seat 2: BetaTwo folded before Flop
Seat 3: HeroPlayer collected (€0.32)
Seat 4: GammaFour folded before Flop (didn't bet)
Seat 5: DeltaFive (button) folded before Flop (didn't bet)
Seat 6: EpsSix (small blind) folded before Flop
```

Le righe dei seat possono avere uno spazio finale; le righe di azione anche (`folds `). Fare sempre `trimEnd()`.

### 4.3 Righe da riconoscere

I nomi dei giocatori **non contengono spazi** ma possono contenere caratteri come `/` (es. `Ab9//123`): usare `\S+` per il nome e mai `\w+`.

| Riga | Espressione | Uso |
|---|---|---|
| Intestazione | `^PokerStars Hand #(\d+):\s+Hold'em No Limit \(€([\d.]+)/€([\d.]+) EUR\).* - (\d{4}/\d{2}/\d{2} \d{1,2}:\d{2}:\d{2}) (\S+)` | ID, small/big blind, data e ora locale, fuso |
| Tavolo | `^Table '([^']+)' (\d+)-max Seat #(\d+) is the button` | nome tavolo, max giocatori, seat del bottone |
| Seat | `^Seat (\d+): (\S+) \(€([\d.]+) in chips\)(.*)$` | giocatore, stack iniziale; **escludere** se il resto contiene `is sitting out` |
| Blind | `^(\S+): posts (small blind\|big blind\|small & big blinds) €([\d.]+)` | contributo al piatto; definisce SB e BB |
| Carte hero | `^Dealt to (\S+) \[(.+?)\]` | carte dell'hero (il nome qui è anche l'hero) |
| Strada | `^\*\*\* (HOLE CARDS\|FLOP\|TURN\|RIVER\|SHOW DOWN\|SUMMARY) \*\*\*(.*)` | cambio di strada; board dal resto della riga |
| Fold / check | `^(\S+): (folds\|checks)` | azione |
| Call / bet | `^(\S+): (calls\|bets) €([\d.]+)( and is all-in)?` | azione e importo **aggiuntivo** |
| Raise | `^(\S+): raises €([\d.]+) to €([\d.]+)( and is all-in)?` | azione; l'importo che conta è il **totale** della strada (`to`) |
| Restituzione | `^Uncalled bet \(€([\d.]+)\) returned to (\S+)` | da sottrarre al contributo |
| Vincita | `^(\S+) collected €([\d.]+) from (pot\|main pot\|side pot(?:-\d+)?)` | può comparire più volte per lo stesso giocatore (side pot) |
| Showdown (riepilogo) | nella sezione SUMMARY: `^Seat \d+: (\S+).*?(showed\|mucked) \[` | il giocatore è arrivato allo showdown |
| Rake | `Rake €([\d.]+)` nella riga `Total pot` | rake della mano |

### 4.4 Righe da ignorare (ma che devono essere tollerate)

`sits out`, `has timed out`, `has timed out while disconnected`, `is disconnected`, `is connected`, `leaves the table`, `joins the table at seat #N`, `said, "..."`, `shows [..] (...)` e `mucks hand` nel corpo (lo showdown si legge dal riepilogo), `doesn't show hand`, `Board [...]`. Qualsiasi riga non riconosciuta va ignorata, **non** deve far fallire l'import; in modalità debug va contata e mostrata.

### 4.5 Varianti note da gestire

- Giocatori seduti ma fuori (`is sitting out`): non sono nella mano.
- Tavoli a meno di 6 giocatori, fino all'heads-up. In heads-up il bottone posta lo small blind (`(button) (small blind)` nel riepilogo).
- Side pot multipli (`Main pot`, `Side pot`, `Side pot-1`…).
- All-in con importo minore della puntata da chiamare.
- Il client italiano (PokerStars.it) può cambiare formato: le hand history devono essere salvate **in inglese**. Se una mano non ha l'intestazione attesa, scartarla e segnalarla.
- Da verificare quando capiteranno: tavoli Zoom, straddle, ante, `posts small & big blinds` (giocatore che rientra), cash-out a metà mano.

## 5. Modello dei dati

```ts
type Cents = number;                       // importi in centesimi interi
type Street = "PRE" | "FLOP" | "TURN" | "RIVER";
type Action = { street: Street; player: string; kind: "fold" | "check" | "call" | "bet" | "raise"; amount?: Cents; allIn?: boolean };

interface Hand {
  id: string;                              // "262817359906"
  table: string;                           // "Botolphia VII"
  maxSeats: number;                        // 6
  playedAt: string;                        // "2026-11-25T12:16:12" ora locale del sito
  sb: Cents; bb: Cents;                    // 1, 2
  buttonSeat: number;
  players: { seat: number; name: string; stack: Cents }[];   // solo chi è nella mano
  positions: Record<string, Position>;     // vedi 6.4
  heroName: string | null;                 // dalla riga "Dealt to"
  heroCards: string | null;                // "Ad Kc"
  board: string[];                         // ["Ts","5d","9s", ...]
  actions: Action[];
  net: Record<string, Cents>;              // risultato netto di ogni giocatore (6.2)
  sawFlop: boolean;
  showdown: string[];                      // giocatori arrivati allo showdown
  winners: string[];                       // giocatori con almeno un "collected"
  rake: Cents;
  raw: string;                             // testo originale, per l'export
}

interface Counters {                       // contatori grezzi, sommabili tra mani e sessioni
  hands: number; vpip: number; pfr: number; limp: number;
  threeBet: number; threeBetOpp: number; foldTo3Bet: number; foldTo3BetOpp: number;
  flops: number; wtsd: number; wsd: number;
  cbet: number; cbetOpp: number; aggr: number; calls: number;
  net: Cents;
}

interface Session { id: string; table: string; date: string; handIds: string[]; heroStart: Cents; heroEnd: Cents; rebuys: Cents; net: Cents; hero: Counters; summary?: string }
interface PlayerProfile { name: string; label?: Label; note?: string; claudeLabel?: Label; claudeNote?: string }
type Label = "Regular forte" | "Regular medio" | "Regular con leak" | "Roccia" | "Ibrido / bot" | "Fish" | "Balena";
```

Le statistiche degli avversari **non** si salvano: si ricalcolano dalle mani in archivio (sono poche migliaia, il calcolo è immediato). Si salvano solo i profili (etichetta e nota).

## 6. Algoritmi

### 6.1 Parsing

Una passata riga per riga con una variabile `street` corrente. Le azioni prima di `*** HOLE CARDS ***` sono solo i blind. Dopo `*** SHOW DOWN ***` non ci sono più azioni di gioco.

### 6.2 Risultato netto di ogni giocatore

Per ogni giocatore, mantenere `committedThisStreet` (azzerato a ogni cambio di strada) e `committedTotal`:

- `posts … €x` → `+x` su entrambi;
- `calls €x` / `bets €x` → `+x` su entrambi;
- `raises €a to €t` → aggiunta = `t − committedThisStreet`; poi `committedThisStreet = t`;
- `Uncalled bet (€x) returned to P` → `returned[P] += x`;
- `P collected €x from …` → `collected[P] += x` (sommare tutte le righe).

`net[P] = collected[P] + returned[P] − committedTotal[P]`.

Verifica di coerenza per ogni mano: la somma dei `net` di tutti i giocatori deve essere uguale a `−rake` (al centesimo). Se non lo è, la mano va segnalata.

### 6.3 Sessioni e ricariche

- **Sessione** = insieme delle mani dello stesso tavolo nello stesso giorno, ordinate per hand ID. Con il multi-tavolo ogni tavolo è una sessione separata.
- **Serata** = gruppo di sessioni giocate insieme:
  - le sessioni si ordinano per inizio (prima mano);
  - una sessione entra nella serata corrente se inizia entro **60 minuti** dalla fine della serata, cioè dall'ultima mano finora; altrimenti apre una serata nuova;
  - così rientrano i tavoli sovrapposti e le pause brevi, anche a cavallo della mezzanotte;
  - la data della serata è quella di inizio, e i suoi totali (mani, netto, ricariche, bb) sono la somma delle sessioni.
- Per l'hero, tra una mano e la successiva: `atteso = stack[i] + net[i]`. Se `stack[i+1] − atteso > 0` è una **ricarica** di quell'importo (tolleranza 0). Se è negativo, segnalare un'incoerenza.
- `heroEnd = stack[ultima] + net[ultima]`.
- Controllo: `heroEnd − heroStart − rebuys = Σ net` della sessione.

### 6.4 Posizioni

Non dedurle dal numero di seat (ci sono seat vuoti e giocatori seduti fuori). Procedura:

1. SB e BB dalle righe `posts small blind` / `posts big blind`. In heads-up il bottone è anche SB.
2. BTN = giocatore al `Seat #N is the button`.
3. Gli altri, andando a ritroso dal BTN in ordine di seat tra i giocatori presenti: CO, HJ, UTG.

Con 6 giocatori: UTG, HJ, CO, BTN, SB, BB. Con meno giocatori si tolgono prima UTG, poi HJ, poi CO.

### 6.5 Statistiche (definizioni esatte)

Le statistiche si calcolano per ogni giocatore presente nella mano. **Preflop** si considerano solo le azioni volontarie (non i blind). Durante la scansione delle azioni preflop si tiene `raises` = numero di rilanci già fatti prima dell'azione corrente, `lastRaiser` e `opener` (il primo a rilanciare).

| Contatore | Si incrementa quando |
|---|---|
| `hands` | il giocatore è nella mano |
| `vpip` | ha fatto almeno un `call` o un `raise` preflop |
| `pfr` | ha fatto almeno un `raise` preflop |
| `limp` | fa `call` quando `raises == 0` (compreso il SB che completa) |
| `threeBetOpp` | è la sua **prima** azione preflop, `raises == 1` e non è lui il `lastRaiser` |
| `threeBet` | nelle stesse condizioni di `threeBetOpp`, l'azione è `raise` |
| `foldTo3BetOpp` | è l'`opener`, `raises == 2` ed è la sua **seconda** azione preflop |
| `foldTo3Bet` | nelle stesse condizioni, l'azione è `fold` |
| `flops` | c'è stato il flop e non ha foldato preflop |
| `wtsd` | ha visto il flop ed è nell'elenco `showdown` |
| `wsd` | `wtsd` e ha vinto almeno una parte del piatto |
| `cbetOpp` | è l'ultimo rilanciatore preflop, ha visto il flop e **prima della sua prima azione al flop** nessuno ha puntato |
| `cbet` | nelle stesse condizioni, la sua prima azione al flop è `bet` |
| `aggr` | ogni `bet` o `raise` dal flop in poi |
| `calls` | ogni `call` dal flop in poi |
| `net` | somma dei `net` delle mani |

Statistiche mostrate:

| Statistica | Formula | Riferimento (regular 6-max) |
|---|---|---|
| VPIP | `vpip / hands` | 22–27% |
| PFR | `pfr / hands` | 18–23% |
| 3-bet | `threeBet / threeBetOpp` | 5–9% |
| Fold contro 3-bet | `foldTo3Bet / foldTo3BetOpp` | 40–60% |
| C-bet al flop | `cbet / cbetOpp` | 55–70% |
| WTSD | `wtsd / flops` | 25–30% |
| W$SD | `wsd / wtsd` | 50–55% |
| AF | `aggr / calls` | 2–3 |
| Risultato | `net` in € e in bb (`net / bb`) | — |
| bb/100 | `100 × (net / bb) / hands` | — |

Accanto a ogni percentuale mostrare il numero di casi se è sotto 20 («solo 8 casi»).

### 6.6 Etichetta automatica (solo suggerimento)

Si usa solo se il giocatore non ha un'etichetta scelta dall'utente o importata da Claude:

- meno di 15 mani → nessuna («da osservare»);
- VPIP ≥ 55% → **Balena**;
- VPIP ≥ 35% e VPIP − PFR ≥ 10 punti → **Fish**;
- VPIP ≤ 15% → **Roccia**;
- altrimenti nessuna.

Sotto le 45 mani l'etichetta mostra un indicatore di campione piccolo.

Precedenza: etichetta dell'utente > etichetta di Claude > etichetta automatica.

### 6.7 Statistiche per posizione

Per ogni mano dell'hero si prende la sua posizione (6.4) e si sommano i contatori della mano (6.5) nella riga di quella posizione. Il risultato in bb si somma mano per mano (`net / bb` di ciascuna mano). Ordine delle righe: UTG, HJ, CO, BTN, SB, BB; le posizioni senza mani non compaiono. La somma delle righe è uguale ai totali dell'hero.

### 6.8 Risultati per mano iniziale

Le carte dell'hero (`Dealt to`) si riducono a una delle 169 classi: coppia (`QQ`), suited (`AKs`) o offsuit (`AKo`), con il rango più alto per primo. Per ogni classe: numero di mani, mani VPIP e risultato in bb sommato mano per mano. Griglia 13×13 con ranghi da A a 2: coppie in diagonale, suited sopra, offsuit sotto. La somma della griglia è uguale al totale delle mani con carte note.

### 6.9 Linee showdown / senza showdown

Il grafico cumulato (in bb, mano per mano, sessioni nell'ordine dell'elenco) ha tre linee:
- **totale**;
- **showdown**: mani in cui l'hero è nell'elenco `showdown` (6.1, dal riepilogo `showed` / `mucked`);
- **senza showdown**: tutte le altre, compresi i piatti vinti senza mostrare.

A ogni mano: totale = showdown + senza showdown.

**Selezione nel grafico.**
- Un tratto è un intervallo di indici della serie (mani dell'hero nell'ordine del grafico), estremi inclusi.
- I suoi bb sono la differenza dei cumulati, cioè il valore all'ultimo indice meno quello prima del primo, separatamente per totale, showdown e senza showdown.
- Con un clic, cioè uno spostamento del puntatore di al massimo 5 px, si seleziona la sessione che contiene la mano; le sessioni senza mani dell'hero si ignorano.
- La somma dei tratti delle sessioni è uguale al totale.

### 6.10 Filtri per periodo e stake

Il filtro si applica alle **sessioni**: una sessione è un solo tavolo, un solo giorno e un solo stake, così ricariche e stack restano coerenti. Tutto ciò che il Riepilogo e l'elenco delle sessioni calcolano deriva dalle sessioni filtrate.
- **Periodo**: tutto; oggi (data locale del browser; si aggiorna da solo al cambio di giorno); ultimi 7 giorni (oggi e i 6 precedenti); ultimi 30 giorni; intervallo personalizzato. Per «oggi» c'è anche un pulsante rapido. Gli estremi sono inclusi e si confronta la data della sessione (ora locale del sito).
- **Stake**: `€sb/€bb` della prima mano della sessione.

Il filtro resta salvato in `settings` (chiave `filters`). Il bb/100 si calcola dal risultato in bb sommato mano per mano, così è corretto anche con stake diversi.

### 6.11 All-in EV

**Spot.** Una mano è uno spot di all-in se:
- l'hero arriva allo showdown con **esattamente un avversario**;
- le carte di entrambi sono note (`Dealt to` e `showed` / `mucked` nel riepilogo);
- almeno un'azione è all-in;
- l'ultima azione di gioco avviene **prima del river**.

**Calcolo.**
- **Equity:** esatta, enumerando tutte le carte mancanti al board a partire da quelle note alla strada dell'ultima azione (0 preflop, 3 al flop, 4 al turn); il pareggio vale metà.
- **Risultato atteso** dell'hero: `equity × (piatto − rake) − investito`, dove `investito` è al netto delle restituzioni.
- **Linea «all-in EV»:** come il totale (6.9), ma ogni spot conta con il risultato atteso invece di quello reale.
- **«Fortuna»:** reale − atteso, sommato sugli spot.

**Limiti.**
- Gli all-in prima del river con più di due giocatori allo showdown restano con il risultato reale e sono contati a parte.
- Se dopo l'all-in dell'hero altri giocatori continuano a puntare e poi uno folda, l'equity si calcola alla strada dell'ultima azione: è un'approssimazione.

**Valutatore.** Le mani a 7 carte sono verificate contro un valutatore di riferimento (migliore delle 21 mani da 5) su 20.000 coppie casuali. Il calcolo gira in un Web Worker: un all-in preflop richiede 1.712.304 board.

### 6.12 Replay della mano

Il replay rilegge il testo originale con le stesse espressioni del parser (4.3) e produce un passo per ogni evento:
1. giocatori seduti;
2. un passo per ogni blind;
3. carte distribuite;
4. un passo per ogni azione (un rilancio «a X» mette `X − puntata già davanti`);
5. a ogni cambio di strada le puntate vanno al centro e si scopre il board;
6. puntata non chiamata restituita;
7. showdown, con le carte di chi è nell'elenco `showdown`;
8. un passo per ogni `collected`;
9. passo finale con i risultati.

Le carte degli avversari note dal riepilogo restano coperte fino allo showdown, salvo l'interruttore «Mostra tutte le carte».

**Invarianti** (testati su tutte le mani delle fixture):
- a ogni passo, `Σ stack + Σ puntate + piatto + rake prelevato` = totale iniziale;
- all'ultimo passo il piatto è 0, il rake è quello della mano e ogni stack = stack iniziale + netto.

## 7. Persistenza

Database IndexedDB tramite Dexie, nome `poker-tracker`, versione 1:

| Tabella | Chiave | Contenuto |
|---|---|---|
| `hands` | `id` | oggetto `Hand` completo, compreso `raw` |
| `sessions` | `id` (`table + data`) | oggetto `Session` |
| `profiles` | `name` | etichetta e nota dell'utente, etichetta e nota di Claude |
| `settings` | `key` | `heroName`, preferenze di visualizzazione |

- **Import idempotente**: reimportare lo stesso file non cambia nulla (dedup per hand ID, sessioni ricalcolate).
- **Backup**: esporta un JSON `{ version, exportedAt, hands, sessions, profiles, settings }`; l'import del backup sostituisce o unisce (chiedere all'utente).
- Avviso nell'interfaccia: i dati restano solo in questo browser; fare il backup periodicamente.
- Se lo spazio lo richiedesse in futuro, `raw` si può comprimere; non serve per ora (una mano occupa circa 1–2 KB).

## 8. Interfaccia

Stile coerente con l'app di studio esistente: tema scuro, testi color carta.

```
--ink: #14181C;  --ink-soft: #1C2229;  --paper: #F1E8D6;  --paper-dim: #E4D9C0;
--gold: #C9A24B; --red: #B5534F;       --clear: #6FA386;  --pine: #3E6353;  --muted: #8A8375;
font: Fraunces (titoli), Inter (testo), IBM Plex Mono (numeri)
```

Colori delle etichette: Regular forte `#B5534F`, Regular medio `#C98A3A`, Regular con leak `#C9A24B`, Roccia `#6C8FB8`, Ibrido / bot `#8A8375`, Fish `#6FA386`, Balena `#3E6353`.

Schermate:

1. **Import** — area di trascinamento file + pulsante «Scegli file». Dopo l'import: mani lette, nuove, duplicate, scartate (con motivo).
2. **Riepilogo**:
   - sessioni, mani, risultato (bb ed €), bb/100;
   - grafico del risultato cumulato in bb mano per mano, con linee verticali tra le sessioni. Un clic sul trattino colorato di una voce della legenda nasconde o rimostra quella linea: la scala verticale segue le linee visibili, l'ultima visibile non si può nascondere e la scelta resta salvata in `settings` (chiave `chartHidden`). Trascinando sul grafico si seleziona un tratto, cliccando una sessione; si può fare anche da tastiera, con i campi «dalla mano / alla mano» e «sessione precedente / successiva». Sotto compaiono il riepilogo del tratto e l'elenco delle sue mani, che si aprono nel replayer, e la selezione si toglie con un clic fuori dal grafico e dal pannello, con Esc o cambiando i filtri;
   - riquadro «Le tue statistiche» con i valori fuori riferimento evidenziati.
3. **Sessioni** — elenco dalla più recente: data, tavolo, mani, risultato, ricariche. Dettaglio sessione: statistiche dell'hero nella sessione, **le 10 mani con il piatto più grande in cui l'hero ha messo soldi** (posizione, carte, risultato), nota libera, selezione delle mani da esportare.
4. **Avversari** — ricerca per nome o etichetta, ordinamento per mani / VPIP / ultima sessione; riga con nome, mani, VPIP/PFR, etichetta. Dettaglio: tutte le statistiche, sessioni in cui è comparso, mani mostrate allo showdown, nota di Claude, etichetta e nota modificabili.
5. **Mani**: elenco di tutte le mani dell'hero.
   - Rispetta i filtri di periodo e stake.
   - Filtri propri: posizione; tipo (arrivate allo showdown, con un all-in in cui l'hero non ha foldato, VPIP); risultato (vinte o perse); carte, a testo libero («AK» = AKs e AKo, «AKs», «QQ», maiuscole e ordine indifferenti).
   - Ordinamento: più recenti, piatto più grande (in bb), perdite o vincite maggiori.
   - Paginazione da 50.
   - I filtri restano nell'URL. Cliccando una riga si apre la mano e, da lì, «mano precedente / successiva» segue la stessa lista.
6. **Mano**: replay grafico passo per passo (6.12) su un tavolo ovale con l'hero in basso. Si va avanti e indietro con ◀ ▶ o con le frecce della tastiera (Home/End per inizio e fine). Sotto, i giocatori con i risultati e il testo originale con le azioni evidenziate per strada, più il pulsante «Copia».
7. **Impostazioni** — nome dell'hero, backup ed eliminazione dei dati.

Accessibilità: tutti i controlli raggiungibili da tastiera, `aria-label` sugli elementi solo icona, contrasto sufficiente sul tema scuro.

Acronimi (VPIP, PFR, 3-bet, C-bet, WTSD, W$SD, AF, bb, bb/100, all-in EV, posizioni, s/o) con tooltip esplicativo: si apre al passaggio del mouse e al focus da tastiera, si chiude con Esc ed è letto dai lettori di schermo. Le spiegazioni stanno in un unico glossario (`src/ui/glossary.ts`), coerente con le definizioni della sezione 6.

## 9. Esportazione per Claude

Pulsante nel dettaglio sessione. Produce un testo da copiare, nel formato:

```
SESSIONE Botolphia VII — 2026-11-25 — 79 mani
Risultato hero: +218,0 bb (+€4,36), ricariche €0,97, stack finale €7,33
Hero: VPIP 34% · PFR 20% · 3-bet 19% (26 casi) · C-bet 64% · WTSD 27% · W$SD 57% · AF 1,9
Avversari principali: GiocatoreA 78 mani 33/26 [Regular con leak] · GiocatoreB 57 mani 39/23 [Fish] · …

MANI SELEZIONATE
<testo originale delle mani, separate da due righe vuote>
```

Le mani selezionate restano nel formato originale di PokerStars, così possono essere caricate anche su GTO Wizard.

Anche l'operazione inversa: **importare le etichette e le note di Claude** incollando un JSON `{ "nome": { "label": "...", "note": "..." } }`, che va in `claudeLabel` / `claudeNote` senza toccare quelle dell'utente.

## 10. Dati iniziali

Etichette e note già assegnate nelle analisi delle prime sessioni (da importare come `claudeLabel` / `claudeNote`) e riepiloghi delle sessioni (campo `summary`). Contengono nomi e giudizi su altri giocatori, quindi **non stanno nel repository**: si tengono in un file JSON locale (`private/seed.json`, fuori da git) e si caricano da Impostazioni → «Dati iniziali».

```json
{
  "players": { "nome": { "label": "Fish", "note": "..." } },
  "sessionSummaries": { "Nome tavolo": "riepilogo" }
}
```

- Le etichette vanno in `claudeLabel` / `claudeNote`, senza toccare quelle dell'utente.
- Un riepilogo si applica alle sessioni di quel tavolo che non ne hanno già uno; i tavoli non ancora importati vengono segnalati.
- L'operazione è idempotente e si può ripetere dopo aver importato altre sessioni.
- I numeri di mano `#n` nei riepiloghi sono la posizione della mano nel file, a partire da 1.

## 11. Test e valori di riferimento

Fixture: i sei file di hand history in `fixtures/` (NL2 €0,01/€0,02) e il file `fixtures/reference.json` con il nome dell'hero e i valori attesi, compresi quelli che citano altri giocatori. Contengono nomi di altri giocatori: `fixtures/` resta **fuori da git** (il repository è pubblico) e il README spiega dove procurarle. Senza quei file i test di riferimento vengono saltati.

I valori qui sotto sono stati calcolati con l'algoritmo di questa specifica e verificati contro gli stack della mano successiva. **I test devono riprodurli esattamente.**

### Sessioni (hero)

| Tavolo | Data | Mani | Netto € | Ricariche € | Stack finale € | Netto bb |
|---|---|---|---|---|---|---|
| Alhajoth VI | 2026-11-24 | 40 | +0,23 | 0 | 2,23 | +11,5 |
| Telamon VII | 2026-11-24 | 24 | −1,01 | 0 | 0,99 | −50,5 |
| Thusnelda VII | 2026-11-24 | 158 | −3,82 | 2,00 | 0,18 | −191,0 |
| Venetia VII | 2026-11-24 | 64 | −2,00 | 0 | 0,00 | −100,0 |
| Galanthus VII | 2026-11-25 | 88 | −0,91 | 1,13 | 2,22 | −45,5 |
| Botolphia VII | 2026-11-25 | 79 | +4,36 | 0,97 | 7,33 | +218,0 |
| **Totale** | | **453** | **−3,15** | **4,10** | | **−157,5** |

Ultimo valore del grafico cumulato: −157,5 bb.

### Contatori dell'hero per sessione

| Tavolo | hands | vpip | pfr | limp | 3b | 3bOpp | f3b | f3bOpp | flops | wtsd | wsd | cbet | cbetOpp | aggr | calls |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alhajoth VI | 40 | 12 | 8 | 0 | 0 | 15 | 0 | 0 | 10 | 0 | 0 | 3 | 4 | 7 | 5 |
| Telamon VII | 24 | 9 | 6 | 0 | 1 | 14 | 0 | 0 | 7 | 2 | 0 | 1 | 3 | 4 | 4 |
| Thusnelda VII | 158 | 49 | 37 | 0 | 5 | 55 | 4 | 4 | 39 | 10 | 5 | 7 | 16 | 26 | 11 |
| Venetia VII | 64 | 21 | 15 | 1 | 1 | 13 | 0 | 1 | 27 | 5 | 2 | 4 | 9 | 10 | 3 |
| Galanthus VII | 88 | 38 | 31 | 1 | 4 | 27 | 1 | 2 | 33 | 10 | 5 | 15 | 19 | 30 | 10 |
| Botolphia VII | 79 | 27 | 16 | 2 | 5 | 26 | 1 | 1 | 26 | 7 | 4 | 7 | 11 | 21 | 11 |
| **Totale** | 453 | 156 | 113 | 4 | 16 | 150 | 6 | 8 | 142 | 34 | 16 | 37 | 62 | 98 | 44 |

Statistiche risultanti: VPIP 34%, PFR 25%, 3-bet 11%, fold contro 3-bet 75% (8 casi), c-bet 60%, WTSD 24%, W$SD 47%, AF 2,2.

### Contatori di alcuni avversari (tutte le sessioni)

Per cinque avversari, `fixtures/reference.json` contiene `hands`, `vpip`, `pfr`, `limp`, `threeBet`, `threeBetOpp`, `flops`, `wtsd`, `wsd`, `aggr`, `calls` e i tavoli in cui sono comparsi. I nomi non si riportano qui.

### Altri test obbligatori

- Per **ogni** mano delle fixture: `Σ net = −rake`.
- Per ogni sessione: `heroEnd − heroStart − rebuys = Σ net`.
- Import doppio dello stesso file: nessuna mano o sessione duplicata.
- Mano con side pot (Botolphia VII, mano #77, hand ID 262817521703): l'hero vince €5,58 in due righe `collected`; il suo `net` è +€2,75.
- Giocatore seduto fuori (stessa mano): non compare tra i giocatori della mano.
- Nome con caratteri speciali (`/`, in Galanthus VII) letto correttamente.
- Mano in heads-up e a 3 giocatori: posizioni assegnate secondo 6.4.

## 12. Roadmap

1. **M1 — Parser e statistiche.** `splitHands`, `parseHand`, `net`, sessioni, ricariche, contatori. Tutti i test della sezione 11 verdi. Nessuna interfaccia.
2. **M2 — Persistenza e import.** Dexie, import da file con deduplicazione, report dell'import, backup ed eliminazione dati.
3. **M3 — Riepilogo e sessioni.** Grafico, statistiche dell'hero, elenco e dettaglio sessioni, mani più grandi.
4. **M4 — Avversari.** Elenco, dettaglio, etichette e note, etichetta automatica, import delle etichette di Claude, dati iniziali della sezione 10.
5. **M5 — Esportazione per Claude** e visualizzazione della singola mano.
6. **Fatto dopo M5:** statistiche per posizione (6.7), risultati per mano iniziale (6.8), linee showdown (6.9), filtri per periodo e stake (6.10), serate multi-tavolo (6.3).
7. **Dopo:** linea «all-in EV», tavoli Zoom.

Ogni milestone si chiude con: test verdi, build senza errori di TypeScript, prova manuale con le fixture.

## 13. Convenzioni

- TypeScript `strict`; nessun `any` nel parser e nelle statistiche.
- Funzioni del parser e delle statistiche **pure** (nessun accesso al database o al DOM), così sono testabili da sole.
- Commit piccoli, un argomento per commit, messaggio in italiano all'imperativo («Aggiungi calcolo delle ricariche»).
- Ogni bug trovato su una mano reale diventa una fixture minima con un test.
- Nessuna dipendenza che faccia richieste di rete a runtime.
