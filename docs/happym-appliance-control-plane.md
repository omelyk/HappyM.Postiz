# HappyM Social Manager appliance control plane

Versione contratto: `1.0.0-alpha.4`.

## Connect OAuth presidiato

La landing `GET /embed/happym/connect?ticket=...&provider=facebook` scambia il ticket attraverso `/happym/embed-sessions/exchange` con `purpose=connect`, imposta la sessione browser dell'utente tecnico della farmacia e avvia il flusso nativo `/integrations/social/{provider}`. Il purpose e il provider restituiti dal CRM devono coincidere con la richiesta iniziale; la sessione connect può accedere soltanto alle route OAuth necessarie e non alle route composer o dashboard.

La modalità presidiata richiede `HAPPYM_APPLIANCE_MODE=true`, un amministratore locale di bootstrap e le credenziali M2M `HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID` / `HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET`. Il bootstrap è idempotente e crea l'organizzazione di sistema, l'amministratore e una API key di servizio. Nessun segreto viene scritto nei log.

`GET /internal/happym/appliance/health` è pubblico e non restituisce segreti. Tutti gli altri endpoint sotto `/internal/happym/appliance` richiedono `X-HappyM-Client-Id` e `Authorization: Bearer <internal-secret>`:

- `GET /linked`
- `POST /credentials/provision`
- `POST /credentials/rotate`
- `POST /organizations/ensure`
- `POST /users/ensure`
- `POST /admin/password/reset`

La rotazione sostituisce atomicamente la API key di sistema: la chiave precedente non è più accettata. Le API pubbliche usano la chiave di sistema nell'header `Authorization`; lo scope farmacia è obbligatoriamente esplicito in `X-HappyM-Organization-Id`. Solo la chiave appartenente all'organizzazione di sistema può selezionare uno scope diverso.

In appliance mode registrazione self-service, OAuth e marketing Postiz sono nascosti; il login locale e il prodotto `Social Manager` restano disponibili.
