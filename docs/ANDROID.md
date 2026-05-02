# Android Setup — Sovereign OS

This guide explains how to build and run the Sovereign OS (with integrated
Sentinel self-awareness) on an Android device using
[Kivy](https://kivy.org/) and [Buildozer](https://buildozer.readthedocs.io/).

---

## Architecture overview

```
android_app.py          ← Kivy UI (touch-compatible)
brick_stitch_sovereign_os.py  ← Core OS: DAG, Spine, Healing, Sentinel
buildozer.spec          ← Android build configuration
requirements.txt        ← Desktop / dev dependencies
```

The Kivy layer wraps the core Sovereign OS directly: no server process,
no network bridge — the brick DAG, spine ledger, and sentinel layer all
run in-process on the device.

---

## Prerequisites (build machine — Linux / macOS)

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10 – 3.12 | `apt install python3` |
| pip | latest | `pip install --upgrade pip` |
| Buildozer | ≥ 1.5 | `pip install buildozer` |
| Android NDK | r25c | downloaded by Buildozer automatically |
| Android SDK | API 34 | downloaded by Buildozer automatically |
| Git | any | `apt install git` |
| Java JDK | 17 | `apt install openjdk-17-jdk` |
| Additional packages | — | `apt install zip unzip autoconf libtool pkg-config` |

> **Windows users:** Use WSL2 (Ubuntu 22.04) or a Linux VM — Buildozer
> does not support native Windows builds.

---

## Step-by-step build

### 1. Clone the repository

```bash
git clone https://github.com/jgaos2026-gif/sb688-public.git
cd sb688-public
```

### 2. Install desktop Python dependencies (for local testing)

```bash
pip install -r requirements.txt
```

### 3. Test on the desktop first

```bash
# Run the Kivy UI on your desktop (no Android device needed)
python android_app.py

# Run the core OS headless test suite
python brick_stitch_sovereign_os.py
```

Both commands should complete without errors.

### 4. Install Buildozer and Android toolchain

```bash
pip install buildozer cython

# Install system packages needed by python-for-android
sudo apt install -y \
    build-essential git zip unzip \
    openjdk-17-jdk autoconf libtool pkg-config \
    libffi-dev libssl-dev python3-dev \
    libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev
```

### 5. Build the APK

```bash
# First build (downloads NDK/SDK — takes 20–40 min)
buildozer android debug

# Subsequent builds (much faster)
buildozer android debug
```

The APK is written to `bin/sovereignos-1.0.0-arm64-v8a_armeabi-v7a-debug.apk`.

### 6. Deploy to your Android device

Enable **Developer Options** and **USB Debugging** on your phone, then:

```bash
# Install via ADB
adb install bin/sovereignos-*.apk

# Or let Buildozer deploy and run in one step
buildozer android debug deploy run logcat
```

### 7. Monitor logs

```bash
# Filter Kivy / Python log output
adb logcat | grep -E "python|kivy|sovereign"
```

---

## Using the app

| UI element | Description |
|-----------|-------------|
| **Header** | App title and current sentinel threat badge (colour-coded) |
| **Brick row** | Live health indicator for each brick (`✓` healthy, `✗` faulted) |
| **Sentinel strip** | Threat level, incident count, ledger head version |
| **Log area** | Scrollable event log (fault injections, test results) |
| **Fault buttons** | Tap to inject a fault into a specific brick or the spine |
| **▶ Run Tests** | Executes the full 10-scenario 3-pass test suite |
| **⚕ Heal All** | Resets all bricks to healthy state |
| **✕ Clear Log** | Clears the event log |

---

## Supported Android versions

| Android | API | Status |
|---------|-----|--------|
| 14 | 34 | ✅ Tested target |
| 13 | 33 | ✅ Supported |
| 12 / 12L | 31–32 | ✅ Supported |
| 8.0 Oreo | 26 | ⚠ Minimum (set in `buildozer.spec`) |

Architectures built: `arm64-v8a` (modern phones) + `armeabi-v7a` (legacy).

---

## Release / signed APK

To generate a signed release APK for distribution or sideloading:

```bash
# Generate a signing keystore (once)
keytool -genkey -v \
  -keystore sovereign-release.keystore \
  -alias sovereign \
  -keyalg RSA -keysize 2048 -validity 10000

# Set environment variables
export P4A_RELEASE_KEYSTORE=$(pwd)/sovereign-release.keystore
export P4A_RELEASE_KEYALIAS=sovereign
export P4A_RELEASE_KEYSTORE_PASSWD=<your-password>
export P4A_RELEASE_KEYALIAS_PASSWD=<your-password>

# Build release APK
buildozer android release
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `SDK not found` | `buildozer android debug` auto-downloads; ensure internet access |
| `NDK not found` | Same as above — Buildozer downloads NDK r25c |
| App crashes on launch | Check `adb logcat` for Python traceback |
| `networkx` not found | Ensure `networkx` is in `buildozer.spec` `requirements` |
| Build hangs | Network issue; retry or set `BUILDOZER_WARN_ON_ROOT=0` |
| `kivy` import error | Ensure Kivy 2.3.0 is listed in `requirements` in spec |

---

## Core OS guarantees on Android

The Android port preserves all Sovereign OS properties:

- **Deterministic clock** — `DeterministicClock` advances by 1 per tick; no wall-clock dependency
- **Tamper-evident ledger** — SHA-256 hash chain stored in memory; verified before every commit
- **DAG-aware healing** — NetworkX `DiGraph` works identically on Android Python
- **Sentinel self-awareness** — `SentinelLayer` + `BraidedLogic` watch, classify, and learn from faults
- **3-pass validation** — `run_three_clean_passes()` must succeed before the UI marks the system READY

---

© 2026 John Arenz (J.G.A.).  See [LICENSE](../LICENSE) for terms.
