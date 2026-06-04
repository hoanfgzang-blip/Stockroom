---
name: Inventory Precision System
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  sidebar-width: 260px
  sidebar-collapsed: 80px
---

## Brand & Style
The design system is engineered for a modern Warehouse Management System (WMS) that prioritizes clarity, efficiency, and data integrity. The brand personality is **utilitarian yet sophisticated**, moving away from the cluttered, legacy interfaces typical of industrial software toward a clean, high-performance SaaS aesthetic.

The target audience consists of small-to-medium business operators who require a tool that feels as intuitive as their personal apps but as robust as enterprise hardware. The UI evokes a sense of **calm control** through:
- **Minimalism:** Stripping away non-essential decorations to focus on stock levels and order statuses.
- **Corporate / Modern:** Utilizing a structured, reliable layout that inspires trust in the underlying data accuracy.
- **High-Information Density (Balanced):** Using generous whitespace not just for aesthetics, but to prevent cognitive overload during fast-paced warehouse operations.

## Colors
This design system utilizes a functional color palette where every hue serves a specific communicative purpose.

- **Primary Blue (#2563EB):** Reserved for high-intent actions, navigation states, and primary buttons. It represents the "active" state of the warehouse.
- **Secondary Slate (#64748B):** Used for supporting text, icons, and non-primary UI elements to provide a professional, grounded feel.
- **Semantic Palette:** 
    - **Success Green:** Indicates healthy stock levels and completed shipments.
    - **Warning Amber:** Signals "Low Stock" thresholds or pending approvals.
    - **Error Red:** Flags "Out of Stock" items or system discrepancies.
- **Neutral Background (#F9FAFB):** A soft, cool white base that reduces screen glare for workers using the system over long shifts.

## Typography
The typography system uses **Inter** for its exceptional legibility on digital screens and its neutral, systematic character. 

For data-heavy views—such as SKU numbers, tracking codes, and inventory counts—the design system introduces a secondary monospaced font (**JetBrains Mono**) to ensure character alignment and prevent reading errors. 

**Key Rules:**
- **Weight as Hierarchy:** Use Semibold (600) for section headers and Bold (700) sparingly for critical alerts.
- **Tight Letter Spacing:** Apply slight negative tracking to larger headlines to maintain a modern, "tight" look.
- **Labels:** Use the `label-md` style for table headers and metadata categories to create a clear visual distinction from live data.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a sidebar-driven navigation structure.

- **Grid:** A 12-column grid is used for the main content area. Gutters are fixed at 24px to provide "breathing room" between complex data widgets.
- **Sidebar:** The sidebar is collapsible to maximize horizontal space for large inventory tables. It transitions from 260px to 80px.
- **Spacing Rhythm:** All spacing (padding, margins, gaps) must be a multiple of the 4px base unit. 
    - Use `16px` (4x) for internal card padding.
    - Use `24px` (6x) for vertical spacing between page sections.
- **Mobile Adaptivity:** On mobile devices, the 12-column grid collapses to a single column, and margins reduce to 16px to conserve screen real estate for handheld barcode scanning interfaces.

## Elevation & Depth
To maintain a "clean SaaS" look, this design system avoids heavy drop shadows in favor of **Tonal Layers** and **Ambient Depth**.

- **Level 0 (Background):** The `#F9FAFB` surface. Everything sits here initially.
- **Level 1 (Cards/Containers):** White (`#FFFFFF`) surfaces with a subtle 1px border (`#E5E7EB`) and a soft, highly-diffused shadow (Y: 2px, Blur: 4px, Color: rgba(0,0,0,0.05)).
- **Level 2 (Modals/Popovers):** Higher elevation with a more pronounced shadow (Y: 10px, Blur: 20px, Color: rgba(0,0,0,0.1)) to focus attention on critical inputs.
- **Depth Contrast:** Use the neutral background to separate the sidebar and top bar from the main canvas, creating a "frame" effect that makes the content area feel like a focused workspace.

## Shapes
The shape language is **friendly yet professional**, utilizing a consistent rounded corner logic that softens the industrial nature of the software.

- **Base Radius:** 0.5rem (8px) for small components like input fields and buttons.
- **Container Radius:** 1rem (16px) for main dashboard cards and the sidebar.
- **Interactive Elements:** Use the base radius to ensure that buttons feel "clickable" and distinct from the more structural containers they inhabit.

## Components
- **Buttons:** Primary buttons use a solid `#2563EB` fill with white text. Secondary buttons use a subtle gray stroke. Use `12px` vertical and `24px` horizontal padding for a substantial, tactile feel.
- **Status Chips:** Small, rounded-pill indicators. Use background tints of the semantic colors (e.g., 10% opacity Green for "In Stock") with high-contrast text.
- **Input Fields:** Use 1px borders in `#D1D5DB`. Focus states must transition the border to Primary Blue with a 2px outer glow.
- **Data Tables:** The core of the WMS. Use `body-md` for row content. Alternate row striping is not used; instead, use subtle hover states on rows to assist tracking.
- **Inventory Cards:** Summarize SKU data using a Level 1 elevation card. Include a top-accent border in a semantic color to indicate stock status at a glance.
- **Collapsible Sidebar:** Icons should be paired with `label-md` text. In the collapsed state, use Tooltips to reveal navigation labels.