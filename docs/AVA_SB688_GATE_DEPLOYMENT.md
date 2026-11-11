# AVA to SB688 pre-brain gate deployment

The AVA orchestrate handler calls the SB688 TypeScript endpoint POST /api/truth/pre-brain before it calls the AVA brain. The endpoint runs the real SpineGovernor and LiquidTruthNodeMesh. It is disabled unless all durable credentials and replay persistence are configured.

## SB688 service environment

Set these as secret/runtime environment variables:

- SB688_GATE_SHARED_SECRET: random secret with at least 32 characters.
- SB688_SPINE_PRIVATE_KEY_FILE: path to the operator's Ed25519 private key in PEM format, or SB688_SPINE_PRIVATE_KEY (secret value).
- SB688_SPINE_PUBLIC_KEY_FILE: matching Ed25519 public key in PEM format, or SB688_SPINE_PUBLIC_KEY.
- SB688_PERMIT_REPLAY_STORE_PATH: writable path for the durable one-time permit replay store.

Mount a persistent disk at the replay-store path. A container's ephemeral filesystem does not provide restart-safe replay protection. Restrict private key file permissions to the service operator. Never commit key material.

The private and public keys must be a matching pair. If configuration is missing or malformed, the endpoint returns unavailable rather than falling back to an ephemeral key.

## AVA service environment

Set:

- SB688_RUNTIME_URL: HTTPS base URL of the deployed SB688 service, without the /api/truth/pre-brain suffix.
- SB688_GATE_SHARED_SECRET: the exact same secret as the SB688 service.

Do not use plain HTTP between separate services. The AVA client rejects non-HTTPS remote URLs. The secret is sent only in the Authorization header.

## Expected behavior

- A successful response means the durable SpineGovernor approved the intent and the LiquidTruthNodeMesh verified and durably recorded one-time use of the permit.
- Invalid intent, failed signature, replay, missing durable key, missing replay store, network error, timeout, or malformed response blocks AVA's brain call.
- The endpoint is a pre-brain authorization gate. It does not itself run the AVA brain or replace AVA's own history-chain and scope checks.

After deployment, test first in staging with a benign intent, a rejected governance-bypass intent, a replay attempt, and a temporarily unavailable SB688 endpoint. Confirm that only the benign first request passes.
