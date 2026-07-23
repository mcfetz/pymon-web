# Deployment

## Pipeline-Ablauf

```
git push main
    │
    ▼
GitHub Actions (.github/workflows/docker.yml)
    │
    ├─ npm ci + npm run build  (Node 22)
    ├─ Multi-arch image build (amd64 + arm64)
    ├─ Push → ghcr.io/mcfetz/pymon-web:latest
    │
    └─ POST https://portainer.familie-heise.de/api/webhooks/...
              │
              ▼
         Portainer pulls new image and restarts the container
```

## GitHub Secret einrichten

1. GitHub → Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - Name: `PORTAINER_WEBHOOK_URL`
   - Value: Portainer-Webhook-URL für den pymon-web Stack
3. Save

## Image

| Registry | Image |
|----------|-------|
| GitHub Container Registry | `ghcr.io/mcfetz/pymon-web` |

| Tag | Wann |
|-----|------|
| `latest` | Jeder Push auf `main` |
| `main` | Jeder Push auf `main` |
| `1.2.3` / `1.2` / `1` | Git-Tag `v1.2.3` |

## Konfiguration (Laufzeit-Env-Vars)

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `PYMON_API_URL` | `http://pymon-server:5000` | URL des pymon-server Backends, erreichbar aus dem Container-Netz |

Der Wert wird per `envsubst` in die nginx-Konfiguration injiziert.
`/api/*` wird als Reverse-Proxy an `${PYMON_API_URL}/*` weitergeleitet.

## Portainer Stack

```yaml
services:
  pymon-web:
    image: ghcr.io/mcfetz/pymon-web:latest
    container_name: pymon-web
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      PYMON_API_URL: "http://pymon-server:5000"
```

## Manueller Redeploy

```bash
curl -fsS -X POST "<PORTAINER_WEBHOOK_URL>"
```
