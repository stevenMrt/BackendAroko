# Guía de Despliegue — Aroko Backend

## Variables de entorno de producción

Copia `.env.example` a `.env` en el servidor y rellena con valores reales y seguros:

| Variable | Descripción | Valor de ejemplo |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto del servidor | `3000` |
| `BASE_URL` | URL pública para servir assets | `https://api.tudominio.com` |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos (coma) | `https://tudominio.com,https://www.tudominio.com` |
| `DATABASE_URL` | Connection string de PostgreSQL (Neon) | `postgresql://USER:PASS@host:5432/db?sslmode=require` |
| `JWT_SECRET` | Secret key para JWT (¡usar `openssl rand -base64 48`!) | *(aleatorio)* |
| `JWT_EXPIRES_IN` | Expiración del token | `8h` |
| `EMAIL_USER` | Usuario SMTP / Gmail | `notificaciones@tudominio.com` |
| `EMAIL_PASS` | Password SMTP / App Password | *(app password)* |

## Instrucciones de despliegue

### Opción 1: Docker (recomendado)

```bash
# 1. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus valores reales

# 2. Build y run
docker build -t aroko-backend .
docker run -d \
  --name aroko-backend \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/uploads:/app/uploads \
  aroko-backend
```

### Opción 2: PM2 (en servidor bare metal)

```bash
# 1. Instalar PM2 globalmente
npm install -g pm2

# 2. Configurar .env
cp .env.example .env
# Edita .env

# 3. Iniciar con la configuración de ecosystem
pm2 start ecosystem.config.js

# 4. Ver logs
pm2 logs aroko-backend

# 5. Guardar estado (para reinicio automático)
pm2 save
pm2 startup
```

### Opción 3: Render (recomendado para producción)

#### Opción 3a: Render con render.yaml (IaC)

1. Haz push a tu repositorio Git (GitHub/GitLab/Bitbucket).
2. En [Render Dashboard](https://dashboard.render.com) crea un **New Web Service** → conecta tu repo.
3. Render detecta `render.yaml` automáticamente y crea:
   - Una base de datos PostgreSQL gestionada (`aroko-db`)
   - Un Web Service (`aroko-backend`) con Docker
4. **Configura estas env vars en el Dashboard de Render** (Settings → Environment):
   - `NODE_ENV` = `production` (ya está en render.yaml)
   - `BASE_URL` = URL que Render asigne (ej: `https://aroko-backend.onrender.com`)
   - `ALLOWED_ORIGINS` = dominio de Flutter Web (ej: `https://tuapp.web.app`)
   - `JWT_SECRET` = `openssl rand -base64 48` (generar en servidor, pegar en Render)
   - `EMAIL_USER` = cuenta de correo de producción
   - `EMAIL_PASS` = app password de Gmail (o SMTP credentials)
5. Haz click en **Deploy**.

#### Opción 3b: Render sin render.yaml

Si no usas render.yaml, crea el servicio manualmente en Render:
- Build Command: `docker build -t aroko-backend .`
- Start Command: `node src/index.js` (o deja que el Dockerfile gestione el CMD)
- Health Check: `/api/health/ready`
- Environment: añade las variables de la tabla de arriba

#### Uploads en Render

Render tiene un filesystem **efímero**. Los archivos subidos a `/uploads/` desaparecen en cada redeploy.
Para persistencia, usa **Render Persistent Disk** (pestaña "Disks" en el servicio) y monta `/app/uploads`.

### Opción 4: Directo con Node

```bash
cp .env.example .env
npm install --production
NODE_ENV=production npm start
```

## Generar JWT_SECRET seguro

```bash
openssl rand -base64 48
```

## Endpoints de health check

- `GET /api/health` — liveness (verifica que el proceso responde)
- `GET /api/health/ready` — readiness (verifica conectividad a PostgreSQL)

## Notas importantes

1. **Nunca** commitees `.env` con valores reales.
2. Si usas Docker, los secretos se pasan via `--env-file .env` (no se copian al build).
3. Las migraciones se ejecutan automáticamente al iniciar la app.
4. Los uploads persisten en `./uploads/` — monta un volumen si usas Docker.
5. En Render, usa **Persistent Disk** para uploads, o migra a S3/Cloudinary.
