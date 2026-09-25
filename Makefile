.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
BIN_DIR       := bin
CLI_BIN       := $(BIN_DIR)/easysql
ARCH          ?= $(shell uname -m | sed -e 's/x86_64/x64/' -e 's/aarch64/arm64/')

# ---------------------------------------------------------------------------
# .PHONY targets (strictly alphabetical)
# ---------------------------------------------------------------------------
.PHONY: build build-compile check clean deb help install lint lint-fix packages release-binaries rpm run setup test test-watch typecheck

# ---------------------------------------------------------------------------
# help (default) — auto-generated menu
# ---------------------------------------------------------------------------
help: ## Show this help menu
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
build: ## Build TypeScript to dist/
	bun run build

build-compile: ## Build a standalone executable (dist/easysql)
	bun run build:compile

# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------
check: ## Run lint + typecheck
	bun run check

clean: ## Remove build artifacts
	rm -rf dist $(BIN_DIR)

lint: ## Run Biome linter
	bun run lint

lint-fix: ## Run Biome linter with --write
	bun run lint:fix

typecheck: ## Run tsc --noEmit
	bun run typecheck

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------
test: ## Run tests once
	bun run test

test-watch: ## Run tests in watch mode
	bun run test:watch

# ---------------------------------------------------------------------------
# Distribution
# ---------------------------------------------------------------------------
deb: ## Build a .deb package for the host architecture (ARCH=arm64 to cross-build)
	bun run scripts/package-linux.ts --format deb --arch $(ARCH)

packages: deb rpm ## Build both the .deb and .rpm packages

release-binaries: ## Build binaries for all platforms (linux/darwin x x64/arm64)
	bun run scripts/release-binaries.ts

rpm: ## Build a .rpm package for the host architecture (ARCH=arm64 to cross-build)
	bun run scripts/package-linux.ts --format rpm --arch $(ARCH)

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
run: build-compile ## Compile and launch the interactive TUI
	$(CLI_BIN)

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
install: ## Install dependencies
	bun install

setup: install check test ## Full onboarding: install deps + lint/typecheck + tests
