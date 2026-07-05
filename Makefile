# Armory — shooting diary. All commands run the stack in Docker (always behind Traefik).
COMPOSE := docker compose

.PHONY: up web api down logs ps restart build

## up: build + start the full stack (web routed via Traefik at $${ARMORY_DOMAIN})
up:
	$(COMPOSE) up -d --build

## web: rebuild + restart just the web (frontend) service
web:
	$(COMPOSE) up -d --build web

## api: rebuild + restart just the api service
api:
	$(COMPOSE) up -d --build api

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
