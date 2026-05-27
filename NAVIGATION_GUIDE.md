# WMS Pro - Quick Navigation Guide

## 🏠 Access Points

### Main Landing Page
```
Local: file:///home/giang/Stockroom/public/index.html
URL Pattern: https://domain.com/
```

## 📄 All Pages & URLs

| Feature | File | URL Pattern | Purpose |
|---------|------|-------------|---------|
| 🏠 Home | `public/index.html` | `/` | Landing hub with all links |
| 📊 Dashboard | `pages/dashboard.html` | `/pages/dashboard.html` | Real-time metrics & analytics |
| ➕ Add Product | `pages/add-product.html` | `/pages/add-product.html` | Register new SKU |
| 📦 Products | `pages/product-management.html` | `/pages/product-management.html` | Manage inventory |
| 📈 Reports | `pages/inventory-reports.html` | `/pages/inventory-reports.html` | Revenue & analytics |
| 🗺️ Warehouse Map | `pages/warehouse-location-map.html` | `/pages/warehouse-location-map.html` | Location tracking |
| 📤 Import/Export | `pages/warehouse-import-export.html` | `/pages/warehouse-import-export.html` | Bulk data operations |
| ⚙️ Settings | `pages/system-settings.html` | `/pages/system-settings.html` | Configuration |

## 🔗 Navigation Structure

### From Home Page (`public/index.html`)
All 7 feature pages are clickable cards with descriptive text.

### From Feature Pages
Each page has a top navigation bar with links to:
- Home (`/`)
- Dashboard (`./dashboard.html`)
- Products (`./product-management.html`)
- Reports (`./inventory-reports.html`)
- Settings (`./system-settings.html`)

## 📁 Folder Structure

```
Stockroom/
├── 📄 README.md                    ← Project documentation
├── 📄 ARCHITECTURE.md              ← System design & structure
├── 📄 NAVIGATION_GUIDE.md          ← This file
│
├── 📁 public/
│   └── index.html                  ← MAIN ENTRY POINT
│
├── 📁 pages/
│   ├── dashboard.html              ← /pages/dashboard.html
│   ├── add-product.html            ← /pages/add-product.html
│   ├── product-management.html     ← /pages/product-management.html
│   ├── inventory-reports.html      ← /pages/inventory-reports.html
│   ├── warehouse-location-map.html ← /pages/warehouse-location-map.html
│   ├── warehouse-import-export.html ← /pages/warehouse-import-export.html
│   └── system-settings.html        ← /pages/system-settings.html
│
├── 📁 shared/
│   ├── tailwind-config.js          ← Shared Tailwind configuration
│   ├── styles.html                 ← Global styles
│   └── navbar.html                 ← Reusable navbar component
│
└── 📁 Assets/
    ├── add_new_product/
    │   └── screen.png
    ├── dashboard_overview/
    │   └── screen.png
    ├── inventory_precision_system/
    │   └── DESIGN.md                ← Design system specs
    ├── inventory_revenue_reports/
    │   └── screen.png
    ├── product_management/
    │   └── screen.png
    ├── system_settings/
    │   └── screen.png
    ├── warehouse_import_export/
    │   └── screen.png
    └── warehouse_location_map/
        └── screen.png
```

## 🚀 Getting Started

### Step 1: Open Home Page
```bash
# Local development
open public/index.html
# Or in browser
file:///home/giang/Stockroom/public/index.html
```

### Step 2: Navigate Using One of Three Methods

**Method 1: Click Cards on Home Page**
- Each feature is a clickable card with description

**Method 2: Use Top Navigation Bar**
- Available on all feature pages
- Links to major sections

**Method 3: Direct URL Access**
- Go directly to any page using its URL

## 🎨 Design System Access

View the complete design specifications:
```
Assets/inventory_precision_system/DESIGN.md
```

Contains:
- Color palette
- Typography system
- Spacing guidelines
- Component specifications
- Brand guidelines

## 💡 Features by Module

### Dashboard Module
- Real-time inventory metrics
- Import/export activity charts
- Critical alerts
- Recent transactions table

### Add Product Module
- Product registration form
- SKU management
- Pricing setup
- Warehouse location assignment
- Product image upload

### Product Management Module
- Product catalog browsing
- Inventory filtering
- Product details editing
- Stock level tracking

### Inventory Reports Module
- Revenue analytics
- Stock movement reports
- Inventory levels analysis
- Export capabilities

### Warehouse Map Module
- Visual warehouse layout
- Shelf organization
- Zone management
- Location-based tracking

### Import/Export Module
- Bulk data import
- Inventory export
- File format support
- Validation reporting

### Settings Module
- System configuration
- User management
- Warehouse setup
- Preferences

## 🔄 Page Relationships

```
                     Public/Index.html (Home)
                           |
                  (Central Navigation Hub)
                           |
        ┌──────┬──────┬────┼────┬──────┬──────┐
        |      |      |    |    |      |      |
     Dashboard Add  Product Reports Warehouse Settings
                 Product Management   Map/Exp

    (All pages link back to Home and to each other)
```

## 📱 Responsive Design

All pages are responsive and work on:
- Mobile (320px+)
- Tablet (768px+)
- Desktop (1024px+)

Navigation adapts for mobile screens.

## 🔑 Key Files to Understand

| File | Purpose |
|------|---------|
| `public/index.html` | Entry point - start here |
| `ARCHITECTURE.md` | Understanding system structure |
| `README.md` | General project info |
| `shared/tailwind-config.js` | Shared configuration |
| `Assets/inventory_precision_system/DESIGN.md` | Design specs |

## ✅ Verification Checklist

- [x] All HTML files moved to appropriate directories
- [x] File names are semantic and descriptive
- [x] Navigation bar added to all pages
- [x] Home page created with links to all modules
- [x] Shared configuration extracted
- [x] Documentation complete
- [x] File structure organized and clean

## 📞 Support

Refer to:
1. **README.md** - Project overview
2. **ARCHITECTURE.md** - Technical structure
3. **DESIGN.md** - Design guidelines
4. **This file** - Navigation guide

---

**Version**: 1.0 | **Last Updated**: 2026-05-27 | **Status**: Ready to Use
