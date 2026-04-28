# SB-688 Public Demo

<p align="center">
  <img src="../logo-banner.svg" alt="Jay's Graphic Arts" width="500"/>
</p>

Scripts in this folder demonstrate the SB-688 resilience system
without exposing internal kernel logic.

## Teaser (10 seconds)

```bash
python public_demo/teaser_snippet.py
```

Shows a quick break/heal cycle with resilience metrics.

## Full Demo

```bash
python public_demo/run_demo.py
```

Runs the complete resilience pipeline:
initialization → corruption → detection → healing → verification.

To export proof artifacts:

```bash
SB688_SENSITIVE_ACCESS_CODE=<your-code> python public_demo/run_demo.py
```

---

<p align="center">
  <em>Jay's Graphic Arts / National Resilience Council</em><br/>
  <img src="../demo/logo.svg" alt="JGA Logo" width="80"/>
</p>

*Internal kernel source is not included in the public demo layer.*
