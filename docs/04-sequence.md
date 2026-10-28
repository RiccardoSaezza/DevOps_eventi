# 04 — Diagrammi di sequenza

I tre diagrammi coprono i flussi con più rischio del sistema: **prenotazione concorrente**, **annullamento con controllo di ownership** e **registrazione con codice invito**. Tutti usano `autonumber` e riportano esplicitamente i valori di ritorno; i frame `alt`, `opt` e `loop` descrivono i rami alternativi.

## 1. Prenotazione di un posto con assegnazione automatica

```mermaid
sequenceDiagram
    autonumber
    actor U as Partecipante
    participant W as SPA React
    participant API as API Express
    participant MW as Auth JWT
    participant BS as BookingService
    participant DB as PostgreSQL

    U->>W: Clic su "Prenota il posto"
    W->>API: POST /api/events/{id}/bookings<br/>Authorization: Bearer JWT
    API->>MW: requireAuth(req)
    MW->>MW: verifica firma e scadenza

    alt Token assente, scaduto o non valido
        MW-->>API: HttpError 401 UNAUTHENTICATED / INVALID_TOKEN
        API-->>W: 401 { code: "UNAUTHENTICATED" | "INVALID_TOKEN" }
        W-->>U: Toast "Sessione scaduta, accedi di nuovo"
    else Token valido
        MW-->>API: req.user { id, role }
        API->>BS: createBooking(userId, eventId)
        BS->>DB: BEGIN
        BS->>DB: SELECT ... FROM events WHERE id = $1 FOR UPDATE
        DB-->>BS: event { type, capacity, status, starts_at }

        alt Evento inesistente
            BS->>DB: ROLLBACK
            BS-->>API: 404 NOT_FOUND
            API-->>W: 404 { code: "NOT_FOUND" }
            W-->>U: "Evento non trovato"
        else Evento annullato
            BS->>DB: ROLLBACK
            BS-->>API: 409 EVENT_CANCELLED
            API-->>W: 409 { code: "EVENT_CANCELLED" }
            W-->>U: Toast "L'evento è stato annullato"
        else Evento già iniziato
            BS->>DB: ROLLBACK
            BS-->>API: 409 EVENT_STARTED
            API-->>W: 409 { code: "EVENT_STARTED" }
            W-->>U: Toast "Le prenotazioni sono chiuse"
        else Evento prenotabile
            BS->>DB: SELECT 1 FROM bookings<br/>WHERE event_id = $1 AND user_id = $2 AND status = 'CONFERMATA'
            DB-->>BS: existing row oppure vuoto

            alt Prenotazione attiva già presente
                BS->>DB: ROLLBACK
                BS-->>API: 409 ALREADY_BOOKED
                API-->>W: 409 { code: "ALREADY_BOOKED" }
                W-->>U: "Hai già una prenotazione attiva"
            else Nessuna prenotazione attiva
                BS->>DB: SELECT COUNT(*) FROM bookings<br/>WHERE event_id = $1 AND status = 'CONFERMATA'
                DB-->>BS: booked

                alt booked >= capacity
                    BS->>DB: ROLLBACK
                    BS-->>API: 409 SOLD_OUT
                    API-->>W: 409 { code: "SOLD_OUT" }
                    W-->>U: "Evento esaurito"
                else Posto disponibile
                    opt Evento di tipo CONCERTO
                        BS->>DB: SELECT s FROM generate_series(1, capacity) s<br/>WHERE NOT EXISTS (posto occupato)<br/>ORDER BY s LIMIT 1
                        DB-->>BS: seatNumber = primo posto libero
                    end
                    BS->>DB: INSERT INTO bookings (event_id, user_id, seat_number, status)<br/>VALUES ($1, $2, $3, 'CONFERMATA')
                    DB-->>BS: booking { id, status: 'CONFERMATA', seatNumber }
                    BS->>DB: COMMIT
                    BS-->>API: BookingDto
                    API-->>W: 201 { booking }
                    W->>W: aggiorna disponibilità e stato locale
                    W-->>U: Toast "Prenotazione confermata. Posto numero N"
                end
            end
        end
    end
```

**Punti chiave**

- Il lock `FOR UPDATE` sulla riga evento è ciò che serializza due prenotazioni concorrenti: la seconda transazione attende il commit della prima e ricalcola il conteggio.
- Il posto viene cercato **dentro** la stessa transazione, quindi non può essere assegnato due volte.
- I vincoli univoci parziali sono la seconda linea di difesa: se un bug o una corsa sfuggisse al lock, il database rifiuterebbe comunque il duplicato con `23505 → 409`.
- Il `ROLLBACK` è esplicito in ogni ramo di errore; il client riceve sempre un payload `{ error: { code, message } }`.

## 2. Annullamento di una prenotazione

```mermaid
sequenceDiagram
    autonumber
    actor U as Partecipante
    participant W as SPA React
    participant API as API Express
    participant MW as Auth JWT
    participant BS as BookingService
    participant DB as PostgreSQL

    U->>W: "Annulla" + conferma nella dialog
    W->>API: DELETE /api/bookings/{bookingId}<br/>Authorization: Bearer JWT
    API->>MW: requireAuth(req)
    MW->>MW: verifica firma e scadenza

    alt Token non valido
        MW-->>API: 401 UNAUTHENTICATED / INVALID_TOKEN
        API-->>W: 401 { code: "UNAUTHENTICATED" | "INVALID_TOKEN" }
        W-->>U: Redirect al login
    else Token valido
        MW-->>API: req.user { id, role }
        API->>BS: cancelBooking(user, bookingId)
        BS->>DB: BEGIN
        BS->>DB: SELECT b.*, e.starts_at, e.created_by<br/>FROM bookings b JOIN events e ON e.id = b.event_id<br/>WHERE b.id = $1 FOR UPDATE OF b
        DB-->>BS: booking + event

        alt Prenotazione inesistente
            BS->>DB: ROLLBACK
            BS-->>API: 404 NOT_FOUND
            API-->>W: 404 { code: "NOT_FOUND" }
            W-->>U: "Prenotazione non trovata"
        else Prenotazione esistente
            alt Utente non proprietario e non organizzatore dell'evento
                BS->>DB: ROLLBACK
                BS-->>API: 403 FORBIDDEN
                API-->>W: 403 { code: "FORBIDDEN" }
                W-->>U: "Non puoi annullare questa prenotazione"
            else Utente autorizzato
                alt Prenotazione già ANNULLATA
                    BS->>DB: ROLLBACK
                    BS-->>API: 409 ALREADY_CANCELLED
                    API-->>W: 409 { code: "ALREADY_CANCELLED" }
                    W-->>U: "Prenotazione già annullata"
                else Prenotazione CONFERMATA
                    alt Evento già iniziato
                        BS->>DB: ROLLBACK
                        BS-->>API: 409 EVENT_STARTED
                        API-->>W: 409 { code: "EVENT_STARTED" }
                        W-->>U: "Non è più possibile annullare"
                    else Evento futuro
                        BS->>DB: UPDATE bookings<br/>SET status = 'ANNULLATA', cancelled_at = now()<br/>WHERE id = $1<br/>RETURNING ...
                        DB-->>BS: booking aggiornata
                        BS->>DB: COMMIT
                        BS-->>API: BookingDto { status: 'ANNULLATA', cancelledAt }
                        API-->>W: 200 { booking }
                        W->>W: sposta la riga tra "Passati e annullati"
                        W-->>U: Toast "Prenotazione annullata. Il posto è tornato disponibile."
                    end
                end
            end
        end
    end
```

**Punti chiave**

- La cancellazione è **logica**: la riga resta e il posto torna assegnabile perché gli indici univoci considerano solo `status = 'CONFERMATA'`.
- L'organizzatore dell'evento può annullare una prenotazione altrui (utile per telefoni o richieste dirette), ma un organizzatore estraneo no.
- Il lock è sulla sola prenotazione (`FOR UPDATE OF b`), non sull'evento: due annullamenti dello stesso evento non si bloccano a vicenda.

## 3. Registrazione dell'organizzatore e bootstrap della sessione

```mermaid
sequenceDiagram
    autonumber
    actor U as Visitatore
    participant W as SPA React
    participant API as API Express
    participant AS as AuthService
    participant DB as PostgreSQL

    U->>W: Compila il form e preme "Crea account"
    W->>W: valida nome, email, password, conferma

    loop Per ogni campo obbligatorio
        W->>W: controlla formato e lunghezza
    end

    alt Campi non validi lato client
        W-->>U: Errori inline, nessuna richiesta inviata
    else Campi validi
        W->>API: POST /api/auth/register<br/>{ name, email, password, organizerCode? }
        API->>API: registerSchema.parse(body)

        alt Payload non conforme a Zod
            API-->>W: 422 VALIDATION_ERROR<br/>{ details: [{ field, message }] }
            W-->>U: Errori sui campi interessati
        else Payload valido
            API->>AS: register(input)
            AS->>DB: SELECT id FROM users WHERE lower(email) = lower($1)
            DB-->>AS: row oppure vuoto

            alt Email già registrata
                AS-->>API: 409 EMAIL_IN_USE
                API-->>W: 409 { code: "EMAIL_IN_USE" }
                W-->>U: "Questa email è già registrata"
            else Email libera
                opt organizerCode presente
                    AS->>AS: confronta con ORGANIZER_INVITE_CODE
                    alt Codice errato
                        AS-->>API: 403 INVALID_INVITE_CODE
                        API-->>W: 403 { code: "INVALID_INVITE_CODE" }
                        W-->>U: "Codice organizzatore non valido"
                    end
                end

                AS->>AS: bcrypt.hash(password, 12)
                AS->>DB: INSERT INTO users (name, email, password_hash, role)<br/>VALUES ($1, $2, $3, $4)<br/>RETURNING id, name, email, role
                DB-->>AS: user creato

                AS->>AS: jwt.sign({ sub, role, name }, secret, 7d)
                AS-->>API: { token, user }
                API-->>W: 201 { token, user }
                W->>W: salva il token in localStorage
                W-->>U: Redirect a /organizer (o /my-bookings)
            end
        end
    end
```

**Punti chiave**

- La validazione è **difesa in profondità**: il form evita richieste inutili, ma l'API rivalida tutto con Zod e non si fida del client.
- La password non compare mai nelle risposte né nei log; viene hashata prima dell'insert.
- Il ruolo è determinato **solo** dal codice invito verificato lato server, non da un campo `role` inviato dal client.
- Il token è stateless: il bootstrap successivo usa `GET /auth/me` per reidratare l'utente al refresh della pagina. Se il token è scaduto, il client lo rimuove e torna ospite.

## 4. Convenzioni comuni

| Aspetto | Scelta |
| --- | --- |
| Autenticazione | Header `Authorization: Bearer <JWT>` su tutte le rotte protette. |
| Errori | `{ "error": { "code", "message", "details?" } }`, con `details` per la validazione. |
| Transazioni | `BEGIN` / `COMMIT` / `ROLLBACK` espliciti nei servizi di scrittura. |
| Lock | `FOR UPDATE` su evento in prenotazione e annullamento evento; `FOR UPDATE OF b` in annullamento prenotazione. |
| Idempotenza | La prenotazione è protetta da vincolo univoco; l'annullamento risponde `409` se già eseguito. |
| Timeout | `testTimeout` 30 s nella suite; le richieste HTTP non hanno timeout applicativo nel MVP. |
