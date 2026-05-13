import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateManifestValidity,
  forgeManifestCreatedEntry,
  REQUIRED_CAPABILITIES,
  RUNTIME_TOPOLOGY_STATEMENT,
  VALID_RULE,
  verifyReplicaManifest
} from "../src/verification/ManifestVerification";

test("forgeManifestCreatedEntry creates a MANIFEST_CREATED entry with SHA-256 and required capabilities", () => {
  const entry = forgeManifestCreatedEntry({
    id: "entry-0001",
    timestamp: 1747094400,
    verification: {
      hashMatch: true,
      signatureValid: true,
      manifestMatch: true,
      topologyConsistent: true
    }
  });

  assert.equal(entry.event, "MANIFEST_CREATED");
  assert.equal(entry.id, "entry-0001");
  assert.equal(entry.sha256.length, 64);
  assert.equal(entry.validRule, VALID_RULE);
  assert.equal(entry.runtime, RUNTIME_TOPOLOGY_STATEMENT);
  assert.deepEqual(entry.capabilities, REQUIRED_CAPABILITIES);
  assert.equal(entry.valid, true);
});

test("evaluateManifestValidity enforces HASH_MATCH AND SIGNATURE_VALID AND MANIFEST_MATCH AND TOPOLOGY_CONSISTENT", () => {
  assert.equal(
    evaluateManifestValidity({
      hashMatch: true,
      signatureValid: true,
      manifestMatch: true,
      topologyConsistent: true
    }),
    true
  );

  assert.equal(
    evaluateManifestValidity({
      hashMatch: true,
      signatureValid: true,
      manifestMatch: false,
      topologyConsistent: true
    }),
    false
  );
});

test("verifyReplicaManifest accepts a faithful replica and rejects drift", () => {
  const primary = forgeManifestCreatedEntry({
    id: "entry-0001",
    timestamp: 1747094400,
    verification: {
      hashMatch: true,
      signatureValid: true,
      manifestMatch: true,
      topologyConsistent: true
    }
  });

  const replica = forgeManifestCreatedEntry({
    id: "entry-0001",
    timestamp: 1747094400,
    verification: {
      hashMatch: true,
      signatureValid: true,
      manifestMatch: true,
      topologyConsistent: true
    }
  });

  assert.equal(verifyReplicaManifest(primary, replica), true);

  const driftedReplica = {
    ...replica,
    runtime: "runtime uses classical topology only"
  };
  assert.equal(verifyReplicaManifest(primary, driftedReplica as typeof replica), false);
});
