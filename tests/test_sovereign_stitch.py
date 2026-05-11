# tests/test_sovereign_stitch.py — pytest suite for the Sovereign Stitch PC program
# -----------------------------------------------------------------------------------
# Run with:  pytest
# or:        pytest -v tests/test_sovereign_stitch.py

import copy
import pytest
from sovereign_stitch import (
    SeedBrick,
    GhostBrick,
    ArmorBrick,
    CrownBrick,
    SovereignStitch,
    OmegaSupervisor,
)


# ─────────────────────────────────────────────
# SeedBrick
# ─────────────────────────────────────────────

class TestSeedBrick:
    def _seed(self):
        return SeedBrick({"protocol": "SB689_OMEGA", "owner": "JGA"})

    def test_golden_returns_copy(self):
        seed = self._seed()
        g1 = seed.golden()
        g2 = seed.golden()
        assert g1 is not g2

    def test_golden_has_checksum(self):
        seed = self._seed()
        assert len(seed.golden()["checksum"]) == 64  # SHA-256 hex

    def test_self_check_passes(self):
        seed = self._seed()
        assert seed.self_check() is True

    def test_verify_matching_state(self):
        state = {"protocol": "SB689_OMEGA", "owner": "JGA"}
        seed = SeedBrick(state)
        assert seed.verify(state) is True

    def test_verify_tampered_state(self):
        state = {"protocol": "SB689_OMEGA", "owner": "JGA"}
        seed = SeedBrick(state)
        tampered = dict(state, protocol="EVIL")
        assert seed.verify(tampered) is False


# ─────────────────────────────────────────────
# GhostBrick
# ─────────────────────────────────────────────

class TestGhostBrick:
    def test_latest_none_before_mirror(self):
        ghost = GhostBrick()
        assert ghost.latest() is None

    def test_mirror_returns_frame(self):
        ghost = GhostBrick()
        frame = ghost.mirror({"k": "v"})
        assert frame.cycle == 1
        assert len(frame.mirror_hash) == 64

    def test_ring_buffer_capped(self):
        ghost = GhostBrick(max_frames=3)
        for i in range(5):
            ghost.mirror({"i": i})
        assert len(ghost.history()) == 3

    def test_pointer_flip_raises_before_mirror(self):
        ghost = GhostBrick()
        with pytest.raises(RuntimeError, match="before any mirror cycle"):
            ghost.pointer_flip()

    def test_pointer_flip_returns_latest(self):
        ghost = GhostBrick()
        ghost.mirror({"a": 1})
        f = ghost.mirror({"b": 2})
        assert ghost.pointer_flip() is f


# ─────────────────────────────────────────────
# ArmorBrick
# ─────────────────────────────────────────────

class TestArmorBrick:
    def _seed_checksum(self, state):
        return SeedBrick(state).golden()["checksum"]

    def test_no_drift_stable(self):
        state = {"x": 1}
        armor = ArmorBrick()
        report = armor.measure(
            seed_checksum=self._seed_checksum(state),
            live_state=state,
            pulse_alive=True,
        )
        assert report.drift == 0.0
        assert report.breach is False

    def test_drift_triggers_breach(self):
        armor = ArmorBrick()
        report = armor.measure(
            seed_checksum=self._seed_checksum({"x": 1}),
            live_state={"x": 999},
            pulse_alive=True,
        )
        assert report.drift == 1.0
        assert report.breach is True

    def test_dead_pulse_triggers_breach(self):
        state = {"x": 1}
        armor = ArmorBrick()
        report = armor.measure(
            seed_checksum=self._seed_checksum(state),
            live_state=state,
            pulse_alive=False,
        )
        assert report.breach is True
        assert report.pulse_alive is False

    def test_should_resurrect_on_breach(self):
        armor = ArmorBrick()
        report = armor.measure(
            seed_checksum=self._seed_checksum({"x": 1}),
            live_state={"x": 2},
            pulse_alive=True,
        )
        assert armor.should_resurrect(report) is True

    def test_no_resurrect_when_stable(self):
        state = {"x": 1}
        armor = ArmorBrick()
        report = armor.measure(
            seed_checksum=self._seed_checksum(state),
            live_state=state,
            pulse_alive=True,
        )
        assert armor.should_resurrect(report) is False


# ─────────────────────────────────────────────
# CrownBrick
# ─────────────────────────────────────────────

class TestCrownBrick:
    def test_initial_state_green(self):
        crown = CrownBrick()
        assert crown.state().color == "GREEN"

    def test_green_signal(self):
        crown = CrownBrick()
        sig = crown.green("All good.")
        assert sig.color == "GREEN"
        assert sig.message == "All good."

    def test_gold_signal(self):
        crown = CrownBrick()
        sig = crown.gold("Resurrection active.")
        assert sig.color == "GOLD"

    def test_red_signal(self):
        crown = CrownBrick()
        sig = crown.red("Breach!")
        assert sig.color == "RED"

    def test_trail_grows(self):
        crown = CrownBrick()
        crown.green("a")
        crown.gold("b")
        assert len(crown.trail()) == 3  # init + 2 signals

    def test_theme_constant(self):
        crown = CrownBrick()
        assert crown.state().theme == "BLACK_GOLD_PATTERN_5PT_CROWN"


# ─────────────────────────────────────────────
# SovereignStitch
# ─────────────────────────────────────────────

class TestSovereignStitch:
    def _make_stitch(self):
        seed = SeedBrick({"protocol": "SB689_OMEGA", "owner": "JGA"})
        ghost = GhostBrick()
        armor = ArmorBrick()
        crown = CrownBrick()
        return SovereignStitch(seed, ghost, armor, crown), seed

    def test_verify_passes_on_fresh_stitch(self):
        stitch, _ = self._make_stitch()
        assert stitch.verify() is True

    def test_three_bindings(self):
        stitch, _ = self._make_stitch()
        assert len(stitch.current().bindings) == 3

    def test_binding_order(self):
        stitch, _ = self._make_stitch()
        bricks = [(b.from_brick, b.to_brick) for b in stitch.current().bindings]
        assert bricks[0] == ("BRICK_A_SEED", "BRICK_B_GHOST")
        assert bricks[1] == ("BRICK_B_GHOST", "BRICK_C_ARMOR")
        assert bricks[2] == ("BRICK_C_ARMOR", "BRICK_D_CROWN")

    def test_connect_returns_ready_message(self):
        stitch, _ = self._make_stitch()
        result = stitch.connect()
        assert "connect to the stitch" in result["message"].lower()
        assert len(result["signature"]) == 64

    def test_ready_message_constant(self):
        assert "going live" in SovereignStitch.READY_MESSAGE


# ─────────────────────────────────────────────
# OmegaSupervisor — stable cycle
# ─────────────────────────────────────────────

class TestOmegaSupervisorStable:
    SEED_STATE = {"protocol": "SB689_OMEGA", "owner": "JGA", "version": "1.0.0"}

    def _sup(self):
        return OmegaSupervisor(seed_state=self.SEED_STATE)

    def test_boot_status_ready(self):
        sup = self._sup()
        result = sup.tick(live_state=dict(self.SEED_STATE), pulse_alive=True)
        assert result["status"] == "SB689_READY"

    def test_stable_cycles_increment(self):
        sup = self._sup()
        for _ in range(5):
            sup.tick(live_state=dict(self.SEED_STATE), pulse_alive=True)
        assert sup._cycle == 5

    def test_no_resurrections_when_stable(self):
        sup = self._sup()
        for _ in range(3):
            sup.tick(live_state=dict(self.SEED_STATE), pulse_alive=True)
        assert len(sup.resurrection_log()) == 0

    def test_audit_log_grows(self):
        sup = self._sup()
        before = len(sup.audit_log())
        sup.tick(live_state=dict(self.SEED_STATE), pulse_alive=True)
        assert len(sup.audit_log()) > before

    def test_connect_handshake(self):
        sup = self._sup()
        h = sup.connect_to_stitch()
        assert "message" in h
        assert "signature" in h

    def test_crown_green_when_stable(self):
        sup = self._sup()
        result = sup.tick(live_state=dict(self.SEED_STATE), pulse_alive=True)
        assert result["crown"]["color"] == "GREEN"


# ─────────────────────────────────────────────
# OmegaSupervisor — fault injection
# ─────────────────────────────────────────────

class TestOmegaSupervisorFaults:
    SEED_STATE = {"protocol": "SB689_OMEGA", "owner": "JGA", "version": "1.0.0"}

    def _sup(self):
        return OmegaSupervisor(seed_state=self.SEED_STATE)

    def test_drift_triggers_resurrection(self):
        sup = self._sup()
        tampered = dict(self.SEED_STATE, protocol="EVIL")
        result = sup.tick(live_state=tampered, pulse_alive=True)
        assert result["status"] == "SB689_RESURRECTING"
        assert len(sup.resurrection_log()) == 1

    def test_dead_pulse_triggers_resurrection(self):
        sup = self._sup()
        result = sup.tick(live_state=dict(self.SEED_STATE), pulse_alive=False)
        assert result["status"] == "SB689_RESURRECTING"

    def test_crown_gold_on_resurrection(self):
        sup = self._sup()
        tampered = dict(self.SEED_STATE, protocol="EVIL")
        result = sup.tick(live_state=tampered, pulse_alive=True)
        assert result["crown"]["color"] == "GOLD"

    def test_resurrection_event_fields(self):
        sup = self._sup()
        tampered = dict(self.SEED_STATE, owner="TAMPERED")
        sup.tick(live_state=tampered, pulse_alive=True)
        event = sup.resurrection_log()[0]
        assert event.from_brick == "BRICK_C_ARMOR"
        assert event.to_brick == "BRICK_B_GHOST"
        assert event.elapsed_ms >= 0

    def test_recover_after_resurrection(self):
        sup = self._sup()
        # Inject fault then recover
        tampered = dict(self.SEED_STATE, protocol="EVIL")
        sup.tick(live_state=tampered, pulse_alive=True)
        result = sup.tick(live_state=dict(self.SEED_STATE), pulse_alive=True)
        assert result["status"] == "SB689_READY"

    def test_multiple_resurrections_logged(self):
        sup = self._sup()
        tampered = dict(self.SEED_STATE, protocol="EVIL")
        for _ in range(3):
            sup.tick(live_state=tampered, pulse_alive=True)
        assert len(sup.resurrection_log()) == 3
