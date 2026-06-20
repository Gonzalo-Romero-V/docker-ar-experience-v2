# Docker AR Tutor v2 — Guía de arranque

## Situación del entorno local (2026-06-20)

| Servicio | Puerto | Estado |
|---|---|---|
| PostgreSQL (nativo, v1) | 5432 | ✅ siempre activo |
| v1 frontend (Next.js) | 3000 | ⚠️ corre por separado — no interferir |
| v1 backend (Fastify) | 8787 | ⚠️ corre por separado |
| **v2 backend (Fastify)** | **3002** | 🟢 arrancar en Terminal 1 |
| **v2 frontend (Next.js)** | **3001** | 🟢 arrancar en Terminal 2 |

> Docker Desktop **no es necesario** en desarrollo local. La DB ya corre como instalación nativa en 5432.

---

## Prerequisitos (una sola vez)

### Base de datos v2

Si es la primera vez o la DB fue borrada:

```powershell
# Crear la DB
psql "postgresql://postgres:gonzalo@localhost:5432/postgres" -c "CREATE DATABASE docker_ar_v2;"

# Aplicar schema
psql "postgresql://postgres:gonzalo@localhost:5432/docker_ar_v2" `
  -f "infra/postgres/init.sql"
```

### Ingestar documentación Docker

El backend necesita docs para dar respuestas grounded. Sin ingest, responde con conocimiento general del LLM (funciona pero grounding=out_of_scope).

```powershell
# 1. Asegurarse de que el backend v2 está corriendo
# 2. Pasar el path absoluto al directorio de docs Docker
curl -s -X POST http://localhost:3002/ingest `
  -H "X-Ingest-Secret: docker-ar-dev-secret" `
  -H "Content-Type: application/json" `
  -d '{"docsDir":"C:/ruta/a/docker-docs"}'
```

Para clonar los docs de Docker:
```bash
git clone --depth 1 https://github.com/docker/docs.git C:/docker-docs
# Luego usar docsDir: "C:/docker-docs/content"
```

---

## Arranque diario (2 terminales)

### Terminal 1 — Backend (puerto 3002)

```powershell
cd C:\Users\Gonzalo\Dev\MATERIAS\03_EVA\docker_ar_experience_v2\app\backend
node --env-file=.env --import tsx src/index.ts
```

Alternativa con npm:
```powershell
cd C:\Users\Gonzalo\Dev\MATERIAS\03_EVA\docker_ar_experience_v2
npm run backend
```

Confirmar que arrancó: `curl http://localhost:3002/health`
Respuesta esperada: `{"status":"ok","timestamp":"..."}`

### Terminal 2 — Frontend (puerto 3001, accesible desde celular)

```powershell
cd C:\Users\Gonzalo\Dev\MATERIAS\03_EVA\docker_ar_experience_v2\app\frontend
npm run dev
```

Alternativa con npm:
```powershell
cd C:\Users\Gonzalo\Dev\MATERIAS\03_EVA\docker_ar_experience_v2
npm run frontend
```

Confirmar: abrir `http://localhost:3001` en el browser.

---

## Acceso desde celular (HTTPS requerido para cámara)

La cámara requiere HTTPS en cualquier URL que no sea `localhost`. El frontend ya arranca con HTTPS usando certificados mkcert.

La IP LAN de esta máquina: **192.168.33.93**

URL desde celular: **`https://192.168.33.93:3001`**

### Instalar el certificado raíz en el celular (una sola vez)

El archivo está en `app/docs/mkcert-rootCA.pem`. Sin esto el browser mostrará "Conexión no segura".

**Android (Chrome):**
1. Enviarte el archivo `mkcert-rootCA.pem` por mail/WhatsApp/USB
2. Abrirlo en el celular → Android abre el instalador de certificados
3. Elegir "CA certificate" (o "Certificado de autoridad")
4. Nombrar como "mkcert dev" → aceptar
5. El browser ya confiará en el cert cuando abras `https://192.168.33.93:3001`

**iOS (Safari):**
1. Enviarte el archivo `mkcert-rootCA.pem` renombrado a `mkcert-rootCA.crt`
2. Abrirlo en el iPhone → aparece "Perfil descargado" → ir a Ajustes
3. Ajustes → General → VPN y gestión del dispositivo → instalar el perfil
4. Ajustes → General → Acerca de → Configuración de confianza de certificado → activar el certificado mkcert
5. Safari ya confía en el cert

> Los certs mkcert son solo para la red local. Expiran en 2028.

---

## Variables de entorno

### `app/backend/.env` (ya creado, NO committear)

```
PORT=3002
DATABASE_URL=postgresql://postgres:gonzalo@localhost:5432/docker_ar_v2
OPENAI_API_KEY=sk-proj-...  (misma key que v1)
INGEST_SECRET=docker-ar-dev-secret
NODE_ENV=development
```

### `app/frontend/.env.local` (ya creado, NO committear)

```
BACKEND_URL=http://localhost:3002
```

El frontend usa `/api/*` como proxy a este URL (configurado en `next.config.ts`).

---

## Prueba rápida del backend

```bash
# Health
curl http://localhost:3002/health

# Ask (sin docs = responde con conocimiento general)
curl -s -X POST http://localhost:3002/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"que es un contenedor docker"}'

# Ingest (requiere docs clonados)
curl -s -X POST http://localhost:3002/ingest \
  -H "X-Ingest-Secret: docker-ar-dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"docsDir":"C:/path/to/docker-docs/content"}'
```

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `EADDRINUSE 3002` | El backend ya está corriendo | `netstat -ano \| findstr 3002` → kill el PID |
| `/ask` devuelve error 500 columna | Schema DB desactualizado | Re-run `init.sql` |
| `/ask` devuelve fallback siempre | Cache con respuesta rota | `psql ... -c "DELETE FROM query_cache;"` |
| Frontend no llega al backend | BACKEND_URL incorrecto | Verificar `.env.local` y `next.config.ts` |
| Cámara no abre en celular | HTTP en iOS | Usar ngrok para HTTPS tunnel |
