# Repository Branding Checklist

This checklist helps ensure consistent Jay's Graphic Arts (JGA) branding across all repositories.

## Required Files

Copy these files to each repository root:
- [ ] `logo-banner.svg` - Horizontal logo for headers
- [ ] `demo/logo.svg` - Square logo for icons (or similar path)
- [ ] `BRANDING.md` - Brand guidelines document

## README Updates

### Main README.md
- [ ] Add logo banner at top after title
```markdown
# Repository Title

<p align="center">
  <img src="./logo-banner.svg" alt="Jay's Graphic Arts" width="600"/>
</p>
```

- [ ] Update footer with formatted branding
```markdown
---

<p align="center">
  <strong>Project Name</strong><br/>
  <em>Jay's Graphic Arts / National Resilience Council</em>
</p>

<p align="center">
  <img src="./demo/logo.svg" alt="JGA Logo" width="100"/>
</p>
```

### All Subdirectory README files
- [ ] Add logo banner with appropriate relative path
- [ ] Add footer branding consistently

## Web Assets

### HTML Files
- [ ] Add header section with logo and branding
```html
<header class="site-header">
  <img src="./logo.svg" alt="Jay's Graphic Arts" class="logo" />
  <div class="branding">
    <h1 class="brand-title">Application Name</h1>
    <p class="brand-tagline">Jay's Graphic Arts - Excellence in Sovereign AI Systems</p>
  </div>
</header>
```

### CSS/Stylesheets
- [ ] Update color variables to black & gold theme
```css
:root {
  --bg: #000000;
  --panel: #0a0a0a;
  --border: #d4af37;
  --text: #d4af37;
  --gold: #d4af37;
  --gold-light: #f4d03f;
  --gold-dark: #b8960f;
}
```

- [ ] Update text colors to gold
- [ ] Update border colors to gold
- [ ] Update hover states to gold-light
- [ ] Ensure buttons use gold theme (except state-specific colors)

## Documentation Files

### Whitepaper/Technical Docs
- [ ] Add logo banner at top
- [ ] Update footer branding
- [ ] Ensure consistent attribution to "Jay's Graphic Arts / National Resilience Council"

### About/Info Pages
- [ ] Include JGA branding
- [ ] Reference brand values: Resilience · Governance · Innovation
- [ ] Maintain professional, authoritative tone

## Visual Assets

### Logos
- [ ] Never stretch or distort logos
- [ ] Maintain 20px minimum clear space
- [ ] Only use on black or dark backgrounds
- [ ] Use gold gradient or solid gold (#D4AF37)

### Color Usage
- [ ] Black (#000000) for primary background
- [ ] Gold (#D4AF37) for primary text and accents
- [ ] System colors (red/green/yellow) only for functional states
- [ ] Dark panel (#0A0A0A) for secondary backgrounds

## Typography

- [ ] Headers: Bold, gold color, generous letter-spacing
- [ ] Body text: Regular weight, gold color
- [ ] Logo text: Old English / Blackletter style where appropriate
- [ ] Monospace: For code/technical content

## Repository-Specific Checklist

### Repository: _________________

- [ ] Main README.md updated
- [ ] All subdirectory READMEs updated
- [ ] Logo files copied
- [ ] BRANDING.md copied
- [ ] HTML files updated (if applicable)
- [ ] CSS files updated (if applicable)
- [ ] Documentation files updated
- [ ] Visual consistency verified
- [ ] All "Jay's Graphic Arts" references formatted consistently
- [ ] Footer branding on all major documents

---

## Quick Reference

**Company:** Jay's Graphic Arts (JGA)
**Colors:** Black (#000000) & Gold (#D4AF37)
**Tagline:** Excellence in Sovereign AI Systems
**Values:** Resilience · Governance · Innovation
**Logo:** Lion in hexagon with Old English "JGA"

---

<p align="center">
  <em>Use this checklist for each of the 7 repositories to ensure consistent branding</em>
</p>
