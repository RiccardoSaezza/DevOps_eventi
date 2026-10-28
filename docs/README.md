# Documentazione — Piattaforma Gestione Eventi “Accordo”

Questa cartella contiene i deliverable della tesina **Piattaforma di Gestione Eventi** e la documentazione tecnica dell’implementazione.

| Documento | Contenuto |
| --- | --- |
| [01 — Requisiti](01-requisiti.md) | Requisiti funzionali e non funzionali, glossario, domande di follow-up. |
| [02 — User Stories](02-user-stories.md) | 11 User Stories con acceptance criteria Gherkin, MoSCoW, story points e backlog. |
| [03 — Use Case](03-use-case.md) | Diagramma dei casi d’uso, relazioni `include`/`extend`, mapping UC-US. |
| [04 — Sequence](04-sequence.md) | Tre diagrammi di sequenza: prenotazione, annullamento, login JWT. |
| [05 — Architettura e API](05-architettura-api.md) | Architettura a tre livelli, modello dati, scelte tecnologiche, API. |
| [06 — Scope e riflessioni](06-scope-e-riflessioni.md) | Cosa è implementato, decisioni tecniche, difficoltà e roadmap. |
| [OpenAPI](openapi.yaml) | Specifica OpenAPI 3.0 degli endpoint implementati. |

> **Nota di scope.** La tesina descrive il dominio completo (inclusi collaboratori, pagamenti, approvazione workshop ed email). L’implementazione attuale è il **MVP** concordato: autenticazione, gestione eventi, prenotazioni con posti automatici, area personale e dashboard. I documenti distinguono esplicitamente ciò che è operativo da ciò che è progettato per le iterazioni successive.

## Autori

Riccardo Catelani, Cristian Donca — Sviluppo Agile e DevOps, Primo Anno.
