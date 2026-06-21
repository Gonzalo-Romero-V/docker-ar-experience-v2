# Storage: Volumes and Bind Mounts

Containers are ephemeral — their writable layer is destroyed when removed. To persist data, Docker provides volumes and bind mounts.

## Types of storage

| Type | Where stored | Managed by | Use case |
|------|-------------|------------|----------|
| Volume | Docker area (`/var/lib/docker/volumes/`) | Docker | Production data persistence |
| Bind mount | Anywhere on host filesystem | User | Development, config injection |
| tmpfs mount | Host memory only | Docker | Sensitive data, temp files |

## Volumes (recommended for production)

Volumes are managed by Docker and are the preferred method for persisting data.

```bash
# Create a volume
docker volume create my-data

# List volumes
docker volume ls

# Inspect a volume
docker volume inspect my-data

# Remove a volume
docker volume rm my-data

# Remove all unused volumes
docker volume prune
```

### Using volumes with containers

```bash
# Mount a named volume
docker run -d -v my-data:/var/lib/postgresql/data postgres

# Short syntax
docker run -d --mount type=volume,src=my-data,dst=/data my-app

# Anonymous volume (auto-named)
docker run -d -v /data my-app
```

### Volumes in Compose

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    volumes:
      - uploads:/app/uploads

volumes:
  pgdata:          # named volume, Docker managed
  uploads:
```

## Bind mounts

Bind mounts map a host directory into the container. Changes are reflected immediately in both directions. Ideal for development.

```bash
# Mount current directory
docker run -d -v $(pwd):/app node:20

# Mount specific host path
docker run -d -v /home/user/config:/etc/myapp/config:ro nginx

# Read-only bind mount
docker run -d -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro nginx
```

### Bind mounts in Compose

```yaml
services:
  app:
    volumes:
      - ./src:/app/src          # host:container (relative paths ok)
      - ./config:/app/config:ro # read-only
```

## tmpfs mounts (in-memory)

Data exists only in memory, never written to disk. Good for secrets or temp data.

```bash
docker run -d --tmpfs /tmp:rw,size=100m,mode=1777 my-app
```

## Volume drivers

Volumes support plugins for cloud storage:
- `local`: default, uses host filesystem
- `nfs`: NFS shares
- AWS EBS, Azure Disk, GlusterFS, etc.

```bash
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.1,rw \
  --opt device=:/path/to/share \
  nfs-volume
```

## Backup and restore volumes

```bash
# Backup: dump volume contents to tar on host
docker run --rm \
  -v my-data:/source:ro \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/my-data-backup.tar.gz -C /source .

# Restore
docker run --rm \
  -v my-data:/target \
  -v $(pwd):/backup \
  alpine \
  tar xzf /backup/my-data-backup.tar.gz -C /target
```

## Sharing volumes between containers

```bash
# Create shared volume
docker volume create shared

# Mount in multiple containers
docker run -d -v shared:/data --name writer my-writer
docker run -d -v shared:/data:ro --name reader my-reader
```

In Compose, any service can reference the same named volume.

## Storage best practices

1. **Use volumes, not bind mounts in production** — volumes are portable and Docker-managed.
2. **Never store data in the container layer** — it's lost on `docker rm`.
3. **Use named volumes for databases** — PostgreSQL, MySQL data should go in volumes.
4. **Use bind mounts for development** — real-time code sync without rebuilding.
5. **Set read-only when possible** — `:ro` prevents accidental writes.
6. **Backup volumes regularly** — they are outside of image/container backups.
