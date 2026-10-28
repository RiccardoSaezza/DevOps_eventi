# 02 — User Stories e backlog

> **Legenda stato**: `Done` = implementata e coperta dai test; `Roadmap` = progettata, non implementata.
> **Stima**: story point in scala Fibonacci (1, 2, 3, 5, 8, 13).
> **Priorità**: MoSCoW applicato al rilascio MVP.

## 1. Attori e personas

| Persona | Ruolo | Bisogno principale |
| --- | --- | --- |
| **Giulia**, 27 anni | Partecipante | Sapere subito se c'è posto e non perdere la prenotazione tra chat e screenshot. |
| **Marco**, 34 anni | Organizzatore | Pubblicare una serata e capire in tempo reale quanti posti restano. |
| **Luca**, 22 anni | Partecipante | Prenotare da mobile in meno di un minuto. |
| **Sara**, 30 anni | Partecipante | Annullare senza dover scrivere a nessuno. |
| **Elena**, 41 anni | Collaboratrice *(roadmap)* | Aiutare Marco su un evento senza vedere tutta la sua dashboard. |

## 2. User Stories

---

### US01 — Registrazione del partecipante

**Come** visitatore
**voglio** creare un account con nome, email e password
**così da** poter prenotare un posto e ritrovare le mie prenotazioni.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 3 | Sprint 1 | Done |

**Valore:** abbatte la barriera d'ingresso; l'account è il presupposto di prenotazioni e area personale.

**Regole e vincoli**

- email normalizzata in minuscolo, univoca;
- password minimo 8 caratteri, hashata con bcrypt;
- al successo: `201`, profilo e JWT; l'utente è autenticato subito.

**Acceptance criteria**

```gherkin
Scenario: Registrazione valida
  Dato che sono un visitatore sulla pagina di registrazione
  Quando inserisco nome "Giulia Rossi", email "giulia@example.com" e password "Password123!"
  E confermo la password
  Allora l'account viene creato con ruolo PARTECIPANTE
  E ricevo un token JWT valido
  E vengo portata all'area "I miei posti"

Scenario: Email già registrata
  Dato che esiste già un account con email "giulia@example.com"
  Quando tento di registrarmi con la stessa email
  Allora la registrazione viene rifiutata con codice EMAIL_IN_USE
  E vedo il messaggio "Questa email è già registrata"
  E posso passare al login senza perdere i dati inseriti

Scenario: Password troppo corta
  Dato che sono sulla pagina di registrazione
  Quando inserisco una password di 5 caratteri
  Allora la registrazione non viene inviata
  E vedo l'errore "La password deve avere almeno 8 caratteri"
  E il campo password è evidenziato

Scenario: Email non valida
  Dato che sono sulla pagina di registrazione
  Quando inserisco "giulia@" nel campo email
  Allora l'API risponde 422 VALIDATION_ERROR
  E il dettaglio indica il campo email
```

**Dipendenze:** nessuna. **Note:** il form controlla la conferma password lato client; l'API valida comunque tutto.

---

### US02 — Registrazione dell'organizzatore con codice invito

**Come** organizzatore autorizzato
**voglio** registrarmi indicando il codice invito
**così da** ottenere i permessi per pubblicare eventi senza aprire la piattaforma a chiunque.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 3 | Sprint 1 | Done |

**Regole e vincoli**

- il codice è verificato lato API, non solo nel form;
- codice errato: `403 INVALID_INVITE_CODE`;
- senza codice si ottiene un account `PARTECIPANTE`;
- il codice non è mai restituito dalle API.

**Acceptance criteria**

```gherkin
Scenario: Codice corretto
  Dato che sono sulla pagina di registrazione
  Quando seleziono "Registrati come organizzatore"
  E inserisco il codice "ORGANIZZA2026"
  E completo nome, email e password validi
  Allora l'account viene creato con ruolo ORGANIZZATORE
  E vengo portato alla dashboard organizzatore

Scenario: Codice errato
  Dato che sono sulla pagina di registrazione
  Quando seleziono "Registrati come organizzatore"
  E inserisco il codice "SBAGLIATO"
  Allora la registrazione viene rifiutata con codice INVALID_INVITE_CODE
  E nessun account viene creato
  E vedo un messaggio che invita a verificare il codice

Scenario: Codice assente
  Dato che sono sulla pagina di registrazione
  Quando non seleziono l'opzione organizzatore
  Allora l'account viene creato con ruolo PARTECIPANTE
  E non posso accedere alla dashboard organizzatore
```

**Dipendenze:** US01. **Note:** nel progetto demo il codice è `ORGANIZZA2026`, configurabile con `ORGANIZER_INVITE_CODE`.

---

### US03 — Accesso e logout

**Come** utente registrato
**voglio** accedere con email e password e poter uscire
**così da** gestire la mia sessione in sicurezza.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 3 | Sprint 1 | Done |

**Regole e vincoli**

- credenziali errate: `401 INVALID_CREDENTIALS`, messaggio unico;
- token assente: `401 UNAUTHENTICATED`; token scaduto o non valido: `401 INVALID_TOKEN`;
- ruolo insufficiente: `403 FORBIDDEN`;
- il logout rimuove il token dal client e riporta alla home;
- redirect post-login rispettato solo se interno (no open redirect).

**Acceptance criteria**

```gherkin
Scenario: Login valido
  Dato che possiedo un account attivo
  Quando inserisco email e password corrette
  Allora ricevo un JWT e il mio profilo
  E vengo reindirizzato alla pagina richiesta o alla home
  E la navbar mostra il mio nome e il ruolo

Scenario: Password errata
  Dato che possiedo un account attivo
  Quando inserisco una password sbagliata
  Allora ricevo 401 INVALID_CREDENTIALS
  E vedo un messaggio generico di credenziali non valide
  E non viene rivelato se l'email esiste

Scenario: Accesso a rotta protetta senza token
  Dato che non sono autenticato
  Quando apro "/organizer"
  Allora vengo reindirizzato al login
  E dopo l'accesso torno a "/organizer"

Scenario: Logout
  Dato che sono autenticato
  Quando premo "Esci"
  Allora il token viene rimosso dal browser
  E la navbar torna a mostrare Accedi e Registrati
  E le rotte protette non sono più accessibili
```

**Dipendenze:** US01, US02.

---

### US04 — Esplorare il catalogo e il dettaglio degli eventi

**Come** visitatore o partecipante
**voglio** sfogliare gli eventi, cercarli e filtrarli, e aprire la scheda completa
**così da** trovare la serata giusta e capire se c'è posto.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 5 | Sprint 1 | Done |

**Regole e vincoli**

- solo eventi `PUBBLICATO` e, di default, futuri;
- ricerca su titolo, luogo e descrizione;
- filtri per tipo, data di inizio, disponibilità;
- card con data, luogo, tipo e posti liberi;
- dettaglio con capienza, disponibilità, organizzatore e stato del pulsante;
- stati di caricamento, vuoto ed errore espliciti.

**Acceptance criteria**

```gherkin
Scenario: Catalogo con eventi disponibili
  Dato che esistono eventi pubblicati futuri
  Quando apro la home
  Allora vedo le card ordinate per data crescente
  E ogni card mostra tipo, titolo, luogo e posti liberi
  E vedo il conteggio totale degli eventi in programma

Scenario: Filtro per tipo e disponibilità
  Dato che il catalogo contiene concerti, workshop e DJ set
  Quando seleziono "Concerti" e attivo "Solo disponibili"
  Allora vedo solo i concerti con almeno un posto libero
  E il pulsante "Azzera filtri" è visibile

Scenario: Ricerca senza risultati
  Dato che sono sulla home
  Quando cerco "evento inesistente"
  Allora vedo lo stato vuoto "Nessun evento trovato"
  E posso azzerare i filtri con un clic

Scenario: Evento annullato
  Dato che un evento è stato annullato dall'organizzatore
  Quando apro il catalogo pubblico
  Allora l'evento non compare nella lista
  E aprendo il vecchio link vedo il dettaglio con stato "Annullato" e prenotazione disabilitata
```

**Dipendenze:** dati demo del seed; US08 per la creazione di nuovi eventi. **Note:** il dettaglio implementa anche RF05.

---

### US05 — Prenotare un posto con assegnazione automatica

**Come** partecipante autenticato
**voglio** prenotare un posto per un evento
**così da** assicurarmi l'ingresso senza scambi di messaggi.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 8 | Sprint 2 | Done |

**Regole e vincoli**

- una sola prenotazione attiva per utente ed evento;
- nessun overbooking anche con richieste concorrenti;
- concerto: primo posto libero assegnato automaticamente;
- workshop/DJ set: `seatNumber = null`;
- eventi annullati, conclusi o esauriti bloccati;
- la conferma è immediata e gratuita nel MVP.

**Acceptance criteria**

```gherkin
Scenario: Prenotazione di un concerto con posto disponibile
  Dato che sono autenticato e l'evento è un concerto futuro con posti liberi
  Quando premo "Prenota il posto"
  Allora la prenotazione è CONFERMATA
  E ricevo il primo posto libero, ad esempio "Posto numero 1"
  E la disponibilità dell'evento diminuisce di uno
  E vedo un toast di conferma

Scenario: Prenotazione di un workshop
  Dato che l'evento è un workshop con posti liberi
  Quando prenoto
  Allora la prenotazione è CONFERMATA
  E il posto numerato è assente
  E la card mostra "Ingresso libero"

Scenario: Doppia prenotazione
  Dato che ho già una prenotazione attiva per l'evento
  Quando tento di prenotare di nuovo
  Allora ricevo 409 ALREADY_BOOKED
  E non viene creata una seconda prenotazione
  E vedo il messaggio "Hai già una prenotazione attiva per questo evento"

Scenario: Ultimo posto conteso
  Dato che l'evento ha un solo posto libero
  Quando due utenti prenotano nello stesso istante
  Allora esattamente una richiesta va a buon fine
  E l'altra riceve 409 SOLD_OUT
  E il totale delle prenotazioni attive resta pari alla capienza

Scenario: Prenotazione senza autenticazione
  Dato che non sono autenticato
  Quando premo "Accedi per prenotare"
  Allora vengo portato al login con redirect alla scheda evento
  E nessuna prenotazione viene creata
```

**Dipendenze:** US01, US03, US08. **Note:** il caso “ultimo posto conteso” è coperto da un test di concorrenza.

---

### US06 — Annullare la propria prenotazione

**Come** partecipante
**voglio** annullare una prenotazione futura
**così da** liberare il posto se i piani cambiano.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Should | 3 | Sprint 2 | Done |

**Regole e vincoli**

- solo il proprietario o l'organizzatore dell'evento;
- cancellazione logica con `cancelled_at`;
- il posto torna disponibile e può essere riassegnato;
- vietato dopo l'inizio dell'evento o su prenotazione già annullata.

**Acceptance criteria**

```gherkin
Scenario: Annullamento con conferma
  Dato che ho una prenotazione CONFERMATA per un evento futuro
  Quando premo "Annulla" e confermo nella finestra
  Allora la prenotazione passa a ANNULLATA
  E il posto torna disponibile
  E vedo il toast "Prenotazione annullata"

Scenario: Annullamento di un'altra persona
  Dato che esiste una prenotazione di un altro partecipante
  Quando provo ad annullarla tramite API
  Allora ricevo 403 FORBIDDEN
  E la prenotazione resta CONFERMATA

Scenario: Evento già iniziato
  Dato che l'evento è già iniziato
  Quando provo ad annullare la prenotazione
  Allora ricevo 409 EVENT_STARTED
  E la prenotazione resta CONFERMATA

Scenario: Posto riassegnato
  Dato che ho annullato la prenotazione con posto 1
  Quando un altro partecipante prenota lo stesso concerto
  Allora riceve il posto 1
```

**Dipendenze:** US05.

---

### US07 — Consultare “I miei posti”

**Come** partecipante autenticato
**voglio** vedere tutte le mie prenotazioni con stato e posto
**così da** sapere dove e quando presentarmi.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 3 | Sprint 2 | Done |

**Regole e vincoli**

- sezioni “In arrivo” e “Passati e annullati”;
- indicatori di stato prenotazione ed evento;
- accesso al dettaglio e annullamento rapido;
- stato vuoto con invito a esplorare il catalogo;
- nessun dato di altri utenti.

**Acceptance criteria**

```gherkin
Scenario: Prenotazioni in arrivo
  Dato che ho due prenotazioni confermate per eventi futuri
  Quando apro "I miei posti"
  Allora vedo due righe nella sezione "In arrivo"
  E ogni riga mostra titolo, data, luogo e posto

Scenario: Nessuna prenotazione
  Dato che non ho mai prenotato
  Quando apro "I miei posti"
  Allora vedo lo stato vuoto "Il tuo prossimo posto ti aspetta"
  E posso andare al catalogo

Scenario: Evento annullato dall'organizzatore
  Dato che l'organizzatore ha annullato un evento a cui ero iscritta
  Quando apro "I miei posti"
  Allora la prenotazione compare tra "Passati e annullati"
  E vedo il badge "Evento annullato"
  E non posso annullarla di nuovo

Scenario: Accesso non autenticato
  Dato che non sono autenticato
  Quando apro "/my-bookings"
  Allora vengo reindirizzato al login
  E dopo l'accesso vedo la mia area personale
```

**Dipendenze:** US03, US05.

---

### US08 — Creare e pubblicare un evento

**Come** organizzatore
**voglio** creare un evento con titolo, tipo, data, luogo e capienza
**così da** aprire le prenotazioni e renderlo visibile al pubblico.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 5 | Sprint 3 | Done |

**Regole e vincoli**

- solo ruolo `ORGANIZZATORE`;
- data futura, capienza 1–10.000;
- validazione client e server;
- anteprima live nel form;
- pubblicazione immediata (`PUBBLICATO`);
- ownership impostata dal token, non dal body.

**Acceptance criteria**

```gherkin
Scenario: Creazione valida
  Dato che sono autenticato come organizzatore
  Quando compilo titolo, tipo, data futura, luogo e capienza
  E premo "Pubblica evento"
  Allora l'evento viene creato come PUBBLICATO
  E compare nella dashboard e nel catalogo pubblico
  E vedo il toast "Evento creato e pubblicato"

Scenario: Data nel passato
  Dato che sono nel form di creazione
  Quando inserisco una data già passata
  Allora vedo l'errore "La data deve essere futura"
  E l'evento non viene inviato all'API

Scenario: Partecipante che tenta di creare un evento
  Dato che sono autenticato come partecipante
  Quando chiamo POST /api/events
  Allora ricevo 403 FORBIDDEN
  E nessun evento viene creato

Scenario: Capienza non valida
  Dato che sono nel form di creazione
  Quando inserisco capienza 0
  Allora vedo un errore sul campo capienza
  E il pulsante di pubblicazione non completa l'operazione
```

**Dipendenze:** US02, US03.

---

### US09 — Modificare e annullare un evento

**Come** organizzatore proprietario
**voglio** aggiornare i dati di un evento o annullarlo
**così da** gestire cambiamenti e imprevisti senza perdere lo storico.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Must | 5 | Sprint 3 | Done |

**Regole e vincoli**

- solo il proprietario può modificare o annullare;
- capienza non inferiore alle prenotazioni attive;
- evento annullato non modificabile;
- annullamento atomico di evento e prenotazioni;
- l'evento annullato resta nello storico, non nel catalogo.

**Acceptance criteria**

```gherkin
Scenario: Modifica dei dettagli
  Dato che sono il proprietario di un evento pubblicato futuro
  Quando cambio titolo e luogo e salvo
  Allora l'evento mostra i nuovi dati nel catalogo e nel dettaglio
  E vedo il toast "Evento aggiornato"

Scenario: Riduzione della capienza sotto le prenotazioni
  Dato che l'evento ha 3 prenotazioni attive
  Quando imposto la capienza a 2
  Allora ricevo 409 CAPACITY_TOO_LOW
  E la capienza resta invariata
  E vedo il numero di posti già prenotati

Scenario: Annullamento con prenotazioni attive
  Dato che l'evento ha 3 prenotazioni attive
  Quando confermo l'annullamento
  Allora l'evento passa a ANNULLATO
  E tutte le 3 prenotazioni passano a ANNULLATA
  E l'evento sparisce dal catalogo pubblico
  E la risposta riporta cancelledBookings = 3

Scenario: Organizzatore non proprietario
  Dato che un altro organizzatore possiede l'evento
  Quando provo a modificarlo o annullarlo
  Allora ricevo 403 FORBIDDEN
  E l'evento resta invariato
```

**Dipendenze:** US08.

---

### US10 — Gestire i collaboratori di un evento *(Estensione)*

**Come** organizzatore proprietario
**voglio** invitare collaboratori su un singolo evento con permessi limitati
**così da** delegare senza condividere l'intera dashboard.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Could | 8 | Sprint 4 (roadmap) | Roadmap |

**Regole previste**

- invito per email o link con scadenza;
- permessi `EDIT` e `MANAGE_BOOKINGS`;
- il collaboratore vede solo gli eventi assegnati;
- il proprietario resta l'unico a poter trasferire la proprietà o eliminare l'evento;
- revoca immediata del permesso.

**Acceptance criteria (bozza)**

```gherkin
Scenario: Invito di un collaboratore
  Dato che sono il proprietario di un evento
  Quando invito "elena@example.com" con permesso EDIT
  Allora Elena vede l'evento nella propria area
  E può modificarne i dettagli
  E non vede gli altri miei eventi

Scenario: Permesso insufficiente
  Dato che sono collaboratore con permesso EDIT
  Quando provo ad annullare l'evento
  Allora ricevo 403 FORBIDDEN
  E l'evento resta pubblicato

Scenario: Revoca del permesso
  Dato che Elena è collaboratrice di un evento
  Quando revoco il suo accesso
  Allora Elena non vede più l'evento
  E le sue richieste di modifica ricevono 403
```

**Dipendenze:** US09. **Nota:** richiede la tabella `event_collaborators` e l'estensione dei controlli di ownership.

---

### US11 — Governare le richieste in attesa: workshop e pagamenti *(Estensione)*

**Come** organizzatore
**voglio** approvare le iscrizioni ai workshop e confermare i pagamenti ricevuti fuori piattaforma
**così da** controllare chi accede e quale somma è stata effettivamente incassata.

| Priorità | Story point | Iterazione | Stato |
| --- | --- | --- | --- |
| Could | 13 | Sprint 4 (roadmap) | Roadmap |

**Regole previste**

- iscrizione a workshop con stato `IN_ATTESA`;
- approvazione → `CONFERMATA`, rifiuto → `RIFIUTATA` con liberazione del posto;
- pagamento tracciato separatamente dallo stato della prenotazione (`payment_status`, `payment_reference`);
- l'organizzatore può confermare manualmente un pagamento ricevuto fuori piattaforma;
- ogni transizione genera una notifica email (RF12c);
- scadenza automatica delle richieste non gestite;
- l'organizzatore vede la lista con nome, email, stato e importo.

**Acceptance criteria (bozza)**

```gherkin
Scenario: Approvazione di una richiesta workshop
  Dato che esiste una richiesta IN_ATTESA e c'è capienza
  Quando l'organizzatore approva
  Allora la prenotazione diventa CONFERMATA
  E il partecipante riceve un'email di conferma

Scenario: Rifiuto per capienza esaurita
  Dato che il workshop ha raggiunto la capienza
  Quando l'organizzatore tenta di approvare un'ulteriore richiesta
  Allora riceve 409 SOLD_OUT
  E la richiesta resta IN_ATTESA
  E il partecipante non viene confermato

Scenario: Conferma di un pagamento esterno
  Dato che una prenotazione prevede un pagamento fuori piattaforma
  Quando l'organizzatore registra il riferimento del bonifico
  Allora il pagamento passa a PAGATO
  E la prenotazione resta CONFERMATA
  E il partecipante riceve un'email di ricevuta

Scenario: Pagamento non ancora ricevuto
  Dato che una prenotazione è in attesa di pagamento
  Quando l'organizzatore tenta di confermarla senza riferimento
  Allora riceve 422 VALIDATION_ERROR
  E lo stato del pagamento resta IN_ATTESA
```

**Dipendenze:** US05, RF12a, RF12b, RF12c. **Nota:** è un'epica di estensione: il modello dati e le transizioni sono progettati per essere aggiunti senza riscrivere il flusso di prenotazione.

---

## 3. Product Backlog ordinato

L'ordine riflette il valore per l'utente e la dipendenza tecnica. Le stime sono in story point.

| # | User Story | Priorità | SP | Iterazione | Stato | Dipende da |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | US01 Registrazione partecipante | Must | 3 | Sprint 1 | Done | — |
| 2 | US02 Registrazione organizzatore | Must | 3 | Sprint 1 | Done | US01 |
| 3 | US03 Login e logout | Must | 3 | Sprint 1 | Done | US01, US02 |
| 4 | US04 Catalogo e dettaglio eventi | Must | 5 | Sprint 1 | Done | US08 (dati demo) |
| 5 | US08 Creazione evento | Must | 5 | Sprint 2 | Done | US02, US03 |
| 6 | US05 Prenotazione con posto automatico | Must | 8 | Sprint 2 | Done | US03, US08 |
| 7 | US06 Annullamento prenotazione | Should | 3 | Sprint 2 | Done | US05 |
| 8 | US07 “I miei posti” | Must | 3 | Sprint 3 | Done | US03, US05 |
| 9 | US09 Modifica e annullamento evento | Must | 5 | Sprint 3 | Done | US08 |
| 10 | US10 Collaboratori per evento | Could | 8 | Sprint 4 (roadmap) | Roadmap | US09 |
| 11 | US11 Governare le richieste in attesa (workshop e pagamenti) | Could | 13 | Sprint 4 (roadmap) | Roadmap | US05, RF12a, RF12b |

**Totale MVP (US01–US09):** 38 story point.
**Totale estensioni (US10–US11):** 21 story point.
**Totale backlog:** 59 story point.

### 3.1 Avanzamento per iterazione

| Iterazione | Obiettivo | Story | SP | Esito |
| --- | --- | --- | --- | --- |
| Sprint 1 | Fondamenta: account e catalogo | US01, US02, US03, US04 | 14 | Rilasciato |
| Sprint 2 | Prenotazioni | US08, US05, US06 | 16 | Rilasciato |
| Sprint 3 | Gestione e area personale | US07, US09 | 8 | Rilasciato |
| Sprint 4 | Estensioni collaborative e di governo | US10, US11 | 21 | Pianificato |

### 3.2 Definition of Ready

Una storia entra in sprint se: ha attori e valore espliciti, acceptance criteria verificabili, dipendenze note, stima condivisa e nessun blocco tecnico aperto.

### 3.3 Definition of Done

- codice tipizzato e revisionato;
- validazione server-side e gestione degli errori;
- test di integrazione per il percorso felice e almeno un caso negativo;
- UI responsive con stati di caricamento, vuoto ed errore;
- documentazione e variabili d'ambiente aggiornate;
- build e typecheck verdi;
- deploy locale con Docker Compose funzionante.

## 4. Note di prioritizzazione

- **US05 prima di US06:** non si annulla ciò che non si può prenotare; inoltre l'annullamento riusa il posto, quindi richiede il modello di assegnazione già stabile.
- **US08 subito dopo il catalogo:** il catalogo nasce con i dati demo del seed, ma la creazione è necessaria per collaudare il flusso completo e per rendere il prodotto autonomo.
- **US09 dopo US08:** la modifica introduce i controlli di ownership e di capienza, che hanno senso solo su eventi già creabili.
- **US10 e US11 escluse dal MVP:** aggiungono rispettivamente un nuovo modello di permessi e una nuova macchina a stati (workshop in attesa e pagamento tracciato); entrambe sono state progettate per non richiedere una riscrittura del flusso di prenotazione (vedi [06](06-scope-e-riflessioni.md)).
- **US11 come epica, non come singola storia:** approvazione workshop, pagamento esterno e notifiche condividono lo stesso ciclo di vita della prenotazione. Tenerli insieme evita di progettare tre volte le stesse transizioni e rende esplicito che RF12 è un blocco unico di estensione (13 SP).
