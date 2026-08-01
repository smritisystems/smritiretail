# GST Engine

The GST Engine is the finance foundation's tax calculation and posting contract.

## Structure

- `manifest.json` — capability metadata
- `api/` — public API contracts for GST calculations
- `domain/` — core tax rules and calculation engine
- `application/` — service layer for consuming applications
- `infrastructure/` — integration adapters and persistence
- `tests/` — engine regression tests

## Engine contract

The GST Engine exposes tax calculation operations and total amount computation. It is designed to be consumed by accounting posting flows, invoice engines, and tax reporting components.
