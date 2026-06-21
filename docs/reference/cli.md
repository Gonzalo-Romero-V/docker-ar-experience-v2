# Docker CLI Reference

## docker run

Run a command in a new container.

```
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
```

Common options:
- `-d, --detach`: Run container in background and print container ID
- `-p, --publish HOST:CONTAINER`: Publish a container's port to the host. Example: `-p 8080:80`
- `-v, --volume HOST:CONTAINER`: Bind mount a volume. Example: `-v ./data:/app/data`
- `--name NAME`: Assign a name to the container
- `-e, --env KEY=VALUE`: Set environment variables
- `-it`: Interactive terminal (combine `-i` and `-t`)
- `--rm`: Automatically remove container when it exits
- `--network NAME`: Connect to a network
- `--restart always`: Always restart the container if it stops

Examples:
```bash
# Run nginx in background on port 8080
docker run -d -p 8080:80 --name my-nginx nginx

# Run a shell inside Ubuntu interactively
docker run -it ubuntu bash

# Run with env vars and auto-remove
docker run --rm -e NODE_ENV=production node:20 node app.js

# Run with a volume mount
docker run -d -v ./html:/usr/share/nginx/html -p 8080:80 nginx
```

## docker build

Build an image from a Dockerfile.

```
docker build [OPTIONS] PATH
```

Common options:
- `-t, --tag NAME:TAG`: Name and optionally tag the image
- `-f, --file`: Name of the Dockerfile (default: PATH/Dockerfile)
- `--no-cache`: Do not use cache when building
- `--build-arg KEY=VALUE`: Set build-time variables

Examples:
```bash
# Build and tag an image from the current directory
docker build -t my-app:latest .

# Build with a specific Dockerfile
docker build -f Dockerfile.prod -t my-app:prod .

# Build without cache
docker build --no-cache -t my-app .
```

## docker ps

List containers.

```
docker ps [OPTIONS]
```

Common options:
- `-a, --all`: Show all containers (default shows only running)
- `-q, --quiet`: Only display container IDs
- `--format`: Pretty-print using a Go template

Examples:
```bash
# List running containers
docker ps

# List all containers including stopped ones
docker ps -a

# List only container IDs
docker ps -q
```

## docker stop

Stop one or more running containers.

```
docker stop CONTAINER [CONTAINER...]
```

Examples:
```bash
# Stop by name
docker stop my-nginx

# Stop by ID
docker stop abc123

# Stop all running containers
docker stop $(docker ps -q)
```

## docker start

Start one or more stopped containers.

```
docker start CONTAINER [CONTAINER...]
```

## docker rm

Remove one or more containers.

```
docker rm [OPTIONS] CONTAINER [CONTAINER...]
```

Options:
- `-f, --force`: Force removal of a running container

Examples:
```bash
docker rm my-nginx
docker rm -f my-nginx  # force stop and remove
# Remove all stopped containers
docker rm $(docker ps -aq)
```

## docker images

List images.

```
docker images [OPTIONS] [REPOSITORY[:TAG]]
```

Examples:
```bash
docker images
docker images nginx
```

## docker rmi

Remove one or more images.

```
docker rmi IMAGE [IMAGE...]
```

Examples:
```bash
docker rmi my-app:latest
docker rmi $(docker images -q)  # remove all images
```

## docker pull

Pull an image from a registry.

```
docker pull IMAGE[:TAG]
```

Examples:
```bash
docker pull nginx
docker pull node:20-alpine
docker pull postgres:16
```

## docker push

Push an image to a registry.

```
docker push IMAGE[:TAG]
```

Examples:
```bash
docker push myusername/my-app:latest
```

## docker exec

Run a command in a running container.

```
docker exec [OPTIONS] CONTAINER COMMAND [ARG...]
```

Common options:
- `-it`: Interactive terminal
- `-e KEY=VALUE`: Set environment variables

Examples:
```bash
# Open a shell in a running container
docker exec -it my-nginx bash

# Run a command without interactive mode
docker exec my-nginx nginx -t

# Check environment variables inside a container
docker exec my-app env
```

## docker logs

Fetch the logs of a container.

```
docker logs [OPTIONS] CONTAINER
```

Common options:
- `-f, --follow`: Follow log output (like tail -f)
- `--tail N`: Number of lines to show from the end
- `--since TIME`: Show logs since timestamp

Examples:
```bash
# Show all logs
docker logs my-app

# Follow logs in real time
docker logs -f my-app

# Show last 100 lines
docker logs --tail 100 my-app
```

## docker inspect

Return low-level information on containers or images.

```
docker inspect CONTAINER|IMAGE
```

Examples:
```bash
docker inspect my-nginx
docker inspect --format '{{.NetworkSettings.IPAddress}}' my-nginx
```

## docker stats

Display a live stream of container resource usage statistics.

```
docker stats [CONTAINER...]
```

## docker system prune

Remove unused data (stopped containers, dangling images, unused networks).

```
docker system prune [OPTIONS]
```

Options:
- `-a, --all`: Remove all unused images, not just dangling ones
- `-f, --force`: Do not prompt for confirmation

Examples:
```bash
docker system prune
docker system prune -af  # remove everything unused
```

## docker volume

Manage volumes.

```bash
docker volume create my-data
docker volume ls
docker volume inspect my-data
docker volume rm my-data
docker volume prune  # remove all unused volumes
```

## docker network

Manage networks.

```bash
docker network create my-net
docker network ls
docker network inspect my-net
docker network connect my-net my-container
docker network disconnect my-net my-container
docker network rm my-net
```

## docker tag

Create a tag that refers to a source image.

```bash
docker tag my-app:latest myusername/my-app:v1.0
```

## docker login / logout

Log in to a registry.

```bash
docker login
docker login registry.example.com
docker logout
```
