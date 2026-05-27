# Warehouse Management System (WMS Pro)

A modern warehouse management system with a clean, organized file structure.

## 📁 Project Structure

```
.
├── public/
│   └── index.html              # Landing page with navigation to all modules
├── pages/
│   ├── dashboard.html          # Dashboard with analytics and real-time metrics
│   ├── add-product.html        # Form to register new products/SKUs
│   ├── product-management.html # Product inventory management interface
│   ├── inventory-reports.html  # Revenue and inventory reports
│   ├── warehouse-location-map.html  # Warehouse location visualization
│   ├── warehouse-import-export.html # Bulk import/export functionality
│   └── system-settings.html    # System configuration and preferences
├── shared/
│   ├── tailwind-config.js      # Shared Tailwind CSS configuration
│   ├── styles.html             # Shared CSS styles and themes
│   └── navbar.html             # Reusable navigation component
├── Assets/
│   ├── add_new_product/
│   │   └── screen.png          # UI mockup screenshot
│   ├── dashboard_overview/
│   │   └── screen.png
│   ├── inventory_precision_system/
│   │   └── DESIGN.md           # Complete design system documentation
│   └── ... (other asset folders with screenshots)
└── README.md                   # This file
```

## 🎨 Design System

The design system includes:
- **Color Palette**: Material Design 3 compatible colors with semantic meanings
- **Typography**: Inter font for UI, JetBrains Mono for data
- **Spacing**: 4px base unit system for consistent spacing
- **Components**: Buttons, cards, tables, input fields, status chips

See `Assets/inventory_precision_system/DESIGN.md` for complete design specifications.

## 🚀 Quick Start

1. **View Home Page**
   - Open `public/index.html` in your browser
   - This serves as the main navigation hub

2. **Navigate Between Pages**
   - Use the navigation bar at the top of each page
   - Or use the links on the home page

3. **Common Links**
   - Home: `/public/index.html` or `/`
   - Dashboard: `/pages/dashboard.html`
   - Add Product: `/pages/add-product.html`
   - Products: `/pages/product-management.html`
   - Reports: `/pages/inventory-reports.html`

## 📊 Page Descriptions

### Dashboard (`pages/dashboard.html`)
- Real-time warehouse metrics
- Import/export activity charts
- Inventory by category visualization
- Critical alerts and notifications
- Recent transaction history

### Add Product (`pages/add-product.html`)
- Register new products with SKU
- Set pricing (import/selling prices)
- Configure warehouse location and stock levels
- Product image upload capability
- Form validation and error handling

### Product Management (`pages/product-management.html`)
- Browse all products in inventory
- Filter and search capabilities
- Update product information
- Track stock levels by category

### Inventory Reports (`pages/inventory-reports.html`)
- Revenue analysis and reports
- Inventory movement tracking
- Stock level analytics
- Export report data

### Warehouse Location Map (`pages/warehouse-location-map.html`)
- Visual warehouse layout
- Shelf and location organization
- Zone management
- Location-based inventory tracking

### Import/Export (`pages/warehouse-import-export.html`)
- Bulk product import
- Export inventory data
- File format support (CSV, Excel)
- Import validation and error reporting

### Settings (`pages/system-settings.html`)
- System configuration
- User management
- Warehouse preferences
- Application settings

## 🔗 File Interconnection

All pages are connected through:
1. **Navigation Bar**: Top navigation with links to major sections
2. **Home Hub**: Landing page with links to all modules
3. **Relative Links**: Pages reference each other using relative paths
   - Example: `./dashboard.html` from pages directory
   - Example: `/pages/add-product.html` from public directory

## 🎯 Design Features

- **Clean, Modern UI**: Minimalist design focused on clarity
- **High Information Density**: Balanced whitespace with data-rich components
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Semantic Colors**: Red for errors, amber for warnings, green for success
- **Dark Mode Ready**: CSS variables support light/dark themes
- **Accessible**: WCAG compliant with proper contrast ratios

## 📱 Mobile Optimization

- Sidebar collapses on mobile (260px → 80px)
- Responsive grid layouts (1 col → 2 col → 4+ col)
- Touch-friendly button sizes
- Mobile-first navigation

## 🛠️ Technology Stack

- **Tailwind CSS**: Utility-first CSS framework
- **Material Symbols**: Google's icon library
- **Inter Font**: Modern, legible typography
- **JetBrains Mono**: Data display font
- **HTML5**: Semantic markup

## 📝 Notes

- All pages use inline Tailwind CSS configuration
- Color variables are defined in `shared/tailwind-config.js`
- Each page is self-contained and can run independently
- The system follows Material Design 3 principles
- All spacing uses 4px base unit multiples

## 🔄 Updating Navigation

To add new pages or update navigation links:

1. Add new HTML file to `/pages/` directory
2. Update the navigation bar links on all pages
3. Add link to home page (`public/index.html`)
4. Ensure consistent naming (kebab-case: `page-name.html`)

## 📄 License

See DESIGN.md for brand guidelines and design specifications.
