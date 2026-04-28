# Jay's Graphic Arts - Brand Guidelines

<p align="center">
  <img src="./logo-banner.svg" alt="Jay's Graphic Arts" width="600"/>
</p>

## Brand Identity

**Company Name:** Jay's Graphic Arts (JGA)
**Tagline:** Excellence in Sovereign AI Systems
**Core Values:** Resilience · Governance · Innovation

---

## Logo

### Primary Logo
- **File:** `logo-banner.svg` (horizontal format for headers)
- **File:** `demo/logo.svg` (square format for icons)
- **Elements:** Lion in hexagon with "JGA" in Old English style lettering
- **Symbolism:**
  - Lion: Strength, sovereignty, leadership
  - Hexagon: Structure, stability, geometric precision
  - Old English Letters: Heritage, craftsmanship, authority

### Logo Usage
- Minimum clear space: 20px on all sides
- Never stretch or distort the logo
- Always use on black or dark backgrounds for optimal contrast
- Can be used in gold gradient or solid gold (#D4AF37)

---

## Color Palette

### Primary Colors

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Black** | `#000000` | 0, 0, 0 | Primary background |
| **Dark Panel** | `#0A0A0A` | 10, 10, 10 | Secondary backgrounds |
| **Classic Gold** | `#D4AF37` | 212, 175, 55 | Primary text, borders, branding |

### Gold Variations

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Gold Light** | `#F4D03F` | 244, 208, 63 | Highlights, hover states |
| **Gold Dark** | `#B8960F` | 184, 150, 15 | Subtle text, secondary elements |

### Accent Colors (System States)

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Alert Red** | `#FF0000` | 255, 0, 0 | Errors, corruption, danger |
| **Success Green** | `#00FF00` | 0, 255, 0 | Healing, success, operational |
| **Warning Yellow** | `#FFFF00` | 255, 255, 0 | Verification, caution |

---

## Typography

### Headings
- **Font:** Inter, Segoe UI, system-ui, sans-serif
- **Weight:** 700 (Bold)
- **Color:** Gold (#D4AF37)
- **Letter Spacing:** 0.05em - 0.08em (generous spacing for premium feel)

### Body Text
- **Font:** Inter, Segoe UI, system-ui, sans-serif
- **Weight:** 400 (Regular)
- **Color:** Gold (#D4AF37)

### Monospace (Code/Ledger)
- **Font:** Monaco, "Courier New", monospace
- **Weight:** 400 (Regular)
- **Size:** 12px
- **Color:** Gold (#D4AF37) for default, system colors for states

### Logo Text
- **Font:** Blackletter, Old English Text MT, UnifrakturCook, serif
- **Style:** Traditional, authoritative, craftsmanship-oriented

---

## Design Principles

### 1. **Premium Black & Gold Aesthetic**
- Black backgrounds convey sophistication, power, and premium quality
- Gold accents represent excellence, value, and prestige
- High contrast ensures readability and professional appearance

### 2. **Geometric Precision**
- Use of hexagonal shapes in logo design
- Clean lines and structured layouts
- Grid-based organization in UI elements

### 3. **Minimalist Elegance**
- Avoid clutter
- Generous whitespace (or black-space in our case)
- Focus on essential elements
- Let the gold accents stand out against black

### 4. **Authority & Trust**
- Old English typography suggests heritage and authority
- Lion symbolism reinforces strength and leadership
- Structured, professional layouts build trust

---

## UI Components

### Buttons
```css
button {
  border: 1px solid var(--gold);
  background: #141414;
  color: var(--gold);
  padding: 10px 12px;
  font-weight: 700;
  transition: all 150ms ease-in-out;
}

button:hover {
  border-color: var(--gold-light);
  color: var(--gold-light);
}
```

### Panels
```css
.panel {
  border: 1px solid var(--gold);
  background: var(--panel);
  color: var(--text);
}
```

### Headers
```css
.site-header {
  background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
  border-bottom: 2px solid var(--gold);
  padding: 20px 40px;
}
```

---

## Brand Voice

### Tone
- **Professional:** Expert, authoritative, knowledgeable
- **Confident:** Strong, assured, decisive
- **Precise:** Technical, specific, accurate
- **Premium:** High-quality, excellence-focused

### Key Messages
- Excellence in sovereign AI systems
- Resilience-first approach to AI alignment
- Proven, verified, trustworthy solutions
- Innovation rooted in strong foundations

---

## Application

### Repository Documentation
- All major README files include the logo banner at the top
- Footer sections include the JGA icon logo
- Consistent "Jay's Graphic Arts / National Resilience Council" attribution

### Web Interfaces
- Logo appears in header with tagline
- Black and gold color scheme throughout
- System state colors (red, green, yellow) used for functional indicators only
- Gold remains the dominant accent color

### Print & Digital Media
- Logo can be used in full color (gold gradient) or solid gold
- Always on black or very dark backgrounds
- Maintain proper spacing and sizing ratios

---

## File Assets

| Asset | Location | Purpose |
|-------|----------|---------|
| Banner Logo | `/logo-banner.svg` | Horizontal format for documentation headers |
| Icon Logo | `/demo/logo.svg` | Square format for icons and small spaces |
| Demo Stylesheet | `/demo/styles.css` | Reference implementation of color scheme |

---

<p align="center">
  <strong>Jay's Graphic Arts</strong><br/>
  <em>Excellence in Sovereign AI Systems</em><br/>
  Resilience · Governance · Innovation
</p>

<p align="center">
  <img src="./demo/logo.svg" alt="JGA Logo" width="100"/>
</p>
