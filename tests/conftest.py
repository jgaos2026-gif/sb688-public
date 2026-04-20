from __future__ import annotations

import os

import pytest

from kernel.SB688_ENGINE import SB688Engine

TEST_ACCESS_CODE = os.environ.get("SB688_SENSITIVE_ACCESS_CODE", "test-only-code")


@pytest.fixture(autouse=True)
def _set_test_access_code(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure the engine uses the test access code for all tests."""
    monkeypatch.setenv("SB688_SENSITIVE_ACCESS_CODE", TEST_ACCESS_CODE)


@pytest.fixture
def engine() -> SB688Engine:
    return SB688Engine()
