# Images

A Docker image is a read-only template that contains the instructions for creating a container. An image is composed of layers stacked on top of each other.

## Image naming

Images are identified by `REPOSITORY:TAG`. If no tag is specified, `latest` is used.

Examples:
- `nginx` → `nginx:latest`
- `node:20-alpine`
- `postgres:16`
- `myusername/myapp:v1.2.3`

## Working with images

```bash
# List local images
docker images
docker image ls

# Pull from registry
docker pull nginx
docker pull node:20-alpine

# Build from Dockerfile
docker build -t my-app:latest .
docker build -t my-app:v1.0 -f Dockerfile.prod .

# Remove an image
docker rmi my-app:latest
docker image rm my-app:latest

# Remove all unused images
docker image prune
docker image prune -a  # remove all not used by any container

# Tag an image
docker tag my-app:latest myuser/my-app:v1.0

# Push to Docker Hub
docker push myuser/my-app:v1.0

# Inspect an image
docker image inspect nginx

# Show image history (layers)
docker history nginx
```

## Image layers

Each Dockerfile instruction creates a layer. Layers are:
- **Read-only**: cannot be changed after creation
- **Cached**: reused if unchanged, speeding up builds
- **Shared**: multiple images can share the same layer

When you run a container, Docker adds a thin writable layer on top. This is the container layer — removed when the container is deleted (unless using volumes).

## Searching for images

```bash
# Search Docker Hub
docker search nginx

# Search with filters
docker search --filter is-official=true nginx
docker search --filter stars=100 nginx
```

## Saving and loading images

```bash
# Save image to tar file (includes all layers)
docker save -o nginx.tar nginx:latest

# Load image from tar
docker load -i nginx.tar

# Export/import (container filesystem, no layers/history)
docker export container-name > container.tar
docker import container.tar my-image:latest
```

## Multi-platform images

Docker supports building images for multiple architectures (AMD64, ARM64):

```bash
# Build for specific platform
docker build --platform linux/amd64 -t my-app .

# Build multi-platform with buildx
docker buildx build --platform linux/amd64,linux/arm64 -t my-app --push .
```

## Image registries

- **Docker Hub** (hub.docker.com): default public registry
- **GitHub Container Registry** (ghcr.io): integrated with GitHub
- **Google Artifact Registry** (gcr.io)
- **Amazon ECR** (AWS)
- **Self-hosted**: run your own registry with `registry:2` image

```bash
# Log in to Docker Hub
docker login

# Log in to private registry
docker login registry.example.com

# Pull from private registry
docker pull registry.example.com/myapp:latest

# Push to private registry
docker tag myapp:latest registry.example.com/myapp:latest
docker push registry.example.com/myapp:latest
```

## Distroless and minimal images

For production, use minimal base images:
- `alpine`: 5MB, musl libc
- `node:20-alpine`: Node.js on Alpine
- `gcr.io/distroless/nodejs`: no shell, no package manager
- `scratch`: completely empty

Smaller images = faster pulls, smaller attack surface.
