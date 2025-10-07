.PHONY: setup dev lint typecheck test test\:e2e test\:e2e\:ci build start

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
