"""
Sovereign OS — Android Kivy Application
========================================
A touch-compatible UI for the Brick Stitch Sovereign OS with integrated
sentinel self-awareness.  Runs natively on Android via Buildozer / python-for-android,
and also works as a desktop Kivy window for development/testing.

Layout
------
  [Header: OS name + threat badge]
  [Brick status row]
  [Sentinel & ledger summary]
  [Scrollable event log]
  [Fault injection buttons]
  [Action buttons: Run Tests / Heal All / Clear Log]
"""

# ---------------------------------------------------------------------------
# Guard: import Kivy before anything else so that environment variables for
# Android are picked up correctly.
# ---------------------------------------------------------------------------
import os
import sys

# Silence Kivy startup noise on Android; can be set to '2' for debugging.
os.environ.setdefault("KIVY_NO_ENV_CONFIG", "1")

from kivy.app import App
from kivy.clock import Clock
from kivy.core.window import Window
from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.widget import Widget

# ---------------------------------------------------------------------------
# Import core OS — works whether this file lives next to brick_stitch… or
# inside a packaged APK (python-for-android copies all .py files).
# ---------------------------------------------------------------------------
try:
    from brick_stitch_sovereign_os import SovereignOS
except ImportError as exc:  # pragma: no cover
    sys.exit(f"Cannot import SovereignOS: {exc}")

# ---------------------------------------------------------------------------
# Colour palette (dark-sovereign theme)
# ---------------------------------------------------------------------------
C_BG = (0.05, 0.05, 0.08, 1)
C_HEADER = (0.08, 0.08, 0.13, 1)
C_CARD = (0.10, 0.10, 0.16, 1)
C_ACCENT = (0.94, 0.77, 0.22, 1)       # gold
C_OK = (0.20, 0.75, 0.45, 1)           # green
C_WARN = (0.95, 0.60, 0.10, 1)         # amber
C_DANGER = (0.88, 0.22, 0.22, 1)       # red
C_TEXT = (0.92, 0.92, 0.92, 1)
C_DIM = (0.55, 0.55, 0.60, 1)
C_BTN_FAULT = (0.25, 0.10, 0.10, 1)
C_BTN_ACTION = (0.12, 0.18, 0.30, 1)

# Threat level → colour mapping
THREAT_COLOUR = {
    "nominal":  C_OK,
    "low":      C_OK,
    "moderate": C_WARN,
    "high":     C_DANGER,
    "critical": C_DANGER,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _label(text: str, size: float = 14, bold: bool = False,
           color: tuple = C_TEXT, halign: str = "left",
           size_hint_y: float = None) -> Label:
    lbl = Label(
        text=text,
        font_size=dp(size),
        bold=bold,
        color=color,
        halign=halign,
        valign="middle",
        size_hint_y=size_hint_y,
    )
    lbl.bind(size=lbl.setter("text_size"))
    return lbl


def _btn(text: str, bg: tuple = C_BTN_ACTION,
         on_press=None, height: float = 44) -> Button:
    b = Button(
        text=text,
        font_size=dp(13),
        size_hint_y=None,
        height=dp(height),
        background_normal="",
        background_color=bg,
        color=C_TEXT,
    )
    if on_press:
        b.bind(on_press=on_press)
    return b


# ---------------------------------------------------------------------------
# Main app widget
# ---------------------------------------------------------------------------
class SovereignAndroidUI(BoxLayout):
    """Root layout for the Sovereign OS Android interface."""

    def __init__(self, **kwargs):
        super().__init__(orientation="vertical", spacing=dp(4),
                         padding=dp(6), **kwargs)
        self.canvas.before.clear()
        with self.canvas.before:
            from kivy.graphics import Color, Rectangle
            Color(*C_BG)
            self._bg_rect = Rectangle(size=self.size, pos=self.pos)
        self.bind(size=self._update_bg, pos=self._update_bg)

        self._os = SovereignOS()
        self._log_lines: list = []

        self._build_header()
        self._build_brick_row()
        self._build_sentinel_row()
        self._build_log_area()
        self._build_fault_buttons()
        self._build_action_buttons()

        # Refresh display data every 2 seconds.
        Clock.schedule_interval(self._refresh, 2.0)

    # ---- background ----
    def _update_bg(self, *_):
        self._bg_rect.size = self.size
        self._bg_rect.pos = self.pos

    # ---- header ----
    def _build_header(self):
        hdr = BoxLayout(size_hint_y=None, height=dp(54),
                        spacing=dp(8), padding=(dp(4), dp(4)))
        with hdr.canvas.before:
            from kivy.graphics import Color, Rectangle
            Color(*C_HEADER)
            self._hdr_rect = Rectangle(size=hdr.size, pos=hdr.pos)
        hdr.bind(size=lambda w, v: setattr(self._hdr_rect, "size", v))
        hdr.bind(pos=lambda w, v: setattr(self._hdr_rect, "pos", v))

        title = _label("⚙ SOVEREIGN OS", size=18, bold=True,
                       color=C_ACCENT, halign="left")
        title.size_hint_x = 0.7

        self._threat_badge = _label("● NOMINAL", size=14, bold=True,
                                    color=C_OK, halign="right")
        self._threat_badge.size_hint_x = 0.3

        hdr.add_widget(title)
        hdr.add_widget(self._threat_badge)
        self.add_widget(hdr)

    # ---- brick status row ----
    def _build_brick_row(self):
        row = BoxLayout(size_hint_y=None, height=dp(36), spacing=dp(4))
        self._brick_labels: dict = {}
        for name in ["core", "driver_net", "fs", "user_app"]:
            lbl = _label(f"{name}\n✓", size=11, color=C_OK, halign="center")
            self._brick_labels[name] = lbl
            row.add_widget(lbl)
        self.add_widget(row)

    # ---- sentinel & ledger summary ----
    def _build_sentinel_row(self):
        row = BoxLayout(size_hint_y=None, height=dp(28), spacing=dp(8))
        self._sentinel_lbl = _label("Sentinel: nominal | Incidents: 0 | Ledger: v0",
                                    size=11, color=C_DIM, halign="left")
        row.add_widget(self._sentinel_lbl)
        self.add_widget(row)

    # ---- log area ----
    def _build_log_area(self):
        scroll = ScrollView(size_hint=(1, 1))
        self._log_layout = BoxLayout(orientation="vertical",
                                     size_hint_y=None, spacing=dp(2),
                                     padding=(dp(4), dp(4)))
        self._log_layout.bind(minimum_height=self._log_layout.setter("height"))
        scroll.add_widget(self._log_layout)
        self.add_widget(scroll)

    # ---- fault injection buttons ----
    def _build_fault_buttons(self):
        grid = GridLayout(cols=3, size_hint_y=None, spacing=dp(4))
        grid.bind(minimum_height=grid.setter("height"))

        faults = [
            ("Corrupt user_app", "user_app", "corrupt"),
            ("Crash driver_net", "driver_net", "driver_fault"),
            ("Crash fs", "fs", "runtime_crash"),
            ("Tamper Spine", None, "spine_tamper"),
            ("Storage Corrupt", "fs", "storage_corrupt"),
            ("Partial Update", "fs", "partial_update"),
            ("Dep Failure core", "core", "dependency_failure"),
            ("Heal Layer Fault", None, "heal_layer_fault"),
            ("Corrupt core", "core", "corrupt"),
        ]

        for label_text, brick, fault in faults:
            btn = _btn(label_text, bg=C_BTN_FAULT, height=40)
            btn.bind(on_press=lambda _, b=brick, f=fault: self._inject_fault(b, f))
            grid.add_widget(btn)

        self.add_widget(grid)

    # ---- action buttons ----
    def _build_action_buttons(self):
        row = BoxLayout(size_hint_y=None, height=dp(46), spacing=dp(6))
        row.add_widget(_btn("▶ Run Tests", bg=C_BTN_ACTION,
                            on_press=self._run_tests, height=46))
        row.add_widget(_btn("⚕ Heal All", bg=(0.10, 0.22, 0.14, 1),
                            on_press=self._heal_all, height=46))
        row.add_widget(_btn("✕ Clear Log", bg=(0.16, 0.16, 0.18, 1),
                            on_press=self._clear_log, height=46))
        self.add_widget(row)

    # ---- refresh display ----
    def _refresh(self, *_):
        # Update brick health labels.
        for name, lbl in self._brick_labels.items():
            brick = self._os.bricks.get(name)
            if brick:
                icon = "✓" if brick.healthy else "✗"
                colour = C_OK if brick.healthy else C_DANGER
                lbl.text = f"{name}\n{icon}"
                lbl.color = colour

        # Update sentinel & ledger summary.
        s = self._os.sentinel_status()
        threat = s.get("threat_level", "nominal")
        incidents = s.get("total_incidents", 0)
        ledger_v = self._os.spine.current_version
        self._sentinel_lbl.text = (
            f"Sentinel: {threat} | Incidents: {incidents} | Ledger: v{ledger_v}"
        )

        # Update threat badge.
        badge_colour = THREAT_COLOUR.get(threat, C_WARN)
        self._threat_badge.text = f"● {threat.upper()}"
        self._threat_badge.color = badge_colour

    # ---- event handlers ----
    def _inject_fault(self, brick: str, fault_type: str):
        ok = self._os.inject_fault(brick, fault_type)
        # Run sentinel watch after injection.
        watch = self._os.sentinel.watch()
        status = "injected" if ok else "rejected"
        self._log(
            f"[FAULT] {fault_type} on {brick or 'system'}: {status} "
            f"→ sentinel={watch['threat_level']}"
        )
        self._refresh()

    def _run_tests(self, *_):
        self._log("[TESTS] Starting 3-pass test suite …")

        def _run(_dt):
            passed = self._os.run_three_clean_passes()
            result = "ALL PASS ✓" if passed else "FAIL ✗"
            self._log(f"[TESTS] {result}")
            self._refresh()

        Clock.schedule_once(_run, 0.1)

    def _heal_all(self, *_):
        for name, brick in self._os.bricks.items():
            if not brick.healthy:
                brick.healthy = True
                brick.state.pop("corrupted", None)
                brick.state.pop("crash_flag", None)
        self._os.healing.online = True
        self._log("[HEAL] All bricks reset to healthy.")
        self._refresh()

    def _clear_log(self, *_):
        self._log_layout.clear_widgets()
        self._log_lines.clear()

    def _log(self, message: str):
        from kivy.graphics import Color, Rectangle
        self._log_lines.append(message)
        lbl = _label(message, size=11, color=C_TEXT, halign="left",
                     size_hint_y=None)
        lbl.height = dp(22)
        self._log_layout.add_widget(lbl)
        # Keep at most 120 lines to avoid unbounded memory growth.
        if len(self._log_lines) > 120:
            excess = len(self._log_lines) - 120
            self._log_lines = self._log_lines[excess:]
            while len(self._log_layout.children) > 120:
                self._log_layout.remove_widget(self._log_layout.children[-1])


# ---------------------------------------------------------------------------
# Kivy App entry point
# ---------------------------------------------------------------------------
class SovereignApp(App):
    def build(self):
        Window.clearcolor = C_BG
        self.title = "Sovereign OS"
        return SovereignAndroidUI()


if __name__ == "__main__":
    SovereignApp().run()
