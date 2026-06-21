# Docker AR Tutor

Tutor de Docker en Realidad Aumentada. Escaneá el QR de Docker con tu celular y aparecen paneles interactivos en el espacio 3D respondiendo tus preguntas con RAG + LLM.

**Stack**: Next.js · Three.js · MindAR · Fastify · PostgreSQL + pgvector · OpenAI

---

## Inicio rápido (Docker — recomendado)

### Requisitos
- Docker + Docker Compose
- API key de OpenAI ([platform.openai.com/api-keys](https://platform.openai.com/api-keys))
- ngrok (solo para acceso desde celular vía HTTPS)

### Pasos

```bash
# 1. Clonar
git clone https://github.com/Gonzalo-Romero-V/docker-ar-experience-v2.git
cd docker-ar-experience-v2

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env y completar:
#   OPENAI_API_KEY=sk-...
#   INGEST_SECRET=cualquier-string-secreto

# 3. Levantar servicios
docker compose up -d

# La primera vez el backend auto-ingesta la documentación Docker (~2-3 min).
# Podés ver el progreso con:
docker logs -f docker_ar_v2_backend

# 4. Abrir en browser
# Desktop:  http://localhost:3001
# Celular:  necesitás HTTPS → ver sección de abajo
```

### Acceso desde celular (HTTPS obligatorio para la cámara)

```bash
# Opción A — ngrok (más fácil)
ngrok http 3001
# Abrís la URL https://xxxx.ngrok-free.app en el celular

# Opción B — misma red WiFi con certificado local
# El frontend dev server ya tiene HTTPS habilitado (ver sección Desarrollo)
```

---

## Desarrollo local (sin Docker)

Necesitás 3 terminales:

### Terminal 1 — Base de datos

```bash
docker compose up db -d
```

### Terminal 2 — Backend

```bash
cd app/backend
# Asegurate de tener .env con OPENAI_API_KEY y DATABASE_URL
npm install
npm run dev
# Corre en http://localhost:3000
# La primera vez auto-ingesta docs si la DB está vacía
```

### Terminal 3 — Frontend

```bash
cd app/frontend
npm install
npm run dev
# Corre en https://localhost:3001 (HTTPS habilitado para cámara)
```

El frontend en `https://localhost:3001` ya funciona en el celular si estás en la misma red WiFi:
```
https://TU-IP-LOCAL:3001
# Ejemplo: https://192.168.1.100:3001
```

> El certificado es auto-firmado — el celular va a mostrar advertencia de seguridad. Tocá "Avanzado → Continuar de todas formas".

---

## Cómo usar la experiencia

1. Hacé una pregunta sobre Docker en la pantalla inicial
2. Apuntá la cámara al **QR de Docker** (imprimí `public/targets/docker-target.png`)
3. Aparecen los paneles AR en el espacio 3D — rotá el celular para explorarlos
4. El narrador IA lee el resumen en voz alta al detectar el target
5. Tocá ▶ para repetir la narración, ■ para detenerla

---

## Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `OPENAI_API_KEY` | API key de OpenAI para RAG + TTS | ✅ |
| `INGEST_SECRET` | Secret para el endpoint `/ingest` | ✅ |
| `PORT` | Puerto del backend (default: 3000) | ❌ |
| `DATABASE_URL` | URL de PostgreSQL (docker-compose la inyecta) | auto |

---

## Ingesta manual de documentación

Si querés agregar más docs al RAG:

```bash
# Copiar docs al container
docker cp ./mis-docs/ docker_ar_v2_backend:/app/extra-docs/

# Ingestar
curl -X POST http://localhost:3000/ingest \
  -H "x-ingest-secret: TU_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"docsDir": "/app/extra-docs"}'
```

Los docs bundleados están en `docs/` (se auto-ingestan al arrancar si la DB está vacía).

---

## Estructura del proyecto

```
docker_ar_experience_v2/
├── app/
│   ├── frontend/          # Next.js + Three.js + MindAR
│   └── backend/           # Fastify API server
├── app/services/
│   ├── rag/               # Hybrid search (BM25 + pgvector)
│   └── llm/               # Orquestación OpenAI + prompts
├── packages/shared/       # Tipos y schemas Zod compartidos
├── docs/                  # Documentación Docker para el RAG
├── infra/postgres/        # Schema SQL de la base de datos
├── vault/                 # Vault Obsidian (fuente de verdad semántica)
├── docker-compose.yml
└── .env.example
```

---

## Solución de problemas

**Narrador no suena**
Abrí DevTools → Console y buscá mensajes `[TTS]`. Si aparece "fetch failed — is the backend running?" → el backend no está levantado.

**"Pregunta fuera del alcance"**
Los docs aún no se ingestan. Chequeá los logs del backend:
```bash
docker logs docker_ar_v2_backend | grep auto-ingest
```

**Cámara negra**
El navegador requiere HTTPS para acceder a la cámara. Usá `https://` en la URL.

**Paneles no aparecen**
Permisos de orientación del dispositivo: el navegador puede pedir permiso en iOS. Tocá "Permitir" en el popup.
