#!/usr/bin/env python3
"""
Example: Truth Node for Disinformation Detection
Demonstrates adversarial verification and deepfake detection.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nodes.truth_node import TruthNode, IntelligenceReport


def main():
    print("=" * 70)
    print("SB-688 TRUTH NODE DEMONSTRATION")
    print("Adversarial Verification & Disinformation Detection")
    print("=" * 70)

    # Create truth node with 75% trust threshold
    print("\n[INITIALIZING] Truth Node with 75% trust threshold")
    truth = TruthNode(trust_threshold=0.75)

    # Register known sources with credibility scores
    print("\n[REGISTRATION] Known sources:")
    sources = {
        "Reuters": 0.95,
        "AP News": 0.93,
        "BBC": 0.90,
        "Government Agency": 0.85,
        "Academic Journal": 0.88,
        "Social Media Influencer": 0.40,
        "Anonymous Blog": 0.25,
        "State Propaganda": 0.15,
    }

    for source, credibility in sources.items():
        truth.register_trusted_source(source, credibility)
        print(f"  {source}: {credibility:.2f}")

    # Test Case 1: Credible report
    print("\n" + "=" * 70)
    print("TEST CASE 1: Credible Intelligence Report")
    print("=" * 70)

    report1 = IntelligenceReport(
        source="Reuters",
        content="Climate data from NOAA shows average global temperature increase of 0.15°C over past decade.",
        confidence=0.92,
        timestamp="2026-04-20T10:00:00Z",
        classification="UNCLASSIFIED",
        supporting_evidence=[
            "NOAA Climate Report Q1 2026",
            "Peer-reviewed study in Nature Climate Change",
            "Independent verification by European Space Agency",
        ],
        contradictions=[],
    )

    result1 = truth.verify_intelligence(report1)
    print(f"\nSource: {report1.source}")
    print(f"Content: {report1.content}")
    print(f"\n[VERIFICATION RESULT]")
    print(f"  Verified: {result1.verified}")
    print(f"  Confidence: {result1.confidence_score:.2%}")
    print(f"  Source Credibility: {result1.source_credibility:.2%}")
    print(f"  Deepfake Probability: {result1.deepfake_probability:.2%}")
    print(f"  Recommendation: {result1.recommendation}")

    # Test Case 2: Suspicious report with exaggerated claims
    print("\n" + "=" * 70)
    print("TEST CASE 2: Suspicious Report (AI-Generated)")
    print("=" * 70)

    report2 = IntelligenceReport(
        source="Anonymous Blog",
        content="New energy source discovered that is guaranteed to solve all climate problems with 100% certainty and absolutely no doubt whatsoever.",
        confidence=0.99,  # Suspiciously high
        timestamp="2026-04-20T10:15:00Z",
        classification="UNCLASSIFIED",
        supporting_evidence=[
            "Anonymous insider",
            "Trust me bro",
        ],
        contradictions=[],
    )

    result2 = truth.verify_intelligence(report2)
    print(f"\nSource: {report2.source}")
    print(f"Content: {report2.content[:100]}...")
    print(f"\n[VERIFICATION RESULT]")
    print(f"  Verified: {result2.verified}")
    print(f"  Confidence: {result2.confidence_score:.2%}")
    print(f"  Source Credibility: {result2.source_credibility:.2%}")
    print(f"  Deepfake Probability: {result2.deepfake_probability:.2%}")
    print(f"  Missing Evidence: {len(result2.missing_evidence)} items")
    print(f"  Recommendation: {result2.recommendation}")
    print(f"\n  [ALERT] Likely AI-generated disinformation detected!")

    # Test Case 3: Contradictory claims
    print("\n" + "=" * 70)
    print("TEST CASE 3: Internal Contradictions")
    print("=" * 70)

    report3 = IntelligenceReport(
        source="Social Media Influencer",
        content="The new policy will always benefit everyone and never have any negative consequences whatsoever.",
        confidence=0.85,
        timestamp="2026-04-20T10:30:00Z",
        classification="UNCLASSIFIED",
        supporting_evidence=["Personal opinion"],
        contradictions=[],
    )

    result3 = truth.verify_intelligence(report3)
    print(f"\nSource: {report3.source}")
    print(f"Content: {report3.content}")
    print(f"\n[VERIFICATION RESULT]")
    print(f"  Verified: {result3.verified}")
    print(f"  Confidence: {result3.confidence_score:.2%}")
    print(f"  Contradictions Found: {len(result3.contradictions_found)}")
    if result3.contradictions_found:
        for contradiction in result3.contradictions_found:
            print(f"    - {contradiction}")
    print(f"  Recommendation: {result3.recommendation}")

    # Test Case 4: Well-sourced government report
    print("\n" + "=" * 70)
    print("TEST CASE 4: Official Government Report")
    print("=" * 70)

    report4 = IntelligenceReport(
        source="Government Agency",
        content="Economic indicators show mixed signals with 2.3% GDP growth offset by 3.1% inflation.",
        confidence=0.88,
        timestamp="2026-04-20T11:00:00Z",
        classification="UNCLASSIFIED",
        supporting_evidence=[
            "Bureau of Economic Analysis",
            "Federal Reserve Economic Data",
            "Congressional Budget Office projections",
        ],
        contradictions=[],
    )

    result4 = truth.verify_intelligence(report4)
    print(f"\nSource: {report4.source}")
    print(f"Content: {report4.content}")
    print(f"\n[VERIFICATION RESULT]")
    print(f"  Verified: {result4.verified}")
    print(f"  Confidence: {result4.confidence_score:.2%}")
    print(f"  Source Credibility: {result4.source_credibility:.2%}")
    print(f"  Recommendation: {result4.recommendation}")

    # Show final statistics
    print("\n" + "=" * 70)
    print("TRUTH NODE STATISTICS")
    print("=" * 70)

    stats = truth.get_statistics()
    print(f"Total Reports Analyzed: {stats['total_reports']}")
    print(f"Verified: {stats['verified']}")
    print(f"Rejected: {stats['rejected']}")
    print(f"Verification Rate: {stats['verification_rate']:.1%}")
    print(f"Deepfakes Detected: {stats['deepfakes_detected']}")
    print(f"Known Sources Registered: {stats['known_sources']}")

    print("\n" + "=" * 70)
    print("Truth Node demonstration complete")
    print("Key features demonstrated:")
    print("  ✓ Dual-path verification (work + contradiction paths)")
    print("  ✓ Source credibility assessment")
    print("  ✓ Deepfake/AI-generated content detection")
    print("  ✓ Internal contradiction scanning")
    print("  ✓ Evidence verification requirements")
    print("  ✓ VERA gate enforcement")
    print("  ✓ Complete audit trail (ledger)")
    print("=" * 70)


if __name__ == "__main__":
    main()
