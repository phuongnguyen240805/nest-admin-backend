# ADR-001: Provider-neutral Ads workflow shell

Status: accepted, implemented foundation (2026-08-08)

## Decision

Use one shared contract and one job workflow for Meta, TikTok and Shopee. Each provider plugin owns
only its platform-specific OAuth, API mapping, validation, publish steps and reconciliation.

Shared concerns are implemented once:

- tenant and connection ownership;
- capability policy;
- credential vault and redaction;
- idempotent job creation;
- state transitions, retry checkpoints and audit events;
- snapshot provenance, freshness and fingerprinting;
- fixed-host HTTP policy and normalized errors.

Provider-specific concerns remain behind `AdsProviderPlugin`:

- Meta: campaign → ad set → creative → ad, default `PAUSED`;
- TikTok: campaign → ad group → ad, default `DISABLE`;
- Shopee: approved partner schema/path mapping, disabled unless explicitly enabled.

## Consequences

Adding another provider requires a manifest and supported ports rather than copying controllers,
queues, vault logic and workflow state. A manifest must not advertise a capability without an
implementation. Browser-observed data is never promoted silently to canonical data.

