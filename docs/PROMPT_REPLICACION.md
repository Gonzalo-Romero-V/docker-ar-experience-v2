# Prompt e instrucciones de replicación

Este documento permite levantar el proyecto completo en otra PC. La única
configuración que debe aportar la otra persona es una clave de API de OpenAI.
La base de datos, dependencias, documentación para RAG y servicios se crean
automáticamente con Docker Compose.

## Requisitos

- Git.
- Docker Desktop instalado y en ejecución. En Windows, activar el backend WSL
  2 cuando Docker Desktop lo solicite.
- Una clave válida de OpenAI, con saldo o facturación habilitada.

## Arranque reproducible

Ejecutar en PowerShell:

```powershell
git clone --branch main https://github.com/Gonzalo-Romero-V/docker-ar-experience-v2.git
cd docker-ar-experience-v2
Copy-Item .env.example .env
notepad .env
```

En `.env`, reemplazar únicamente este valor:

```dotenv
OPENAI_API_KEY=sk-...
```

No hace falta modificar `INGEST_SECRET`, puertos ni URLs para el uso local.
Después iniciar la aplicación:

```powershell
docker compose up --build -d
docker compose ps
```

Abrir [http://localhost:3001](http://localhost:3001). La primera ejecución
puede tardar algunos minutos: Docker crea las imágenes y la base de datos, y
el backend indexa la documentación incluida para el buscador RAG.

## Comprobación y diagnóstico

```powershell
# Debe responder con status "ok"
Invoke-RestMethod http://localhost:3000/health

# Ver progreso de la primera indexación o errores
docker compose logs -f backend
```

Cuando los logs muestren `auto-ingest] Done`, la base de conocimiento está
lista. Para detener los servicios sin perder datos:

```powershell
docker compose down
```

Para reiniciarlos más adelante:

```powershell
docker compose up -d
```

## Uso desde un celular

La cámara del navegador exige HTTPS fuera de `localhost`. Para una prueba
rápida, con los contenedores levantados ejecutar en otra terminal:

```powershell
ngrok http 3001
```

Abrir en el celular la URL `https://` que muestra ngrok y aceptar el permiso
de cámara. `ngrok` no es necesario para usar la aplicación en la PC.

## Prompt para asistencia técnica

Si algo falla, copiar el siguiente prompt junto con la salida de los comandos
indicados. No pegar nunca el contenido de `.env` ni la clave de OpenAI.

```text
Estoy replicando el repositorio docker-ar-experience-v2 en Windows con Docker
Desktop. Seguí docs/PROMPT_REPLICACION.md, configuré solo OPENAI_API_KEY en
.env y ejecuté `docker compose up --build -d`.

Necesito diagnosticar el error sin cambiar la arquitectura ni exponer secretos.
Analiza estas salidas y dame comandos de PowerShell concretos, uno por uno:

1. docker compose ps
2. docker compose logs --tail=200 backend
3. docker compose logs --tail=100 frontend
4. docker compose logs --tail=100 db
5. Invoke-RestMethod http://localhost:3000/health

Explica cuál es la causa probable y cómo verificar la corrección. No pidas ni
muestres OPENAI_API_KEY, ni el contenido completo de .env.
```
