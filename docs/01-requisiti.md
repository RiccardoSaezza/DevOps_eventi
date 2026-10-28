# 01 — Requisiti

> **Progetto:** Accordo — piattaforma di gestione e prenotazione eventi dal vivo
> **Autori:** Riccardo Catelani, Cristian Donca
> **Corso:** Sviluppo Agile e DevOps
> **Versione:** MVP 1.0
>
> **Legenda stato**
> `MVP` = implementato e verificato in questa iterazione.
> `Estensione` = analizzato e progettato, non implementato: vedi roadmap in [06](06-scope-e-riflessioni.md).
>
> **Legenda priorità MoSCoW**: `Must` irrinunciabile per il rilascio, `Should` importante ma aggirabile, `Could` desiderabile, `Won't` fuori scope dichiarato.

## 1. Contesto e obiettivi

Accordo nasce per sostituire la gestione artigianale degli eventi di una piccola realtà culturale: un foglio di calcolo per la capienza, una chat per le iscrizioni, un documento condiviso per il programma. Il problema non è organizzare la serata, ma **tenere allineati programma, posti e persone** quando le richieste arrivano in parallelo.

L'obiettivo del prodotto è offrire un unico punto in cui:

1. il pubblico scopre gli eventi e prenota senza attrito;
2. chi organizza pubblica, aggiorna e chiude le serate;
3. il sistema garantisce che il numero di prenotazioni non superi mai la capienza, nemmeno sotto richieste concorrenti.

### 1.1 Obiettivi misurabili

| Obiettivo | Misura | Target MVP |
| --- | --- | --- |
| Prenotazione senza attrito | Passi dalla scheda evento alla conferma | ≤ 3 (accedi, prenota, conferma) |
| Coerenza dei posti | Prenotazioni attive oltre capienza | 0, anche con richieste concorrenti |
| Unicità del posto | Due prenotazioni attive sullo stesso posto | 0 (vincolo DB) |
| Tempo di avvio ambiente | Da clone a stack attivo | ≤ 5 minuti con Docker Compose |
| Copertura dei flussi critici | Test di integrazione API | 16 test verdi |

### 1.2 Perimetro

**Dentro il perimetro MVP:** autenticazione con ruoli, catalogo e dettaglio eventi, prenotazione con posto automatico, annullamento, area personale, dashboard organizzatore, creazione/modifica/annullamento eventi.

**Fuori dal perimetro MVP, progettato per estensioni:** collaboratori con permessi per evento, approvazione manuale delle iscrizioni ai workshop, pagamenti, invio email transazionale, lista d'attesa, export CSV.

## 2. Attori

| Attore | Descrizione | Permessi |
| --- | --- | --- |
| **Visitatore** | Utente non autenticato. | Consulta catalogo e dettaglio; può registrarsi o accedere. |
| **Partecipante** | Utente autenticato con ruolo `PARTECIPANTE`. | Prenota, consulta e annulla le proprie prenotazioni. |
| **Organizzatore** | Utente autenticato con ruolo `ORGANIZZATORE`. | Tutto ciò che fa un partecipante, più crea e gestisce i propri eventi. |
| **Collaboratore** *(Estensione)* | Utente invitato a gestire un singolo evento. | Modifica i dati dell'evento assegnato, senza visibilità sugli altri. |
| **Servizio email** *(Estensione)* | Sistema esterno/secondario. | Riceve notifiche di conferma, annullamento e promozione. |

## 3. Requisiti funzionali

### RF01 — Registrazione del partecipante · `MVP` · `Must`

Il visitatore può creare un account indicando nome, email e password. L'email è normalizzata in minuscolo ed è univoca (indice `UNIQUE` su `lower(email)`). La password è hashata con bcrypt e non è mai restituita dall'API.

**Regole**

- nome 2–80 caratteri;
- email valida, massimo 254 caratteri, univoca;
- password 8–72 caratteri;
- ruolo predefinito `PARTECIPANTE`;
- al successo l'API restituisce `201`, il profilo pubblico e un JWT valido 7 giorni.

**Tracciabilità:** US01 · UC01

---

### RF02 — Registrazione dell'organizzatore con codice invito · `MVP` · `Must`

Un utente può registrarsi con ruolo `ORGANIZZATORE` solo se fornisce il codice invito configurato (`ORGANIZER_INVITE_CODE`, default demo `ORGANIZZA2026`). Il codice errato produce `403 INVALID_INVITE_CODE`; l'assenza del codice produce un normale account partecipante.

**Motivazione:** evitare che chiunque possa pubblicare eventi, senza introdurre nel MVP un flusso di verifica manuale o un provider di identità.

**Tracciabilità:** US02 · UC02

---

### RF03 — Accesso, sessione e logout · `MVP` · `Must`

L'utente si autentica con email e password. L'API verifica l'hash bcrypt e restituisce un JWT firmato HS256 con `sub`, `role`, `name` e scadenza. Il client conserva il token, lo invia come `Authorization: Bearer <token>` e lo elimina al logout. Il logout è locale (il token resta valido fino a scadenza, scelta accettata per il MVP).

**Regole**

- credenziali errate: `401 INVALID_CREDENTIALS`, senza distinguere email inesistente e password sbagliata;
- rotte protette senza token: `401 UNAUTHENTICATED`; token scaduto o non valido: `401 INVALID_TOKEN`;
- ruolo insufficiente: `403 FORBIDDEN`.

**Tracciabilità:** US03 · UC03

---

### RF04 — Catalogo eventi con ricerca e filtri · `MVP` · `Must`

Il catalogo mostra gli eventi `PUBBLICATO`, ordinati per data crescente, con paginazione. Filtri disponibili:

| Parametro | Comportamento |
| --- | --- |
| `q` | Ricerca case-insensitive su titolo, luogo e descrizione (`ILIKE`). |
| `type` | `CONCERTO`, `WORKSHOP` o `DJ_SET`. |
| `from` / `to` | Intervallo temporale sulla data di inizio. |
| `available=true` | Solo eventi con almeno un posto libero. |
| `period` | `upcoming` (default), `past`, `all`. |
| `page` / `limit` | Paginazione, `limit` massimo 100. |

Ogni elemento espone `bookedCount` e `availableSeats` calcolati dalle prenotazioni `CONFERMATA`. Gli eventi annullati non compaiono nel catalogo pubblico.

**Tracciabilità:** US04 · UC04

---

### RF05 — Dettaglio evento e disponibilità in tempo reale · `MVP` · `Must`

La scheda evento mostra titolo, descrizione, tipo, data e ora, luogo, organizzatore, capienza, posti prenotati e posti liberi. Lo stato del pulsante di prenotazione riflette il contesto: evento annullato, concluso, esaurito, già prenotato, accesso richiesto.

**Tracciabilità:** US04 · UC05

---

### RF06 — Prenotazione con assegnazione automatica del posto · `MVP` · `Must`

Un partecipante autenticato prenota un posto per un evento futuro e pubblicato.

**Regole**

- una sola prenotazione `CONFERMATA` per utente ed evento (indice univoco parziale);
- nessuna prenotazione oltre la capienza (controllo in transazione con `SELECT ... FOR UPDATE`);
- per i **concerti** il sistema assegna il primo posto libero da 1 a `capacity`; il posto è univoco tra le prenotazioni attive;
- per **workshop** e **DJ set** `seatNumber` è `null` (accesso senza posto numerato);
- eventi annullati, già iniziati o esauriti non sono prenotabili;
- la prenotazione è gratuita e immediata: nel MVP non esiste alcun pagamento.

**Errori**

| Codice | HTTP | Significato |
| --- | --- | --- |
| `EVENT_CANCELLED` | 409 | Evento annullato. |
| `EVENT_STARTED` | 409 | Data di inizio già passata. |
| `ALREADY_BOOKED` | 409 | Prenotazione attiva già esistente. |
| `SOLD_OUT` | 409 | Nessun posto disponibile. |
| `NOT_FOUND` | 404 | Evento inesistente. |

**Tracciabilità:** US05 · UC06

---

### RF07 — Annullamento della prenotazione · `MVP` · `Should`

Il partecipante annulla una propria prenotazione futura; il posto torna disponibile. L'annullamento è **logico**: la riga resta con `status = ANNULLATA` e `cancelled_at`, così lo storico e i conteggi restano coerenti.

**Regole**

- solo il proprietario della prenotazione o l'organizzatore dell'evento può annullare;
- non è possibile annullare una prenotazione già annullata (`409 ALREADY_CANCELLED`);
- non è possibile annullare dopo l'inizio dell'evento (`409 EVENT_STARTED`);
- un nuovo utente può riutilizzare il posto liberato.

**Tracciabilità:** US06 · UC07

---

### RF08 — Area personale “I miei posti” · `MVP` · `Must`

L'utente autenticato vede tutte le proprie prenotazioni, divise tra “In arrivo” e “Passati e annullati”, con titolo, luogo, data, stato della prenotazione, stato dell'evento e posto assegnato. Da qui può aprire il dettaglio o annullare una prenotazione attiva.

**Tracciabilità:** US07 · UC08

---

### RF09 — Creazione e pubblicazione di un evento · `MVP` · `Must`

L'organizzatore crea un evento con titolo, descrizione, tipo, data/ora futura, luogo e capienza (1–10.000). L'evento nasce `PUBBLICATO` ed è immediatamente visibile nel catalogo.

**Regole**

- validazione con Zod lato API e con controlli lato form;
- titolo 3–120 caratteri, luogo 2–160, descrizione massimo 4.000;
- la data deve essere futura;
- `created_by` è l'utente autenticato: nessun organizzatore può creare eventi a nome di altri.

**Tracciabilità:** US08 · UC09

---

### RF10 — Modifica e annullamento dell'evento · `MVP` · `Must`

Solo l'organizzatore proprietario può modificare o annullare un evento non ancora annullato.

**Regole di modifica**

- aggiornamento parziale o completo dei campi;
- la capienza non può scendere sotto il numero di prenotazioni attive (`409 CAPACITY_TOO_LOW`);
- un evento annullato non è modificabile (`409 EVENT_CANCELLED`);
- un organizzatore non proprietario riceve `403 FORBIDDEN`.

**Regole di annullamento**

- l'evento passa a `ANNULLATO` e tutte le prenotazioni attive passano a `ANNULLATA` nella stessa transazione;
- l'evento sparisce dal catalogo pubblico ma resta visibile nella dashboard e nello storico dei partecipanti;
- la risposta riporta `cancelledBookings`, utile per il feedback in UI;
- un secondo annullamento produce `409 ALREADY_CANCELLED`.

**Tracciabilità:** US09 · UC10, UC11

---

### RF11 — Collaboratori con permessi per evento · `Estensione` · `Could`

L'organizzatore proprietario può invitare altri utenti a collaborare su un singolo evento, assegnando un permesso limitato (es. sola modifica, oppure gestione prenotazioni). Il collaboratore non vede gli altri eventi dell'organizzatore e non può cambiare proprietario né cancellare l'evento senza autorizzazione esplicita.

**Modello previsto:** tabella `event_collaborators(event_id, user_id, permission)` con chiave composta e controllo di ownership esteso nei servizi. Nel MVP il controllo è `created_by === user.id`.

**Tracciabilità:** US10 · UC12 · roadmap

---

### RF12 — Ciclo di vita esteso della prenotazione · `Estensione` · `Could`

Raggruppa tre estensioni dello stesso ambito — rendere la prenotazione “governata” e notificata — progettate ma non incluse nel MVP:

| Sotto-requisito | Comportamento atteso | Stato |
| --- | --- | --- |
| **RF12a — Approvazione workshop** | L'iscrizione a un workshop nasce `IN_ATTESA`; l'organizzatore approva o rifiuta. In caso di rifiuto il posto torna disponibile. | Progettato |
| **RF12b — Pagamento tracciato** | Per gli eventi a pagamento la prenotazione registra lo stato del pagamento e il riferimento del provider esterno; l'organizzatore può confermare manualmente un pagamento ricevuto fuori piattaforma. | Progettato |
| **RF12c — Notifiche email** | Conferma prenotazione, annullamento, evento annullato e promozione da lista d'attesa generano email transazionali. In locale Mailpit cattura i messaggi. | Progettato, Mailpit già attivo |

**Vincolo di progetto:** queste estensioni non devono richiedere una riscrittura del modello. Gli stati sono già tipizzati e le transizioni avvengono nei servizi, quindi l'aggiunta di `IN_ATTESA`/`RIFIUTATA` e di un campo pagamento è incrementale.

**Tracciabilità:** US11 · UC13, UC14, UC15 · roadmap

## 4. Requisiti non funzionali

### RNF01 — Sicurezza delle credenziali e delle sessioni · `Must`

- Password hashate con bcrypt (cost 12); nessuna password in chiaro nei log o nelle risposte.
- JWT firmato HS256, scadenza configurabile (default 7 giorni), secret obbligatorio in produzione.
- Messaggi di login indistinguibili tra email inesistente e password errata.
- Query parametrizzate su tutte le accessi al database (nessuna concatenazione di input).
- Segreti e credenziali fuori dal repository, forniti tramite variabili d'ambiente.

**Verifica:** test su login errato, rotte protette, ruoli; assenza di segreti in `git`.

### RNF02 — Integrità dei dati e concorrenza · `Must`

Il sistema non deve mai superare la capienza né assegnare due volte lo stesso posto, anche con richieste simultanee.

**Meccanismi**

1. transazione `BEGIN … COMMIT` con `SELECT ... FOR UPDATE` sulla riga evento;
2. controllo del conteggio delle prenotazioni attive dentro la transazione;
3. indici univoci parziali su `(event_id, user_id)` e `(event_id, seat_number)` per le sole prenotazioni `CONFERMATA`;
4. cancellazione logica per non perdere lo storico.

**Verifica:** test di concorrenza con tre richieste su capienza 1 — esattamente una `201`, due `409`.

### RNF03 — Usabilità e accessibilità · `Should`

- Interfaccia interamente in italiano, responsive da 320 px a desktop.
- Navigazione da tastiera, focus visibile, `aria-label` sui controlli icona, `aria-live` per toast e messaggi di stato.
- Contrasto conforme a WCAG 2.1 AA per testo e controlli; rispetto di `prefers-reduced-motion`.
- Stati di caricamento, vuoto ed errore sempre espliciti: nessun “schermo bianco”.
- Messaggi di errore in linguaggio naturale, con indicazione del campo quando possibile.

**Verifica:** revisione manuale con browser e viewport mobile; verifica del DOM accessibile.

### RNF04 — Prestazioni e scalabilità · `Should`

- Catalogo e dettaglio rispondono in meno di 500 ms al 95° percentile con 10.000 eventi e 50.000 prenotazioni su hardware di sviluppo.
- Paginazione obbligatoria sul catalogo (`limit` massimo 100).
- Indici su `starts_at`, `type`, `created_by`, `(event_id, status)`, `(user_id, status)`.
- Conteggi aggregati calcolati in SQL, non in memoria nel client.

**Verifica:** `EXPLAIN ANALYZE` sulle query principali; nessuna scansione sequenziale sulle tabelle grandi nei percorsi caldi.

### RNF05 — Manutenibilità e qualità · `Must`

- TypeScript in modalità `strict` su backend e frontend.
- Architettura a tre livelli con responsabilità separate: route → validazione → servizio → database.
- Contratti di input validati con Zod e messaggi centralizzati nel formato di errore comune.
- Migrazioni SQL versionate e idempotenti; seed ripetibile.
- Test di integrazione API su database dedicato (`accordo_test`), separato dai dati di sviluppo.
- Build di produzione del frontend senza errori di tipo.

**Verifica:** `npm run typecheck`, `npm run build`, `npm test`.

### RNF06 — Portabilità e riproducibilità · `Must`

- Avvio completo con `docker compose up -d --build` su Linux, macOS e Windows con Docker.
- Nessun servizio cloud obbligatorio: database, API, web e casella email girano in locale.
- Configurazione tramite variabili d'ambiente con default sicuri per lo sviluppo.
- Migrazioni e seed eseguiti automaticamente all'avvio del backend, in modo idempotente.
- Database di test creato dall'init script, per non inquinare i dati demo.

**Verifica:** avvio da volume vuoto e riavvio su volume esistente; entrambi i percorsi documentati nel README.

## 5. Glossario

| Termine | Definizione | Nel codice |
| --- | --- | --- |
| **Evento** | Occorrenza pubblicata con titolo, data, luogo, capienza e tipo. Può essere annullata ma non eliminata fisicamente. | `events`, `EventDto` |
| **Concerto** | Evento con posti numerati assegnati automaticamente in ordine crescente. | `event_type = 'CONCERTO'` |
| **Workshop** | Evento formativo a posti limitati, senza posto numerato. Nell'estensione richiede approvazione. | `event_type = 'WORKSHOP'` |
| **DJ set** | Evento musicale a ingresso libero fino a esaurimento capienza, senza posto numerato. | `event_type = 'DJ_SET'` |
| **Organizzatore** | Utente che possiede e gestisce uno o più eventi. | ruolo `ORGANIZZATORE` |
| **Partecipante** | Utente che prenota posti per gli eventi. | ruolo `PARTECIPANTE` |
| **Collaboratore** | Utente con permessi limitati su un singolo evento, senza ownership. *(Estensione)* | `event_collaborators` (prevista) |
| **Prenotazione** | Legame tra un utente e un evento, con stato e eventuale posto. | `bookings`, `BookingDto` |
| **Posto numerato** | Numero intero da 1 a capienza, univoco tra le prenotazioni attive di un concerto. | `seat_number` |
| **Capienza** | Numero massimo di prenotazioni attive contemporanee per un evento. | `capacity` |
| **Disponibilità** | Differenza tra capienza e prenotazioni confermate. | `availableSeats` |
| **Overbooking** | Situazione in cui le prenotazioni attive superano la capienza. Il sistema la impedisce. | vincoli + lock |
| **Codice invito** | Segreto condiviso che abilita la registrazione come organizzatore. | `organizerCode`, `ORGANIZER_INVITE_CODE` |
| **Cancellazione logica** | Lo stato cambia (`ANNULLATA`/`ANNULLATO`) ma il record resta per storico e audit. | `status`, `cancelled_at` |
| **MVP** | Minimum Viable Product: sottoinsieme minimo ma completo e rilasciabile. | scope iterazione 1 |
| **Soft lock / lock di riga** | Blocco transazionale di una riga PostgreSQL per serializzare gli accessi concorrenti. | `FOR UPDATE` |

## 6. Domande aperte e follow-up

Le tre decisioni seguenti non bloccano il MVP, ma vanno chiuse prima di considerare il prodotto pronto per un uso reale.

### Q1 — Chi può diventare organizzatore?

**Perché è rilevante:** pubblicare eventi significa gestire dati e prenotazioni di altre persone. Un codice statico condiviso è semplice ma non tracciabile: se circola, chiunque può pubblicare.

**Ipotesi MVP:** codice invito unico, configurato via ambiente, verificato lato API. È sufficiente per un progetto didattico e per un gruppo ristretto.

**Follow-up:** valutare verifica manuale da parte di un amministratore, dominio email dell'associazione oppure invito monouso con scadenza. La scelta impatta il modello (`invitations`), il flusso di registrazione e la UX.

### Q2 — Come vengono gestiti i pagamenti?

**Perché è rilevante:** il dominio della tesina prevede eventi a pagamento, ma integrare un PSP introduce compliance, webhook, rimborsi e gestione degli errori. Nel MVP la prenotazione è gratuita, quindi il problema è stato escluso deliberatamente.

**Ipotesi MVP:** nessun pagamento. La scheda evento lo dichiara esplicitamente.

**Follow-up:** decidere tra link di pagamento esterno gestito dall'organizzatore (più semplice, meno automatizzato) e integrazione con un provider (più completa, richiede idempotenza dei webhook e un modello di rimborso). In entrambi i casi serve uno stato pagamento separato dallo stato prenotazione.

### Q3 — Cosa succede quando un evento viene annullato?

**Perché è rilevante:** oggi il sistema annulla le prenotazioni e libera i posti, ma non notifica nessuno e non gestisce eventuali rimborsi. Per un evento reale la comunicazione è parte del servizio.

**Ipotesi MVP:** annullamento atomico di evento e prenotazioni; il partecipante vede lo stato nell'area personale; nessuna email.

**Follow-up:** definire politica di notifica (email immediata, eventuale finestra di rimborso), testo legale e comportamento per pagamenti già incassati. Mailpit è già predisposto per testare l'invio in locale.

## 7. Matrice di tracciabilità sintetica

| Requisito | User Story | Casi d'uso | Stato |
| --- | --- | --- | --- |
| RF01 | US01 | UC01 | MVP |
| RF02 | US02 | UC02 | MVP |
| RF03 | US03 | UC03 | MVP |
| RF04, RF05 | US04 | UC04, UC05 | MVP |
| RF06 | US05 | UC06 | MVP |
| RF07 | US06 | UC07 | MVP |
| RF08 | US07 | UC08 | MVP |
| RF09 | US08 | UC09 | MVP |
| RF10 | US09 | UC10, UC11 | MVP |
| RF11 | US10 | UC12 | Estensione |
| RF12 | US11 | UC13, UC14, UC15 | Estensione |
