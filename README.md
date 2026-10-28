# Accordo

Piattaforma web per creare, gestire e prenotare posti a eventi dal vivo: concerti con posti numerati, workshop e DJ set.
Progetto didattico del corso **Sviluppo Agile e DevOps** — autore della tesina: Riccardo Catelani, Cristian Donca.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20PostgreSQL-ff5a36)
![Docker](https://img.shields.io/badge/local-Docker%20Compose-2496ed)

## Indice

- [Cosa fa](#cosa-fa)
- [Stack](#stack)
- [Avvio rapido](#avvio-rapido)
- [Account demo](#account-demo)
- [Struttura del progetto](#struttura-del-progetto)
- [API](#api)
- [Database](#database)
- [Test e qualità](#test-e-qualità)
- [Scope: MVP e dominio completo](#scope-mvp-e-dominio-completo)
- [Documentazione della tesina](#documentazione-della-tesina)
- [Roadmap](#roadmap)

## Cosa fa

- **Pubblico**: sfoglia gli eventi, filtra per tipo, data, disponibilità o testo, apre il dettaglio e prenota un posto.
- **Partecipanti**: registrazione e login, area “I miei posti”, annullamento della propria prenotazione.
- **Organizzatori**: creazione, modifica e annullamento degli eventi, dashboard con occupazione e stato delle prenotazioni.
- **Posti numerati**: per i concerti il sistema assegna automaticamente il primo posto libero; workshop e DJ set non hanno posto numerato.
- **Coerenza**: lock di riga PostgreSQL e vincoli univoci impediscono overbooking, doppie prenotazioni e posti duplicati anche con richieste concorrenti.

## Stack

| Livello | Tecnologia | Perché |
| --- | --- | --- |
| Presentation | React 19 + Vite 8 + TypeScript | SPA veloce, componenti riusabili, tipizzazione dei contratti API. |
| Business | Node.js 22 + Express 5 + TypeScript | REST API leggere, validazione con Zod, gestione centralizzata degli errori. |
| Data | PostgreSQL 16 | Relazioni e vincoli forti, transazioni, lock per la concorrenza. |
| Auth | JWT (HS256) + bcrypt | Flusso stateless adatto a SPA + API, password hashate. |
| Email | Mailpit in locale | Casella SMTP di sviluppo con UI, senza provider esterni o API key. |
| Runtime | Docker + Docker Compose | Ambiente riproducibile con un solo comando. |

## Avvio rapido

```bash
# 1. (opzionale) personalizza porte e segreti
cp .env.example .env

# 2. avvia tutto
docker compose up -d --build

# 3. controlla lo stato
docker compose ps
```

| Servizio | URL |
| --- | --- |
| Web app | http://localhost:5173 |
| API | http://localhost:4000/api |
| Health check | http://localhost:4000/api/health |
| Mailpit (email locali) | http://localhost:8025 |
| PostgreSQL | `localhost:5432` — db `accordo`, user `accordo`, password `accordo` |

Al primo avvio il container backend applica le migrazioni e inserisce i dati demo. I comandi sono idempotenti: ai riavvii successivi non vengono duplicati eventi o utenti.

Comandi utili:

```bash
docker compose logs -f backend    # log API
docker compose logs -f frontend   # log Vite
docker compose down               # ferma i container
docker compose down -v            # ferma e cancella anche il database
docker compose exec backend npm test
docker compose exec backend npm run typecheck
docker compose exec frontend npm run typecheck
```

## Account demo

| Ruolo | Email | Password |
| --- | --- | --- |
| Organizzatore | `marco@accordo.test` | `Organizza123!` |
| Partecipante | `giulia@accordo.test` | `Partecipa123!` |
| Partecipante | `luca@accordo.test` | `Partecipa123!` |
| Partecipante | `sara@accordo.test` | `Partecipa123!` |

Per creare un nuovo account organizzatore dalla UI serve il codice `ORGANIZZA2026` (configurabile con `ORGANIZER_INVITE_CODE`).

## Struttura del progetto

```
app_eventi/
├── backend/
│   ├── db/migrations/       # schema SQL versionato
│   ├── src/
│   │   ├── db/              # pool, migrazioni, seed
│   │   ├── middleware/      # auth JWT, gestione errori
│   │   ├── routes/          # auth, eventi, prenotazioni, health
│   │   ├── schemas/         # validazione Zod
│   │   ├── services/        # regole di dominio e transazioni
│   │   └── utils/
│   └── tests/               # test di integrazione API (Vitest + Supertest)
├── frontend/
│   └── src/
│       ├── api/             # client HTTP tipizzato
│       ├── auth/            # contesto JWT
│       ├── components/      # design system e componenti condivisi
│       ├── pages/           # home, dettaglio, auth, area personale, dashboard
│       └── utils/
├── docs/                    # deliverable della tesina e OpenAPI
├── infra/postgres/          # init database di test
└── docker-compose.yml
```

## API

Base path: `/api`. Errori nel formato `{ "error": { "code", "message", "details?" } }`.

| Metodo | Endpoint | Accesso | Descrizione |
| --- | --- | --- | --- |
| GET | `/health` | Pubblico | Stato API e database. |
| POST | `/auth/register` | Pubblico | Crea un account; codice opzionale per il ruolo organizzatore. |
| POST | `/auth/login` | Pubblico | Restituisce JWT e profilo. |
| GET | `/auth/me` | Autenticato | Profilo dell’utente corrente. |
| GET | `/events` | Pubblico | Eventi pubblicati, con filtri `q`, `type`, `from`, `to`, `available`, `period`. |
| GET | `/events/mine` | Organizzatore | Tutti gli eventi creati dall’utente. |
| GET | `/events/{id}` | Pubblico | Dettaglio evento. |
| POST | `/events` | Organizzatore | Crea un evento. |
| PUT | `/events/{id}` | Organizzatore proprietario | Modifica un evento. |
| POST | `/events/{id}/cancel` | Organizzatore proprietario | Annulla evento e prenotazioni attive. |
| GET | `/events/{id}/bookings` | Organizzatore proprietario | Prenotazioni dell’evento. |
| POST | `/events/{id}/bookings` | Autenticato | Prenota un posto (assegnazione automatica per i concerti). |
| GET | `/bookings/me` | Autenticato | Prenotazioni dell’utente. |
| DELETE | `/bookings/{id}` | Proprietario / organizzatore | Annulla una prenotazione. |

Specifica completa: [`docs/openapi.yaml`](docs/openapi.yaml).

## Database

Tabelle principali: `users`, `events`, `bookings`, `schema_migrations`.

Vincoli che proteggono il dominio:

- `UNIQUE (lower(email))` sugli utenti.
- `UNIQUE (event_id, user_id) WHERE status = 'CONFERMATA'`: una sola prenotazione attiva per utente ed evento.
- `UNIQUE (event_id, seat_number) WHERE status = 'CONFERMATA' AND seat_number IS NOT NULL`: nessun posto assegnato due volte.
- `SELECT ... FOR UPDATE` sull’evento durante la prenotazione: serializza il controllo disponibilità e l’inserimento.
- Cancellazione logica di prenotazioni ed eventi tramite stati (`CONFERMATA`/`ANNULLATA`, `PUBBLICATO`/`ANNULLATO`), per conservare lo storico.

## Test e qualità

La suite backend gira su un database separato (`accordo_test`) e copre 16 casi:

- registrazione, email duplicate, validazione, login, ruoli e rotte protette;
- creazione e filtri eventi, ownership, capienza minima;
- posti numerati, doppia prenotazione, sold out, workshop/DJ set;
- **overbooking con tre richieste concorrenti** su capienza 1;
- annullamento prenotazione con riuso del posto;
- annullamento evento con chiusura delle prenotazioni.

```bash
docker compose exec backend npm test
```

Typecheck e build:

```bash
docker compose exec backend npm run typecheck
docker compose exec frontend npm run build
```

## Scope: MVP e dominio completo

Questa prima versione implementa il **MVP concordato**: autenticazione, eventi, prenotazioni con posti automatici, area personale e dashboard organizzatore.

| Funzionalità | Stato |
| --- | --- |
| Registrazione, login, ruoli, JWT | ✅ Implementato |
| Lista/dettaglio eventi con filtri | ✅ Implementato |
| Creazione, modifica, annullamento evento | ✅ Implementato |
| Prenotazione e annullamento, posti numerati | ✅ Implementato |
| Dashboard occupazione | ✅ Implementato |
| Collaboratori con permessi limitati | 🗺️ Progettato, roadmap |
| Approvazione manuale workshop | 🗺️ Progettato, roadmap |
| Tracking pagamenti esterni | 🗺️ Progettato, roadmap |
| Email automatiche (conferma/annullamento) | 🗺️ Progettato, Mailpit pronto |
| Lista d’attesa, export CSV | 🗺️ Roadmap |

La documentazione in `docs/` descrive il **dominio completo** della tesina; il codice implementa lo scope MVP. La matrice in [`docs/06-scope-e-riflessioni.md`](docs/06-scope-e-riflessioni.md) chiarisce cosa è già operativo e cosa resta pianificato.

## Documentazione della tesina

- [Requisiti, glossario e follow-up](docs/01-requisiti.md)
- [User Stories, acceptance criteria e backlog](docs/02-user-stories.md)
- [Use Case Diagram e mapping UC-US](docs/03-use-case.md)
- [Sequence Diagrams](docs/04-sequence.md)
- [Architettura, modello dati e API](docs/05-architettura-api.md)
- [Scope, decisioni e riflessioni](docs/06-scope-e-riflessioni.md)
- [OpenAPI 3.0](docs/openapi.yaml)

## Roadmap

1. **Collaboratori**: tabella di assegnazione evento-utente e permessi per evento.
2. **Workshop**: stato `IN_ATTESA`, approvazione/rifiuto, email transazionali, liberazione del posto su rifiuto.
3. **Pagamenti**: stato pagamento per prenotazione, link PayPal esterno, aggiornamento manuale da parte dell’organizzatore.
4. **Email**: provider SMTP configurabile, coda con retry e log degli invii (Mailpit in locale).
5. **Lista d’attesa**: promozione automatica quando si libera un posto.
6. **Qualità**: test frontend, CI GitHub Actions, audit accessibilità, rate limiting sugli endpoint di autenticazione.
