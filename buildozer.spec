[app]

# --- Basic application identity ---
title = Sovereign OS
package.name = sovereignos
package.domain = com.jgaos2026

# --- Source ---
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json
source.include_patterns = brick_stitch_sovereign_os.py,android_app.py
source.exclude_dirs = dist,build,.git,.github,node_modules,src,test,types,demo,docs,dist

# --- Application version ---
version = 1.0.0

# --- Python dependencies ---
# networkx is pure-Python and ships with p4a; kivy is the UI toolkit.
requirements = python3,kivy==2.3.0,networkx

# --- Orientation: portrait-primary for phone UI ---
orientation = portrait

# --- Fullscreen on Android (hides status bar) ---
fullscreen = 0

# --- Entry point ---
source.main = android_app.py

# --- Icon and presplash (optional — replace with actual assets if available) ---
# icon.filename = %(source.dir)s/assets/icon.png
# presplash.filename = %(source.dir)s/assets/presplash.png

# --- Android-specific ---
android.permissions = INTERNET
android.api = 34
android.minapi = 26
android.ndk = 25c
android.ndk_api = 21
android.archs = arm64-v8a, armeabi-v7a
android.allow_backup = True

# Keep Python bytecode cache out of APK.
android.add_aars =
android.add_jars =

# --- iOS (not targeted here, set blank) ---
[buildozer]
log_level = 2
warn_on_root = 1
