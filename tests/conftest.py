from __future__ import annotations

import pytest

from kernel.SB688_ENGINE import SB688Engine


@pytest.fixture
def engine() -> SB688Engine:
    return SB688Engine()
