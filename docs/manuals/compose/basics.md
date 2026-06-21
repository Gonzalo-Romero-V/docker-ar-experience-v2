# Docker Compose

Docker Compose is a tool for defining and running multi-container applications. You define your app's services, networks, and volumes in a `docker-compose.yml` file, then run them with a single command.

## docker-compose.yml structure

```yaml
services:
  web:
    image: nginx
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html
    depends_on:
      - api

  api:
    build: ./api
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

## Key Compose commands

### docker compose up

Start all services. Builds images if needed.

```bash
docker compose up           # foreground (logs visible)
docker compose up -d        # detach (background)
docker compose up --build   # force rebuild images
docker compose up api db    # start specific services only
```

### docker compose down

Stop and remove containers and networks.

```bash
docker compose down           # stop and remove containers
docker compose down -v        # also remove volumes
docker compose down --rmi all # also remove images
```

### docker compose ps

List containers for this Compose project.

```bash
docker compose ps
docker compose ps -a  # include stopped
```

### docker compose logs

Show logs from services.

```bash
docker compose logs          # all services
docker compose logs api      # specific service
docker compose logs -f api   # follow
docker compose logs --tail 50 api
```

### docker compose exec

Execute a command in a running service container.

```bash
docker compose exec api bash
docker compose exec db psql -U user -d mydb
```

### docker compose build

Build or rebuild images.

```bash
docker compose build
docker compose build api       # specific service
docker compose build --no-cache
```

### docker compose restart

Restart services.

```bash
docker compose restart
docker compose restart api
```

### docker compose stop / start

Stop without removing containers, then start again.

```bash
docker compose stop
docker compose start
```

### docker compose pull

Pull latest images for services.

```bash
docker compose pull
```

### docker compose run

Run a one-off command in a service.

```bash
docker compose run api node migrate.js
docker compose run --rm api npm test
```

## Service configuration options

### build

```yaml
services:
  app:
    build:
      context: ./app        # build context directory
      dockerfile: Dockerfile.prod
      args:
        NODE_ENV: production
```

### image

```yaml
services:
  db:
    image: postgres:16
```

### ports

```yaml
services:
  web:
    ports:
      - "3000:3000"            # HOST:CONTAINER
      - "127.0.0.1:8080:80"   # bind to localhost only
```

### volumes

```yaml
services:
  app:
    volumes:
      - ./src:/app/src         # bind mount
      - node_modules:/app/node_modules  # named volume
      - /tmp:/tmp              # host path

volumes:
  node_modules:               # declare named volume
```

### environment

```yaml
services:
  app:
    environment:
      NODE_ENV: production
      PORT: 3000
    env_file:
      - .env                  # load from file
```

### depends_on

```yaml
services:
  api:
    depends_on:
      db:
        condition: service_healthy  # wait for healthcheck
      redis:
        condition: service_started  # just wait for start
```

### networks

```yaml
services:
  frontend:
    networks:
      - public
  backend:
    networks:
      - public
      - private
  db:
    networks:
      - private

networks:
  public:
  private:
    internal: true   # no external access
```

### restart policy

```yaml
services:
  app:
    restart: always          # always restart
    restart: unless-stopped  # restart unless manually stopped
    restart: on-failure      # restart only on error
```

### healthcheck

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
```

## Environment variables in Compose

Compose reads `.env` automatically from the project directory:

```env
# .env
POSTGRES_PASSWORD=secret
API_KEY=abc123
```

Use in compose file:
```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

Override at CLI:
```bash
POSTGRES_PASSWORD=othersecret docker compose up
```

## Multiple Compose files

```bash
# Override production config
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Container names

By default containers are named `{project}_{service}_{replica}`. Set explicitly:

```yaml
services:
  db:
    container_name: myapp_db
```
