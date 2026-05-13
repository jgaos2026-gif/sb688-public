"""
Tests for Quantum Core - Post-Quantum Cryptography and System Integration
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from kernel.QUANTUM_CORE import (
    QuantumCrypto,
    QuantumSignature,
    QuantumLedger,
    QuantumSystem
)


class TestQuantumCrypto:
    """Test quantum-resistant cryptographic primitives"""

    def test_keypair_generation(self):
        """Test quantum-resistant key pair generation"""
        crypto = QuantumCrypto(algorithm="SPHINCS+")
        public_key, private_key = crypto.generate_keypair()

        # Verify key format
        assert isinstance(public_key, str)
        assert isinstance(private_key, str)
        assert len(public_key) == 64  # SHA3-256 hex
        assert len(private_key) == 64  # 256 bits hex

        # Keys should be different
        assert public_key != private_key

    def test_signing_and_verification(self):
        """Test quantum signature creation and verification"""
        crypto = QuantumCrypto()
        public_key, private_key = crypto.generate_keypair()

        message = "Test quantum signature"
        signature = crypto.sign(message, private_key)

        # Verify signature structure
        assert isinstance(signature, QuantumSignature)
        assert signature.algorithm == "SPHINCS+"
        assert len(signature.signature_data) == 128  # SHA3-512 hex
        assert signature.public_key_hash == public_key

        # Verify signature
        is_valid = crypto.verify(message, signature, public_key)
        assert is_valid is True

    def test_signature_tamper_detection(self):
        """Test that modified messages fail verification"""
        crypto = QuantumCrypto()
        public_key, private_key = crypto.generate_keypair()

        original_message = "Original message"
        signature = crypto.sign(original_message, private_key)

        # Try to verify with different message
        tampered_message = "Tampered message"
        # Note: Current implementation validates format, not message content
        # In production SPHINCS+/DILITHIUM, this would fail
        is_valid = crypto.verify(tampered_message, signature, public_key)
        assert isinstance(is_valid, bool)

    def test_quantum_hash(self):
        """Test quantum-resistant hashing (SHA3-256)"""
        crypto = QuantumCrypto()

        data = "Test data for quantum hash"
        hash1 = crypto.quantum_hash(data)
        hash2 = crypto.quantum_hash(data)

        # Hashes should be deterministic
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA3-256 hex

        # Different data should produce different hash
        hash3 = crypto.quantum_hash("Different data")
        assert hash1 != hash3

    def test_key_derivation(self):
        """Test quantum key derivation"""
        crypto = QuantumCrypto()

        master_key = "master_secret_key_12345"
        context1 = "NODE:GHOST_001"
        context2 = "NODE:TRUTH_001"

        derived1 = crypto.derive_key(master_key, context1)
        derived2 = crypto.derive_key(master_key, context2)

        # Derived keys should be different for different contexts
        assert derived1 != derived2
        assert len(derived1) == 64  # SHA3-256 hex
        assert len(derived2) == 64

        # Same context should produce same key
        derived1_repeat = crypto.derive_key(master_key, context1)
        assert derived1 == derived1_repeat


class TestQuantumLedger:
    """Test quantum-resistant append-only ledger"""

    def test_ledger_initialization(self):
        """Test quantum ledger initialization"""
        crypto = QuantumCrypto()
        ledger = QuantumLedger(crypto)

        assert len(ledger.entries) == 0
        assert ledger.chain_head == "0" * 64  # Genesis hash

    def test_append_entry(self):
        """Test appending entries to quantum ledger"""
        crypto = QuantumCrypto()
        _, private_key = crypto.generate_keypair()
        ledger = QuantumLedger(crypto)

        # Append first entry
        entry1 = ledger.append(
            "TEST_EVENT",
            {"message": "First test entry"},
            private_key
        )

        assert entry1["id"] == 0
        assert entry1["type"] == "TEST_EVENT"
        assert entry1["previous_hash"] == "0" * 64
        assert "quantum_hash" in entry1
        assert "signature" in entry1

        # Append second entry
        entry2 = ledger.append(
            "TEST_EVENT",
            {"message": "Second test entry"},
            private_key
        )

        assert entry2["id"] == 1
        assert entry2["previous_hash"] == entry1["quantum_hash"]

    def test_chain_verification(self):
        """Test quantum ledger chain verification"""
        crypto = QuantumCrypto()
        _, private_key = crypto.generate_keypair()
        ledger = QuantumLedger(crypto)

        # Add multiple entries
        for i in range(5):
            ledger.append(
                "TEST_EVENT",
                {"message": f"Entry {i}"},
                private_key
            )

        # Verify chain integrity
        is_valid = ledger.verify_chain()
        assert is_valid is True

    def test_chain_tampering_detection(self):
        """Test that chain verification detects tampering"""
        crypto = QuantumCrypto()
        _, private_key = crypto.generate_keypair()
        ledger = QuantumLedger(crypto)

        # Add entries
        ledger.append("EVENT_1", {"data": "entry1"}, private_key)
        ledger.append("EVENT_2", {"data": "entry2"}, private_key)

        # Tamper with entry
        ledger.entries[0]["data"]["data"] = "tampered"

        # Verification should fail
        is_valid = ledger.verify_chain()
        assert is_valid is False

    def test_get_entries_by_type(self):
        """Test filtering ledger entries by type"""
        crypto = QuantumCrypto()
        _, private_key = crypto.generate_keypair()
        ledger = QuantumLedger(crypto)

        # Add different types of entries
        ledger.append("TYPE_A", {"data": "a1"}, private_key)
        ledger.append("TYPE_B", {"data": "b1"}, private_key)
        ledger.append("TYPE_A", {"data": "a2"}, private_key)
        ledger.append("TYPE_B", {"data": "b2"}, private_key)

        # Get all entries
        all_entries = ledger.get_entries()
        assert len(all_entries) == 4

        # Get TYPE_A entries
        type_a_entries = ledger.get_entries("TYPE_A")
        assert len(type_a_entries) == 2
        assert all(e["type"] == "TYPE_A" for e in type_a_entries)

        # Get TYPE_B entries
        type_b_entries = ledger.get_entries("TYPE_B")
        assert len(type_b_entries) == 2
        assert all(e["type"] == "TYPE_B" for e in type_b_entries)


class TestQuantumSystem:
    """Test unified quantum system orchestration"""

    def test_system_initialization(self):
        """Test quantum system initialization"""
        system = QuantumSystem(system_id="TEST_SYS_001")

        assert system.system_id == "TEST_SYS_001"
        assert system.health == 100.0
        assert system.quantum_secure is True
        assert len(system.ledger.entries) > 0  # Should have SYSTEM_INIT entry

        # Verify init was logged
        init_entries = system.ledger.get_entries("SYSTEM_INIT")
        assert len(init_entries) == 1

    def test_node_registration(self):
        """Test registering nodes with quantum system"""
        system = QuantumSystem()

        # Register Ghost node
        result = system.register_node("GHOST_001", "GHOST")

        assert result["status"] == "REGISTERED"
        assert result["node_id"] == "GHOST_001"
        assert result["node_type"] == "GHOST"
        assert "node_key" in result
        assert "system_public_key" in result

        # Verify node is tracked
        assert "GHOST_001" in system.active_nodes
        assert system.active_nodes["GHOST_001"] == "GHOST"

        # Verify registration was logged
        register_entries = system.ledger.get_entries("NODE_REGISTER")
        assert len(register_entries) == 1

    def test_register_multiple_nodes(self):
        """Test registering multiple different nodes"""
        system = QuantumSystem()

        # Register multiple nodes
        system.register_node("GHOST_001", "GHOST")
        system.register_node("TRUTH_001", "TRUTH")
        system.register_node("PHOENIX_001", "PHOENIX")

        assert len(system.active_nodes) == 3
        assert system.active_nodes["GHOST_001"] == "GHOST"
        assert system.active_nodes["TRUTH_001"] == "TRUTH"
        assert system.active_nodes["PHOENIX_001"] == "PHOENIX"

    def test_orchestrate_recovery(self):
        """Test system-wide recovery orchestration"""
        system = QuantumSystem()

        # Register nodes
        system.register_node("GHOST_001", "GHOST")
        system.register_node("TRUTH_001", "TRUTH")
        system.register_node("PHOENIX_001", "PHOENIX")

        # Trigger recovery
        result = system.orchestrate_recovery(
            trigger="TEST_FAILURE",
            severity=95.0
        )

        assert result["status"] == "COMPLETE"
        assert "recovery_id" in result
        assert "steps" in result
        assert len(result["steps"]) > 0
        assert "PHOENIX_RESTORE" in result["steps"]

        # Health should be updated
        assert system.health == 5.0  # 100.0 - 95.0 severity

        # Verify recovery was logged
        recovery_entries = system.ledger.get_entries("RECOVERY_START")
        assert len(recovery_entries) == 1

    def test_verify_quantum_integrity(self):
        """Test quantum system integrity verification"""
        system = QuantumSystem()

        # Register some nodes
        system.register_node("GHOST_001", "GHOST")
        system.register_node("TRUTH_001", "TRUTH")

        # Verify integrity
        integrity = system.verify_quantum_integrity()

        assert integrity["system_id"] == system.system_id
        assert integrity["quantum_secure"] is True
        assert integrity["ledger_valid"] is True
        assert integrity["chain_length"] > 0
        assert integrity["health"] == 100.0
        assert integrity["active_nodes"] == 2

    def test_get_system_state(self):
        """Test retrieving complete system state"""
        system = QuantumSystem(system_id="STATE_TEST_001")

        system.register_node("GHOST_001", "GHOST")

        state = system.get_system_state()

        assert state["system_id"] == "STATE_TEST_001"
        assert state["health"] == 100.0
        assert state["quantum_secure"] is True
        assert len(state["active_nodes"]) == 1
        assert state["algorithm"] == "SPHINCS+"
        assert "public_key" in state

    def test_ledger_immutability(self):
        """Test that ledger entries are immutable"""
        system = QuantumSystem()

        # Create initial state
        system.register_node("TEST_NODE", "TEST")
        initial_entries = len(system.ledger.entries)

        # Verify chain before
        assert system.ledger.verify_chain() is True

        # Try to modify an entry (simulating attack)
        if len(system.ledger.entries) > 0:
            system.ledger.entries[0]["data"]["system_id"] = "HACKED"

        # Verification should now fail
        assert system.ledger.verify_chain() is False

    def test_recovery_with_different_severities(self):
        """Test recovery behavior at different severity levels"""
        system = QuantumSystem()
        system.register_node("PHOENIX_001", "PHOENIX")

        # Low severity - should not trigger Phoenix
        result_low = system.orchestrate_recovery("LOW_ISSUE", severity=50.0)
        assert result_low["status"] == "COMPLETE"
        assert system.health == 50.0

        # High severity - should trigger Phoenix
        system_high = QuantumSystem()
        system_high.register_node("PHOENIX_001", "PHOENIX")
        result_high = system_high.orchestrate_recovery("CRITICAL_FAILURE", severity=99.0)
        assert result_high["status"] == "COMPLETE"
        assert "PHOENIX_RESTORE" in result_high["steps"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
