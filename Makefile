# Armory — shooting diary. All commands run the stack in Docker (always behind Traefik).
COMPOSE := docker compose

.PHONY: up down logs ps restart build

## up: build + start the full stack (web routed via Traefik at $${ARMORY_DOMAIN})
up:
	$(COMPOSE) up -d --build

## down: stop and remove containers (keeps volumes / data)
down:
	$(COMPOSE) down

## logs: follow logs from all services
logs:
	$(COMPOSE) logs -f

## ps: show service status
ps:
	$(COMPOSE) ps

## restart: restart all services
restart:
	$(COMPOSE) restart

## build: build images without starting
build:
	$(COMPOSE) build
