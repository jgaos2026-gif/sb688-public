"""Tests for the file upload and self-upload capabilities in Sovereign OS."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from brick_stitch_sovereign_os import (
    DeterministicClock,
    Spine,
    Brick,
    SentinelLayer,
    FileUploadManager,
    SovereignOS,
    hash_blob,
)


def make_stack():
    clock = DeterministicClock()
    spine = Spine(clock)
    bricks = {
        "fs": Brick("fs", [], {"status": "mounted", "files": {}, "journal_clean": True}),
        "upload": Brick("upload", ["fs"], {"status": "ready"}),
    }
    sentinel = SentinelLayer(spine, clock)
    mgr = FileUploadManager(spine, bricks, sentinel, clock)
    return spine, bricks, sentinel, mgr


# ──────────────────────────────────────────────
# SentinelLayer tests
# ──────────────────────────────────────────────

def test_sentinel_accepts_valid_file():
    clock = DeterministicClock()
    spine = Spine(clock)
    sentinel = SentinelLayer(spine, clock)
    clean, anomalies = sentinel.scan("invoice.json", b'{"amount":100}', "application/json")
    assert clean is True, f"Expected clean=True, got anomalies={anomalies}"
    assert anomalies == []


def test_sentinel_rejects_empty_content():
    clock = DeterministicClock()
    spine = Spine(clock)
    sentinel = SentinelLayer(spine, clock)
    clean, anomalies = sentinel.scan("empty.txt", b"", "text/plain")
    assert clean is False
    assert "empty_content" in anomalies


def test_sentinel_rejects_suspicious_filename():
    clock = DeterministicClock()
    spine = Spine(clock)
    sentinel = SentinelLayer(spine, clock)
    clean, anomalies = sentinel.scan("../../etc/passwd", b"data", "text/plain")
    assert clean is False
    assert "suspicious_filename" in anomalies


def test_sentinel_rejects_unsupported_content_type():
    clock = DeterministicClock()
    spine = Spine(clock)
    sentinel = SentinelLayer(spine, clock)
    clean, anomalies = sentinel.scan("file.exe", b"binary", "application/x-msdownload")
    assert clean is False
    assert any(a.startswith("unsupported_content_type") for a in anomalies)


def test_sentinel_detects_duplicate_content():
    clock = DeterministicClock()
    spine = Spine(clock)
    sentinel = SentinelLayer(spine, clock)
    sentinel.scan("a.txt", b"same-content", "text/plain")
    clean, anomalies = sentinel.scan("b.txt", b"same-content", "text/plain")
    assert clean is False
    assert "duplicate_content_hash" in anomalies


# ──────────────────────────────────────────────
# FileUploadManager — receive tests
# ──────────────────────────────────────────────

def test_receive_valid_upload():
    spine, bricks, sentinel, mgr = make_stack()
    ok, result = mgr.receive("report.txt", b"Q1 financial report", "text/plain")
    assert ok is True
    assert result["status"] == "accepted"
    assert result["filename"] == "report.txt"
    assert "hash" in result
    # File should appear in the fs brick
    assert "report.txt" in bricks["fs"].state["files"]


def test_receive_rejected_by_sentinel():
    spine, bricks, sentinel, mgr = make_stack()
    ok, result = mgr.receive("../traversal.txt", b"bad", "text/plain")
    assert ok is False
    assert result["status"] == "rejected"
    assert "suspicious_filename" in result["anomalies"]


def test_receive_fails_when_fs_brick_unhealthy():
    spine, bricks, sentinel, mgr = make_stack()
    bricks["fs"].healthy = False
    ok, result = mgr.receive("file.txt", b"data", "text/plain")
    assert ok is False
    assert result["status"] == "failed"
    assert result["reason"] == "fs_brick_unavailable"


# ──────────────────────────────────────────────
# FileUploadManager — dispatch tests
# ──────────────────────────────────────────────

def test_dispatch_stored_file():
    spine, bricks, sentinel, mgr = make_stack()
    mgr.receive("invoice.pdf", b"invoice-bytes", "application/pdf")
    ok, result = mgr.dispatch("invoice.pdf", "invoices")
    assert ok is True
    assert result["status"] == "dispatched"
    assert result["destination"] == "invoices"


def test_dispatch_unknown_file():
    spine, bricks, sentinel, mgr = make_stack()
    ok, result = mgr.dispatch("missing.txt", "archive")
    assert ok is False
    assert result["reason"] == "file_not_found"


def test_dispatch_invalid_destination():
    spine, bricks, sentinel, mgr = make_stack()
    mgr.receive("state.json", b'{"v":1}', "application/json")
    ok, result = mgr.dispatch("state.json", "../etc/secrets")
    assert ok is False
    assert result["reason"] == "invalid_destination"


# ──────────────────────────────────────────────
# Tamper-evident upload log (Spine)
# ──────────────────────────────────────────────

def test_upload_log_is_tamper_evident():
    spine, bricks, sentinel, mgr = make_stack()
    mgr.receive("a.txt", b"hello", "text/plain")
    mgr.dispatch("a.txt", "archive")
    assert spine.verify_upload_log() is True
    assert len(spine.upload_log) == 2


def test_upload_log_detects_tampering():
    spine, bricks, sentinel, mgr = make_stack()
    mgr.receive("b.txt", b"world", "text/plain")
    # Tamper with the log entry
    spine.upload_log[0]["status"] = "accepted_TAMPERED"
    assert spine.verify_upload_log() is False


# ──────────────────────────────────────────────
# SovereignOS integration
# ──────────────────────────────────────────────

def test_sovereign_os_has_upload_brick():
    os_instance = SovereignOS()
    assert "upload" in os_instance.bricks


def test_sovereign_os_upload_manager_exists():
    os_instance = SovereignOS()
    assert os_instance.upload_manager is not None
    assert os_instance.sentinel is not None


def test_sovereign_os_receive_and_dispatch():
    os_instance = SovereignOS()
    os_instance.operations.boot()
    ok, result = os_instance.upload_manager.receive(
        "state_backup.json", b'{"version":1}', "application/json"
    )
    assert ok is True, f"Expected accept, got {result}"
    ok2, result2 = os_instance.upload_manager.dispatch("state_backup.json", "state-backup")
    assert ok2 is True, f"Expected dispatch, got {result2}"
    assert os_instance.spine.verify_upload_log() is True


def test_sovereign_os_existing_tests_still_pass():
    """Regression guard: the original 7-scenario test suite must still pass."""
    fresh = SovereignOS()
    passed = fresh.run_all_tests_once(verbose=False)
    assert passed is True, "Original OS test suite failed after upload integration"


if __name__ == "__main__":
    tests = [
        test_sentinel_accepts_valid_file,
        test_sentinel_rejects_empty_content,
        test_sentinel_rejects_suspicious_filename,
        test_sentinel_rejects_unsupported_content_type,
        test_sentinel_detects_duplicate_content,
        test_receive_valid_upload,
        test_receive_rejected_by_sentinel,
        test_receive_fails_when_fs_brick_unhealthy,
        test_dispatch_stored_file,
        test_dispatch_unknown_file,
        test_dispatch_invalid_destination,
        test_upload_log_is_tamper_evident,
        test_upload_log_detects_tampering,
        test_sovereign_os_has_upload_brick,
        test_sovereign_os_upload_manager_exists,
        test_sovereign_os_receive_and_dispatch,
        test_sovereign_os_existing_tests_still_pass,
    ]

    passed = 0
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"  PASS  {fn.__name__}")
            passed += 1
        except Exception as exc:
            print(f"  FAIL  {fn.__name__}: {exc}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed")
    if failed:
        sys.exit(1)
