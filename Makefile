# WebPhos Makefile
# Build and development automation for WebPhos
# 
# Usage:
#   make            - Show this help
#   make build      - Build production version to docs/ (for GitHub Pages)
#   make dev        - Start development server
#   make test       - Run tests
#   make lint       - Run linter
#   make typecheck  - Run TypeScript type checker
#   make clean      - Remove build artifacts

# Version of the application = content of the VERSION file
VERSION := $(strip $(shell cat VERSION))

.PHONY: help build dev test lint typecheck clean install version

# Default target - show help
help:
	@echo "WebPhos $(VERSION) - Build Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build       Build production version to docs/ (for GitHub Pages)"
	@echo "  dev         Start development server (webpack-dev-server)"
	@echo "  test        Run unit tests with coverage"
	@echo "  test-watch    Run tests in watch mode"
	@echo "  lint        Run ESLint on source files"
	@echo "  typecheck   Run TypeScript type checker"
	@echo "  clean       Remove build artifacts (dist/, docs/)"
	@echo "  install     Install npm dependencies"
	@echo "  version     Show the version from the VERSION file"
	@echo "  help        Show this help message"
	@echo ""

# Build production version to docs/ for GitHub Pages
build: clean
	@echo "Building WebPhos $(VERSION) (from the VERSION file)..."
	@npm pkg set version=$(VERSION) > /dev/null
	npm run build
	@echo "Copying to docs/ for GitHub Pages..."
	@mkdir -p docs
	@cp -r dist/. docs/
	@echo "Build complete! Output in docs/"
	@echo "Total size: $$(du -sh docs | cut -f1)"

# Show the version
version:
	@echo $(VERSION)

# Start development server
dev:
	npm run server

# Run tests
test:
	npm test

# Run tests in watch mode
test-watch:
	npm run test:watch

# Run linter
lint:
	npm run lint

# Run TypeScript type checker
typecheck:
	npm run typecheck

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist
	@rm -rf docs
	@echo "Clean complete"

# Install dependencies
install:
	npm install

# Full CI pipeline (lint + typecheck + test + build)
ci: lint typecheck test build
	@echo "CI pipeline completed successfully!"

# Deploy to GitHub Pages (requires gh-pages package or manual push)
deploy: build
	@echo "To deploy to GitHub Pages:"
	@echo "  1. Commit the docs/ folder"
	@echo "  2. Push to GitHub"
	@echo "  3. Enable GitHub Pages in repository settings (Source: Deploy from branch 'main', folder '/docs')"
	@echo ""
	@echo "Or use: npx gh-pages -d docs"