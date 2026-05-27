# WMS Pro - System Architecture

## File Organization

### Navigation Hierarchy

```
┌─────────────────────────────────────────┐
│  public/index.html (Landing Hub)        │
│  - Central navigation point              │
│  - Links to all major features           │
│  - Quick stats overview                  │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┼──────────┬──────────┬──────────┬──────────┐
        │          │          │          │          │          │
        ↓          ↓          ↓          ↓          ↓          ↓
    Dashboard  AddProduct   Products   Reports   Warehouse   Settings
    *.html     *.html       *.html     *.html    *.html      *.html
```

## Pages Overview

### Entry Point
- **public/index.html** - Main landing page with navigation to all sections

### Core Modules
- **pages/dashboard.html** - Analytics and real-time metrics
- **pages/add-product.html** - New product registration
- **pages/product-management.html** - Product catalog and inventory
- **pages/inventory-reports.html** - Reports and analytics
- **pages/warehouse-location-map.html** - Warehouse visualization
- **pages/warehouse-import-export.html** - Data import/export
- **pages/system-settings.html** - System configuration

### Shared Resources
- **shared/tailwind-config.js** - Centralized Tailwind configuration
- **shared/styles.html** - Global styles and themes
- **shared/navbar.html** - Reusable navigation component

### Assets
- **Assets/[module]/screen.png** - UI mockup screenshots
- **Assets/inventory_precision_system/DESIGN.md** - Design system documentation

## Navigation Pattern

Each page includes a top navigation bar that links to:
1. Home (`/` or `/public/index.html`)
2. Dashboard (`./dashboard.html`)
3. Products (`./product-management.html`)
4. Reports (`./inventory-reports.html`)
5. Settings (`./system-settings.html`)

## File Naming Convention

- Use kebab-case for HTML files: `product-management.html`
- Use snake_case for Asset folders: `product_management/`
- Screenshots named: `screen.png`
- Design docs named: `DESIGN.md`

## Dependencies

All pages depend on:
- Tailwind CSS (CDN)
- Material Symbols Icons (Google Fonts)
- Inter Font (Google Fonts)
- JetBrains Mono Font (Google Fonts)

No external dependencies required - all self-contained HTML files.

## Access Paths

When running locally:
- Root: `public/index.html` or `/`
- Pages: `pages/[page-name].html`
- Assets: `Assets/[module]/[file]`
- Shared: `shared/[file]`

## Cross-Linking Strategy

### From public/index.html
```html
<a href="./pages/dashboard.html">Dashboard</a>
```

### From pages/*
```html
<a href="/">Home</a>
<a href="./dashboard.html">Dashboard</a>
```

### From navigation bar
```html
<a href="/" class="font-label-md">Home</a>
<a href="./product-management.html">Products</a>
```

## Design System Integration

All pages use the same:
- **Color Palette**: 25+ semantic colors
- **Typography Scale**: 8 text styles
- **Spacing System**: 4px base unit
- **Component Library**: Buttons, cards, tables, modals

Defined in: `Assets/inventory_precision_system/DESIGN.md`

## Build/Deploy Considerations

- **No Build Step**: Pure HTML/CSS/JS, ready to deploy
- **Static Files**: All files can be served as-is
- **CDN Dependencies**: Fonts and Tailwind from CDN
- **Relative Paths**: Work locally and on servers
- **Responsive**: Mobile-first, works on all screen sizes

## Future Enhancements

1. Extract shared nav to `shared/navbar.html` for consistency
2. Create template system to reduce code duplication
3. Add JavaScript for interactivity
4. Implement dark mode toggle
5. Add form handling/validation
6. Create component library documentation

## Summary

The system is organized into:
- **Entry point**: `public/index.html` with central navigation
- **Page modules**: 7 feature pages in `pages/` directory
- **Shared assets**: Configuration and reusable components in `shared/`
- **Design system**: Complete specs in DESIGN.md
- **Assets**: Screenshots and mockups in `Assets/` folders

All pages are interconnected through consistent navigation patterns and relative linking.
