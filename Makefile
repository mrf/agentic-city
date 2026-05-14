.PHONY: build test lint run dev clean web

build: web
	go build ./...

test:
	go test ./...

lint:
	go vet ./...

web:
	cd web && npm run build

dev:
	cd web && npm run dev

run: build
	go run ./cmd/agentic-city

clean:
	rm -rf web/dist
	go clean ./...
