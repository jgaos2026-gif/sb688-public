"""
BRICK_D_CROWN — Elegance UI Crown.

Theme:  BLACK_GOLD_PATTERN_5PT_CROWN
Mode:   Live_Sell / Connect_To_Stitch
Visual: GREEN = Stable | GOLD = Resurrection_Active | RED = Breach
"""

import time
from dataclasses import dataclass, field
from typing import List, Literal

CrownColor = Literal["GREEN", "GOLD", "RED"]
CrownMode = Literal["Live_Sell", "Connect_To_Stitch", "Idle"]


@dataclass(frozen=True)
class CrownSignal:
    color: CrownColor
    mode: CrownMode
    theme: str
    message: str
    at: float  # epoch timestamp


class CrownBrick:
    """BRICK_D_CROWN — Elegance UI Crown."""

    IDENT = "BRICK_D_CROWN"
    STATE = "LIVE_SELL"
    THEME = "BLACK_GOLD_PATTERN_5PT_CROWN"

    def __init__(self, mode: CrownMode = "Idle") -> None:
        init_signal = self._build("GREEN", mode, "Crown initialized — stable.")
        self._current: CrownSignal = init_signal
        self._history: List[CrownSignal] = [init_signal]

    def signal(self, color: CrownColor, mode: CrownMode, message: str) -> CrownSignal:
        sig = self._build(color, mode, message)
        self._current = sig
        self._history.append(sig)
        return sig

    def green(self, message: str = "Stable.", mode: CrownMode = "Live_Sell") -> CrownSignal:
        return self.signal("GREEN", mode, message)

    def gold(
        self,
        message: str = "Resurrection active — gold flash.",
        mode: CrownMode = "Connect_To_Stitch",
    ) -> CrownSignal:
        return self.signal("GOLD", mode, message)

    def red(self, message: str = "Breach detected.", mode: CrownMode = "Connect_To_Stitch") -> CrownSignal:
        return self.signal("RED", mode, message)

    def state(self) -> CrownSignal:
        return self._current

    def trail(self) -> List[CrownSignal]:
        return list(self._history)

    # ------------------------------------------------------------------
    def _build(self, color: CrownColor, mode: CrownMode, message: str) -> CrownSignal:
        return CrownSignal(color=color, mode=mode, theme=self.THEME, message=message, at=time.time())
