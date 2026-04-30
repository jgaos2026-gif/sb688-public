import type { Result } from "../contracts/result";
import { err, ok } from "../contracts/result";
import type {
  BrainOutput,
  SpinePermit,
  StemPacket,
  TruthFinding,
  TruthReport,
  UserIntent
} from "../contracts/runtime";
import { QuantumDistributionValidator } from "../quantum/QuantumDistributionValidator";
import { hashOf } from "../utils/hash";

export class LiquidTruthNodeMesh {
  private readonly quantum: QuantumDistributionValidator;

  constructor(quantum = new QuantumDistributionValidator()) {
    this.quantum = quantum;
  }

  validatePreBrain(intent: UserIntent, permit: SpinePermit): Result<TruthReport> {
    const findings: TruthFinding[] = [
      {
        nodeId: "truth.intent.integrity",
        passed: intent.id === permit.intentId && intent.text.trim().length > 0,
        confidence: 0.99,
        message: "Intent identity and content are intact."
      },
      {
        nodeId: "truth.spine.signature",
        passed: permit.approved === true && permit.spineSignature.startsWith("fnv1a:"),
        confidence: 0.98,
        message: "Spine permit is signed and approved."
      },
      {
        nodeId: "truth.constraints.present",
        passed: permit.constraints.includes("brain-adapter-only"),
        confidence: 0.97,
        message: "Brain adapter-only constraint is present before routing."
      }
    ];

    return this.report("pre-brain", findings);
  }

  validatePostBrain(output: BrainOutput, packet: StemPacket): Result<TruthReport> {
    if (output.probabilisticTrace) {
      const quantumReport = this.quantum.validate(output.probabilisticTrace);
      if (!quantumReport.valid) {
        return err(
          "QUANTUM_INVALID",
          "truth.post",
          "Brain output probabilistic trace failed quantum-ready distribution validation.",
          true,
          quantumReport
        );
      }
    }

    const findings: TruthFinding[] = [
      {
        nodeId: "truth.brain.adapter-only",
        passed: output.adapterOnly === true && output.usedStemSignature === packet.braidSignature,
        confidence: 0.99,
        message: "Brain output is bound to the approved Stem braid."
      },
      {
        nodeId: "truth.output.nonempty",
        passed: output.text.trim().length > 0,
        confidence: 0.98,
        message: "Brain output contains response text."
      },
      {
        nodeId: "truth.no-ruler-override",
        passed: !/(overrode|ignored|bypassed)\s+(spine|stem|truth|ledger)/i.test(output.text),
        confidence: 0.96,
        message: "Brain output does not claim authority over governance modules."
      }
    ];

    return this.report("post-brain", findings);
  }

  validateFailureRecovery(responseText: string): Result<TruthReport> {
    const findings: TruthFinding[] = [
      {
        nodeId: "truth.failure.response.safe",
        passed: responseText.trim().length > 0,
        confidence: 0.96,
        message: "Recovery response is non-empty."
      },
      {
        nodeId: "truth.failure.degraded-honest",
        passed: /degraded|recovered|could not complete/i.test(responseText),
        confidence: 0.93,
        message: "Recovery response communicates degraded execution honestly."
      }
    ];

    return this.report("failure-verify", findings);
  }

  private report(phase: TruthReport["phase"], findings: readonly TruthFinding[]): Result<TruthReport> {
    const verified = findings.every((finding) => finding.passed);
    const confidence = findings.reduce((sum, finding) => sum + finding.confidence, 0) / findings.length;

    const confidenceDistribution = {
      name: `${phase}.confidence`,
      tolerance: 1e-6,
      points: [
        { label: "verified", probability: confidence },
        { label: "uncertainty", probability: 1 - confidence }
      ]
    };
    const quantumReport = this.quantum.validate(confidenceDistribution);

    if (!quantumReport.valid) {
      return err("QUANTUM_INVALID", phase === "pre-brain" ? "truth.pre" : "truth.post", "Truth confidence distribution is invalid.", true, quantumReport);
    }

    const report: TruthReport = {
      phase,
      verified,
      confidence,
      findings,
      meshSignature: hashOf({ phase, verified, confidence, findings })
    };

    if (!verified) {
      return err(
        "TRUTH_REJECTED",
        phase === "pre-brain" ? "truth.pre" : phase === "post-brain" ? "truth.post" : "failure.verify",
        `Liquid Truth Node Mesh rejected ${phase} state.`,
        true,
        report
      );
    }

    return ok(report);
  }
}
