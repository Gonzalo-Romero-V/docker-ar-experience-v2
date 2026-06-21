# Containers

A container is an isolated, runnable environment built from an image. Containers are the core unit of Docker.

## Container lifecycle

```
Created → Running → Paused → Running → Stopped → Removed
```

- **Created**: container exists but hasn't started
- **Running**: process is executing
- **Paused**: process is frozen (memory preserved)
- **Stopped/Exited**: process has ended
- **Removed**: container and its writable layer are deleted

## Running containers

```bash
# Run a container from an image
docker run nginx

# Run in background (detached mode)
docker run -d nginx

# Run with a name
docker run -d --name my-web nginx

# Run with port mapping (host:container)
docker run -d -p 8080:80 nginx

# Run with multiple ports
docker run -d -p 8080:80 -p 443:443 nginx

# Run with environment variables
docker run -d -e MYSQL_ROOT_PASSWORD=secret mysql:8

# Run and automatically remove when stopped
docker run --rm nginx

# Run interactively with a shell
docker run -it ubuntu bash
docker run -it node:20 node
```

## Viewing containers

```bash
# Running containers
docker ps

# All containers (running + stopped)
docker ps -a

# Only IDs
docker ps -q

# Custom format
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Container management

```bash
# Start a stopped container
docker start my-web

# Stop a running container (sends SIGTERM, then SIGKILL after 10s)
docker stop my-web

# Stop with custom timeout
docker stop --time 30 my-web

# Force kill (SIGKILL immediately)
docker kill my-web

# Restart
docker restart my-web

# Pause / unpause (freeze process in memory)
docker pause my-web
docker unpause my-web

# Remove stopped container
docker rm my-web

# Force remove running container
docker rm -f my-web

# Remove all stopped containers
docker container prune
```

## Container logs

```bash
# All logs
docker logs my-web

# Follow (stream) logs
docker logs -f my-web

# Last N lines
docker logs --tail 100 my-web

# Since timestamp
docker logs --since 2024-01-01T00:00:00 my-web
docker logs --since 1h my-web
```

## Executing commands in containers

```bash
# Interactive shell
docker exec -it my-web bash
docker exec -it my-web sh   # for Alpine-based images

# Run a command
docker exec my-web cat /etc/nginx/nginx.conf

# Environment variable in exec
docker exec -e DEBUG=true my-web node debug.js

# Run as specific user
docker exec -u root my-web bash
```

## Copying files

```bash
# Copy from container to host
docker cp my-web:/etc/nginx/nginx.conf ./nginx.conf

# Copy from host to container
docker cp ./nginx.conf my-web:/etc/nginx/nginx.conf
```

## Container information

```bash
# Detailed JSON information
docker inspect my-web

# Get specific field
docker inspect --format '{{.State.Status}}' my-web
docker inspect --format '{{.NetworkSettings.IPAddress}}' my-web

# Resource usage stats
docker stats my-web

# Running processes inside container
docker top my-web
```

## Saving container state

```bash
# Commit container changes to a new image
docker commit my-web my-custom-nginx:v1

# Export container filesystem as tar
docker export my-web > my-web.tar

# Import tar as image
docker import my-web.tar my-image:latest
```

## Container isolation

Containers are isolated by default through Linux kernel features:
- **Namespaces**: Each container has its own PID, network, user, and filesystem namespace
- **cgroups**: Resource limits (CPU, memory, disk I/O)
- **Union filesystem**: Layers from the image are read-only; the container adds a writable layer on top

## Resource limits

```bash
# Limit memory
docker run -d --memory 512m nginx

# Limit CPU
docker run -d --cpus 0.5 nginx  # use at most 50% of one CPU

# Both
docker run -d --memory 512m --cpus 1.0 nginx
```

## Container networking

By default, containers connect to the `bridge` network and can reach each other by IP. Use custom networks for DNS-based name resolution:

```bash
# Create network
docker network create my-app

# Run containers on same network
docker run -d --network my-app --name db postgres
docker run -d --network my-app --name api my-api-image

# Now api can reach db at hostname "db"
```
