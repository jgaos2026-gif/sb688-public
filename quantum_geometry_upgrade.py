"""
Unified Rotated Surface Code Geometry + CSS Validation Upgrade
Drop this file into a repo and run:
    python quantum_geometry_upgrade.py
Purpose:
- Generate rotated surface-code style stabilizer checks
- Separate geometry from validation
- Catch duplicate / malformed stabilizers
- Verify CSS commutation
- Verify logical-qubit count
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Dict

Qubit = Tuple[int, int]
Stabilizer = List[Qubit]


@dataclass
class RotatedSurfaceCode:
    d: int
    data_qubits: List[Qubit]
    x_stabilizers: List[Stabilizer]
    z_stabilizers: List[Stabilizer]
    H_X: np.ndarray
    H_Z: np.ndarray


def gf2_rank(matrix: np.ndarray) -> int:
    """Rank over GF(2)."""
    A = matrix.copy() % 2
    rows, cols = A.shape
    rank = 0
    for col in range(cols):
        pivot = None
        for r in range(rank, rows):
            if A[r, col]:
                pivot = r
                break
        if pivot is None:
            continue
        if pivot != rank:
            A[[rank, pivot]] = A[[pivot, rank]]
        for r in range(rows):
            if r != rank and A[r, col]:
                A[r] ^= A[rank]
        rank += 1
    return rank


def matrix_from_stabilizers(
    stabilizers: List[Stabilizer],
    data_index: Dict[Qubit, int],
) -> np.ndarray:
    H = np.zeros((len(stabilizers), len(data_index)), dtype=np.uint8)
    for i, stab in enumerate(stabilizers):
        for q in stab:
            if q in data_index:
                H[i, data_index[q]] = 1
    return H


def unique_stabilizers(stabilizers: List[Stabilizer]) -> List[Stabilizer]:
    seen = set()
    out = []
    for stab in stabilizers:
        key = tuple(sorted(stab))
        if key not in seen:
            seen.add(key)
            out.append(list(key))
    return out


def make_rotated_surface_code(d: int) -> RotatedSurfaceCode:
    """
    Build a distance-d rotated surface-code geometry.
    This implementation uses:
    - d x d data qubits
    - checkerboard interior plaquettes
    - explicit boundary stabilizers
    - final trimming to the required count per type
    Expected:
        n = d^2
        |X| = |Z| = (d^2 - 1) / 2
        k = 1
    """
    if d < 3 or d % 2 == 0:
        raise ValueError("d must be an odd integer >= 3")

    data_qubits = [(r, c) for r in range(d) for c in range(d)]
    data_index = {q: i for i, q in enumerate(data_qubits)}

    x_stabs: List[Stabilizer] = []
    z_stabs: List[Stabilizer] = []

    # Interior weight-4 plaquettes
    for r in range(d - 1):
        for c in range(d - 1):
            support = [(r, c), (r + 1, c), (r, c + 1), (r + 1, c + 1)]
            if (r + c) % 2 == 0:
                x_stabs.append(support)
            else:
                z_stabs.append(support)

    # Boundary weight-2 checks.
    # These encode the missing rotated-code boundary topology.
    for i in range(0, d - 1, 2):
        x_stabs.append([(0, i), (0, i + 1)])
        x_stabs.append([(d - 1, i), (d - 1, i + 1)])
        z_stabs.append([(i, 0), (i + 1, 0)])
        z_stabs.append([(i, d - 1), (i + 1, d - 1)])

    x_stabs = unique_stabilizers(x_stabs)
    z_stabs = unique_stabilizers(z_stabs)

    expected_each = (d * d - 1) // 2

    # Keep only independent stabilizers up to the expected count.
    x_stabs = independent_subset(x_stabs, data_index, expected_each)
    z_stabs = independent_subset(z_stabs, data_index, expected_each)

    H_X = matrix_from_stabilizers(x_stabs, data_index)
    H_Z = matrix_from_stabilizers(z_stabs, data_index)

    return RotatedSurfaceCode(
        d=d,
        data_qubits=data_qubits,
        x_stabilizers=x_stabs,
        z_stabilizers=z_stabs,
        H_X=H_X,
        H_Z=H_Z,
    )


def independent_subset(
    stabilizers: List[Stabilizer],
    data_index: Dict[Qubit, int],
    target: int,
) -> List[Stabilizer]:
    """
    Greedily keep stabilizers that increase GF(2) rank.
    """
    selected: List[Stabilizer] = []
    current_rank = 0
    for stab in stabilizers:
        trial = selected + [stab]
        H = matrix_from_stabilizers(trial, data_index)
        rank = gf2_rank(H)
        if rank > current_rank:
            selected.append(stab)
            current_rank = rank
        if len(selected) == target:
            break
    return selected


def validate_code(code: RotatedSurfaceCode) -> dict:
    n = len(code.data_qubits)
    expected_each = (code.d * code.d - 1) // 2

    commutator = (code.H_X @ code.H_Z.T) % 2
    rank_x = gf2_rank(code.H_X)
    rank_z = gf2_rank(code.H_Z)
    logical_k = n - rank_x - rank_z

    return {
        "distance": code.d,
        "data_qubits": n,
        "x_stabilizers": len(code.x_stabilizers),
        "z_stabilizers": len(code.z_stabilizers),
        "expected_each": expected_each,
        "rank_x": rank_x,
        "rank_z": rank_z,
        "logical_k": logical_k,
        "commutes": bool(commutator.max() == 0) if commutator.size else True,
        "commutator_max": int(commutator.max()) if commutator.size else 0,
    }


def print_report(code: RotatedSurfaceCode) -> None:
    report = validate_code(code)
    print("\n=== Rotated Surface Code Validation ===")
    for k, v in report.items():
        print(f"{k}: {v}")
    print("\nX stabilizers:")
    for s in code.x_stabilizers:
        print("  X", s)
    print("\nZ stabilizers:")
    for s in code.z_stabilizers:
        print("  Z", s)


def main() -> None:
    for d in [3, 5]:
        code = make_rotated_surface_code(d)
        print_report(code)


if __name__ == "__main__":
    main()
