# 06 — Scope, decisioni e riflessioni

## 1. Scope realizzato

Il progetto è stato sviluppato in quattro iterazioni brevi. L'MVP rilasciato copre l'intero flusso “scopri → prenota → gestisci” per partecipanti e organizzatori, con un sottoinsieme deliberato del dominio della tesina.

### 1.1 Matrice di scope

| Funzionalità | RF | US | Stato | Evidenza / note |
| --- | --- | --- | --- | --- |
| Registrazione partecipante | RF01 | US01 | ✅ Implementato | Form + API, test su email duplicata e validazione. |
| Registrazione organizzatore con codice | RF02 | US02 | ✅ Implementato | Codice `ORGANIZZA2026`, test su codice errato. |
| Login, logout, ruoli, JWT | RF03 | US03 | ✅ Implementato | Test su credenziali errate e rotte protette. |
| Catalogo con ricerca e filtri | RF04 | US04 | ✅ Implementato | `q`, `type`, `from`, `to`, `available`, `period`, paginazione. |
| Dettaglio con disponibilità | RF05 | US04 | ✅ Implementato | Posti liberi calcolati in SQL. |
| Prenotazione con posto automatico | RF06 | US05 | ✅ Implementato | Posto per concerti, `null` per workshop/DJ set, test di concorrenza. |
| Annullamento prenotazione | RF07 | US06 | ✅ Implementato | Cancellazione logica, riuso del posto, controllo ownership. |
| Area personale “I miei posti” | RF08 | US07 | ✅ Implementato | Sezioni in arrivo / passati e annullati. |
| Creazione e pubblicazione evento | RF09 | US08 | ✅ Implementato | Validazione Zod, ownership dal token, anteprima form. |
| Modifica e annullamento evento | RF10 | US09 | ✅ Implementato | Blocco capienza sotto prenotati, annullamento atomico. |
| Dashboard occupazione | RF10 | US09 | ✅ Implementato | Statistiche aggregate e tabella eventi. |
| Collaboratori per evento | RF11 | US10 | 🗺️ Roadmap | Progettato: `event_collaborators`, permessi per evento. |
| Approvazione workshop | RF12a | US11 | 🗺️ Roadmap | Progettato: stato `IN_ATTESA`/`RIFIUTATA`. |
| Pagamenti | RF12b | US11 | 🗺️ Roadmap | Progettato: stato pagamento separato e conferma manuale del riferimento esterno. |
| Email transazionali | RF12c | US11 | 🗺️ Roadmap | Mailpit attivo, nessun invio implementato. |
| Lista d'attesa | — | — | 🗺️ Roadmap | Promozione automatica al liberarsi del posto. |
| Export CSV iscritti | — | — | 🗺️ Roadmap | Utile per la gestione all'ingresso. |
| Test frontend automatici | RNF05 | — | 🗺️ Roadmap | Collaudo UI manuale; suite API completa. |
| CI/CD | RNF05 | — | 🗺️ Roadmap | Build e test locali documentati. |

### 1.2 Cosa significa “MVP” in questo progetto

L'MVP non è una demo grafica: è un prodotto **utilizzabile end-to-end** per il caso d'uso principale. Un organizzatore può registrarsi, pubblicare una serata, vederla nel catalogo e controllare l'occupazione; un partecipante può registrarsi, prenotare, ricevere un posto e annullare. I tagli riguardano funzioni che aggiungono complessità organizzativa (collaboratori, approvazioni, pagamenti, email), non la solidità del flusso base.

La scelta è stata esplicita: **meglio un flusso completo e corretto che cinque funzioni a metà**. In particolare, la concorrenza sulle prenotazioni è stata trattata come requisito irrinunciabile, non come rifinitura: è il punto in cui un'app di eventi fallisce nella realtà.

Le estensioni sono stimate separatamente: **21 story point** oltre ai 38 dell'MVP, per un backlog complessivo di **59 SP**. US11 non è una singola schermata ma un'**epica** da 13 SP che tiene insieme approvazione dei workshop, pagamento esterno e notifiche: condividono lo stesso ciclo di vita della prenotazione e vanno progettati insieme per non duplicare le transizioni.

## 2. Decisioni tecniche

### ADR 01 — PostgreSQL invece di un database documentale

**Contesto:** il vincolo centrale è “mai più prenotazioni della capienza” e “mai due volte lo stesso posto”, anche con richieste simultanee.
**Decisione:** PostgreSQL con transazioni, `SELECT ... FOR UPDATE` e indici univoci parziali.
**Conseguenze:** i vincoli sono garantiti anche se il codice applicativo sbaglia; in cambio serve gestire migrazioni SQL e connessioni.
**Alternativa scartata:** MongoDB, dove i vincoli condizionati andrebbero replicati in applicazione con maggiore rischio.

### ADR 02 — Lock di riga + vincoli univoci, non solo controllo applicativo

**Contesto:** due utenti possono premere “Prenota” nello stesso millisecondo sull'ultimo posto.
**Decisione:** doppia difesa. La transazione blocca la riga evento e ricalcola il conteggio; gli indici parziali impediscono comunque duplicati.
**Conseguenze:** il caso critico è coperto da test con tre richieste concorrenti su capienza 1. Il costo è una breve serializzazione per evento, accettabile perché il collo di bottiglia è per singola serata, non globale.

### ADR 03 — Cancellazione logica

**Contesto:** annullare una prenotazione o un evento non deve cancellare lo storico.
**Decisione:** stati `CONFERMATA`/`ANNULLATA` e `PUBBLICATO`/`ANNULLATO`, con `cancelled_at`.
**Conseguenze:** i vincoli univoci sono parziali (`WHERE status = 'CONFERMATA'`), così un posto liberato è riassegnabile. Lo storico resta interrogabile per statistiche e assistenza.

### ADR 04 — JWT stateless per il MVP

**Contesto:** SPA + API, nessun requisito di revoca immediata.
**Decisione:** JWT HS256 firmato dal backend, conservato in `localStorage`, scadenza 7 giorni.
**Conseguenze:** semplicità e nessuna tabella sessioni; il logout è solo client-side. In produzione servirebbe refresh token breve + deny-list, oppure cookie `HttpOnly` con sessione server.

### ADR 05 — Validazione con Zod e servizi separati dalle route

**Contesto:** molti endpoint condividono regole (ownership, capienza, stati) e devono restare testabili.
**Decisione:** schema Zod per ogni input, servizi di dominio con transazioni, router sottili.
**Conseguenze:** errori `422` uniformi con `details` per campo; i test possono colpire l'API reale senza duplicare logica.

### ADR 06 — Design system custom invece di una libreria UI

**Contesto:** il progetto è didattico ma l'interfaccia doveva avere un'identità riconoscibile e accessibile.
**Decisione:** CSS custom con token, componenti React riusabili, nessuna dipendenza UI.
**Conseguenze:** pieno controllo su contrasto, focus, responsive e reduced motion; più codice CSS da mantenere. Il bundle resta leggero.

### ADR 07 — Docker Compose come unico ambiente

**Contesto:** il progetto deve essere valutabile e riproducibile su macchine diverse.
**Decisione:** quattro servizi (`db`, `mailpit`, `backend`, `frontend`), migrazioni e seed automatici e idempotenti.
**Conseguenze:** `docker compose up -d --build` è sufficiente. I test usano un database separato creato dall'init script, per non toccare i dati demo.

## 3. Difficoltà incontrate e soluzioni

### 3.1 Overbooking concorrente

**Problema:** il primo controllo “conto i posti e poi inserisco” è una race condition classica: due richieste leggono lo stesso conteggio e inseriscono entrambe.
**Soluzione:** transazione con lock dell'evento, conteggio e inserimento dentro la stessa sezione critica. Test dedicato con `Promise.all` su tre utenti e capienza 1: una sola `201`, due `409`, conteggio finale 1.
**Lezione:** i vincoli del database non sono un dettaglio implementativo, sono parte del contratto del dominio.

### 3.2 Riuso del posto dopo l'annullamento

**Problema:** un indice univoco semplice su `(event_id, seat_number)` avrebbe impedito di riassegnare il posto 1 dopo un annullamento.
**Soluzione:** indice univoco **parziale** limitato alle prenotazioni `CONFERMATA`. Il test verifica che, dopo l'annullamento del posto 1, il successivo utente riceva proprio il posto 1.

### 3.3 Riduzione della capienza su eventi già prenotati

**Problema:** abbassare la capienza sotto i posti già venduti crea una situazione incoerente.
**Soluzione:** controllo nel servizio con `409 CAPACITY_TOO_LOW` e messaggio che riporta il numero di prenotazioni attive. La UI mostra lo stesso vincolo con il minimo del campo numerico.
**Lezione:** la validazione non è solo “formato”: è una regola di business che dipende dallo stato.

### 3.4 Ownership vs ruolo

**Problema:** essere `ORGANIZZATORE` non significa poter modificare qualsiasi evento.
**Soluzione:** doppio controllo — ruolo a livello di route, ownership a livello di servizio. Test con due organizzatori diversi su modifica, annullamento e lista prenotazioni.
**Lezione:** l'autorizzazione è una decisione per risorsa, non solo per ruolo.

### 3.5 Lampeggio dell'interfaccia durante il bootstrap auth

**Problema:** al refresh di una pagina protetta, il contesto partiva senza utente e la UI mostrava per un istante lo stato ospite, con redirect errati.
**Soluzione:** stato `loading` nel contesto; le route protette e il dettaglio mostrano un loader finché `GET /auth/me` non termina. Il pulsante di prenotazione attende l'esito per non far apparire “Accedi per prenotare” a un utente già autenticato.

### 3.6 Date e fusi orari

**Problema:** `datetime-local` restituisce una stringa senza fuso; il database usa `TIMESTAMPTZ`.
**Soluzione:** conversione esplicita in ISO UTC lato client, parsing con `z.coerce.date()` lato API, formattazione con `Intl.DateTimeFormat('it-IT')` in visualizzazione. Le date sono mostrate nel fuso locale del browser.

### 3.7 Isolamento dei test

**Problema:** i test non devono cancellare i dati demo né dipendere dall'ordine di esecuzione.
**Soluzione:** database `accordo_test` separato, `TRUNCATE ... RESTART IDENTITY CASCADE` prima di ogni test, `fileParallelism: false` per evitare interferenze. La variabile `DATABASE_URL` viene forzata al database di test nel setup.

### 3.8 Scope creep

**Problema:** il dominio della tesina è ampio (collaboratori, approvazioni, pagamenti, email) e il rischio era consegnare molte funzioni incomplete.
**Soluzione:** backlog MoSCoW, MVP esplicito, estensioni documentate con modello previsto. La documentazione dichiara ciò che è operativo e ciò che è roadmap, senza ambiguità.

## 4. Verifica e risultati

| Verifica | Risultato |
| --- | --- |
| Test di integrazione API | 16/16 verdi (`docker compose exec backend npm test`) |
| Concorrenza su capienza 1 | 1 successo, 2 conflitti, nessun overbooking |
| Typecheck backend | Nessun errore |
| Typecheck frontend | Nessun errore |
| Build produzione frontend | Bundle generato, nessun errore |
| Avvio Docker da zero | Migrazioni + seed automatici, healthcheck verdi |
| Flussi UI | Registrazione, login, catalogo, prenotazione, sold out, area personale, dashboard, creazione/modifica/annullamento |
| Responsive | Verifica a 320–760 px, 900 px e desktop |
| Accessibilità | Focus visibile, skip link, label, `aria-live`, reduced motion |

**Scenari manuali eseguiti**

1. Login organizzatore → creazione evento con capienza 2 → comparsa nel catalogo.
2. Login partecipante → prenotazione posto 1 → disponibilità aggiornata.
3. Secondo partecipante → posto 2 → evento esaurito.
4. Terzo partecipante → `SOLD_OUT`; stesso partecipante → `ALREADY_BOOKED`.
5. Annullamento prenotazione → posto riassegnato.
6. Annullamento evento → prenotazioni chiuse, evento fuori dal catalogo.
7. Accesso a dashboard con ruolo partecipante → redirect.
8. Modifica evento di un altro organizzatore → errore e blocco UI.

## 5. Retrospettiva

### 5.1 Cosa ha funzionato

- **Vertical slices:** ogni iterazione ha prodotto un flusso usabile, non solo pezzi di backend.
- **Test sulla concorrenza scritti presto:** hanno guidato il design delle transazioni invece di essere un'aggiunta finale.
- **Documentazione come parte del prodotto:** ha costretto a dichiarare lo scope e a evitare promesse non mantenute.
- **Design system unico:** ha reso coerenti pagine pubbliche, area personale e dashboard senza componenti duplicati.
- **Docker come ambiente primario:** ha eliminato le differenze tra “funziona sulla mia macchina” e la consegna.

### 5.2 Cosa migliorare

- **Test frontend assenti:** i flussi UI sono verificati manualmente; una suite Playwright sui percorsi critici ridurrebbe le regressioni.
- **Nessuna CI:** typecheck, test e build andrebbero eseguiti su ogni push con GitHub Actions.
- **Rate limiting e revoca token:** necessari prima di un'esposizione pubblica.
- **Email solo progettate:** la casella Mailpit è pronta, ma senza outbox e worker il requisito resta roadmap.
- **Metriche di performance non misurate:** i target RNF04 sono ragionevoli ma non c'è un benchmark automatico.

### 5.3 Cosa faremmo diversamente

1. Introdurre **Playwright** già nello Sprint 2, quando il flusso di prenotazione si è stabilizzato.
2. Definire **una pipeline CI** prima della seconda iterazione, non alla fine.
3. Aggiungere **rate limiting** e header di sicurezza (`helmet`) fin dal primo rilascio, anche in locale.
4. Progettare **l'outbox email** insieme alla prenotazione, così l'estensione non tocca il servizio principale.

## 6. Roadmap

| Priorità | Intervento | Impatto | Sforzo | Dipendenze |
| --- | --- | --- | --- | --- |
| P0 | Test E2E Playwright sui 5 flussi critici | Alto | M | — |
| P0 | CI GitHub Actions: typecheck, test, build | Alto | S | — |
| P0 | Rate limiting su auth + helmet + CORS stretto | Alto | S | — |
| P1 | Collaboratori per evento | Medio | L | `event_collaborators` |
| P1 | Approvazione workshop + email esito | Alto | L | stato `IN_ATTESA`, outbox |
| P1 | Notifiche email (conferma, annullamento, evento) | Alto | M | SMTP, outbox, worker |
| P2 | Pagamento esterno con conferma manuale del riferimento | Medio | L | stato pagamento, webhook |
| P2 | Lista d'attesa con promozione automatica | Medio | M | stato `IN_ATTESA`, ordinamento |
| P2 | Export CSV iscritti | Basso | S | endpoint organizer |
| P3 | Dashboard analytics (andamento nel tempo) | Basso | M | aggregazioni |
| P3 | Tema chiaro / preferenze utente | Basso | S | design token |

**Legenda sforzo:** S ≤ 2 giorni, M ≤ 1 settimana, L > 1 settimana.

## 7. Competenze consolidate

- Modellazione relazionale con vincoli condizionati e cancellazione logica.
- Transazioni e concorrenza in PostgreSQL (`FOR UPDATE`, indici parziali, isolamento).
- Progettazione di API REST coerenti: status code, codici di errore, validazione e ownership.
- Autenticazione JWT con ruoli e hashing delle password.
- React con routing, contesto, gestione di stati asincroni e design system accessibile.
- Docker Compose per ambienti riproducibili e test isolati.
- Scrittura di User Stories, acceptance criteria Gherkin, casi d'uso UML e diagrammi di sequenza.
- Gestione dello scope: dire “no” a funzionalità fuori dall'MVP e documentarle come roadmap.

## 8. Conclusione

Accordo dimostra che un MVP può essere piccolo e allo stesso tempo solido: nove User Stories coprono il flusso completo, mentre le parti più complesse del dominio sono progettate e tracciate senza essere finte. Il valore tecnico principale non è il numero di schermate, ma il modo in cui il sistema protegge la risorsa più delicata — il posto a un evento — sotto concorrenza reale.

La documentazione in questa cartella è la fotografia onesta del progetto: ciò che funziona è verificato, ciò che manca ha una ragione, un modello e una priorità.
