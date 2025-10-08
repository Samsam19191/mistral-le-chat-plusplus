.PHONY: setup dev lint typecheck test test\:e2e test\:e2e\:ci build start docker\:build docker\:up docker\:down docker\:dev

setup:
	cd web && pnpm install

dev:
	cd web && pnpm dev

lint:
	cd web && pnpm lint

typecheck:
	cd web && pnpm typecheck

test:
	cd web && pnpm test

test\:e2e:
	cd web && pnpm test:e2e

test\:e2e\:ci:
	cd web && pnpm test:e2e:ci

build:
	cd web && pnpm build

start:
	cd web && pnpm start

docker\:build:
	docker compose build

docker\:up:
	docker compose up -d

docker\:down:
	docker compose down
