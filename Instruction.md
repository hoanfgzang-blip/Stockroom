# Instruction — WMS- Project

> **Lưu ý:** File này ghi lại các thay đổi, hướng dẫn cấu trúc dự án và đường dẫn tới các file dữ liệu bảng quan trọng.  
> Không sửa `README.md`; mọi chỉ dẫn kỹ thuật được ghi tại đây.

---

## 1. Cấu trúc dự án

```
WMS-/
├── WMS-.sln                          # Solution file
└── WMS-/
    ├── Components/
    │   ├── App.razor                 # Entry point HTML, Tailwind config, global styles
    │   ├── Routes.razor              # Router (FocusOnNavigate đã bị xoá)
    │   ├── Layout/
    │   │   ├── MainLayout.razor      # Layout chính (sidebar + topnav + main)
    │   │   ├── NavMenu.razor         # Sidebar navigation
    │   │   └── TopNav.razor          # Top bar
    │   └── Pages/
    │       ├── Dashboard.razor
    │       ├── WarehouseImportExport.razor   # Tab Quản lý Nhập kho
    │       ├── WarehouseExport.razor         # Tab Quản lý Xuất kho (trang mới)
    │       ├── ProductManagement.razor       # Tab Quét mã & Phân loại
    │       ├── InventoryReports.razor
    │       ├── WarehouseLocationMap.razor
    │       ├── SystemSettings.razor
    │       └── AddProduct.razor
    └── wwwroot/
        ├── app.css                   # Global CSS (animation suppression, overrides)
        └── Assets/
            └── data/                 # ← CÁC FILE DỮ LIỆU BẢNG (JS)
                ├── importData.js
                └── scanSortData.js
```

---

## 2. Đường dẫn các file dữ liệu bảng (JS)

### 2.1 — Bảng Quản lý Nhập kho
| Thuộc tính | Giá trị |
|---|---|
| **File** | `WMS-/wwwroot/Assets/data/importData.js` |
| **Dùng cho trang** | `Components/Pages/WarehouseImportExport.razor` |
| **Route** | `/warehouse-import-export` |
| **Nội dung** | Danh sách lô hàng nhập qua Dock 1–4, trạng thái dỡ hàng, khu vực chờ phân loại |

**Cấu trúc `ImportRecord`:**
```js
{
  id:           string,   // "IMP-2024-0001"
  shipmentCode: string,   // "SHP-DA-001"
  dock:         string,   // "Dock 1" | "Dock 2" | "Dock 3" | "Dock 4"
  supplier:     string,
  description:  string,
  totalPallets: number,
  totalPkgs:    number,
  arrivalTime:  string,   // ISO 8601
  status:       string,   // "Chờ phân loại" | "Đang dỡ hàng" | "Hoàn thành"
  zone:         string    // "Hàng chờ PL" | "Khu phân loại"
}
```

**Hàm tiện ích có sẵn:**
```js
getAllImportRecords()               // → ImportRecord[]
getImportRecordsByDock("Dock 1")   // → ImportRecord[]
getImportRecordsByStatus("Chờ phân loại")  // → ImportRecord[]
```

---

### 2.2 — Bảng Quản lý Quét mã & Phân loại
| Thuộc tính | Giá trị |
|---|---|
| **File** | `WMS-/wwwroot/Assets/data/scanSortData.js` |
| **Dùng cho trang** | `Components/Pages/ProductManagement.razor` |
| **Route** | `/product-management` |
| **Nội dung** | Kiện hàng đã quét mã, phân loại Nội tỉnh / Liên tỉnh, khu vực đích (A/B/C/D) |

**Cấu trúc `ScanSortRecord`:**
```js
{
  barcode:    string,   // "VN0001234567"
  packageId:  string,   // "PKG-2024-0001"
  sender:     string,
  receiver:   string,
  originCity: string,
  destCity:   string,
  category:   "Nội tỉnh" | "Liên tỉnh",
  sortZone:   "A" | "B" | "C" | "D",
  weightKg:   number,
  scannedAt:  string,   // ISO 8601
  status:     "Đã phân loại" | "Chờ phân loại" | "Lỗi quét"
}
```

**Hàm tiện ích có sẵn:**
```js
getAllScanSortRecords()                          // → ScanSortRecord[]
getScanSortRecordsByCategory("Nội tỉnh")        // → ScanSortRecord[]
getScanSortRecordsByZone("A")                   // → ScanSortRecord[]
getScanSortSummary()                            // → { noiTinh, lienTinh, total }
```

---

## 3. Các thay đổi đã thực hiện

### 3.1 Loại bỏ hoạt ảnh khi chuyển tab
- **`Components/Routes.razor`** — Xoá `<FocusOnNavigate>` (nguyên nhân gây hiệu ứng "nhảy" chữ khi chuyển trang)
- **`wwwroot/app.css`** — Thêm `animation: none !important` cho `main > div > div` và xoá `outline` của `h1` để tránh nhấp nháy khi focus

### 3.2 Sửa lỗi Import/Export dùng chung một route
- **Trước:** Cả Import và Export đều trỏ đến `/warehouse-import-export`
- **Sau:**
  - `Quản lý Nhập` → `/warehouse-import-export` (`WarehouseImportExport.razor`)
  - `Quản lý Xuất` → `/warehouse-export` (file mới: `WarehouseExport.razor`)
- **`Components/Layout/NavMenu.razor`** — Cập nhật link, icon và tên hiển thị

### 3.3 Nội dung tab Quản lý Nhập kho
- **`Components/Pages/WarehouseImportExport.razor`** — Viết lại hoàn toàn:
  - 4 card trạng thái Dock (Dock 1–4) với số pallet và nhà cung cấp
  - Ô quét mã vạch kèm dropdown chọn Dock
  - Bảng nhập kho chi tiết (mã phiếu, lô hàng, Dock, nhà cung cấp, số pallet/kiện, trạng thái)
  - Footer tổng hợp (tổng pallet, kiện, lô chờ phân loại)

### 3.4 Tab Product → Quản lý Quét mã & Phân loại
- **`Components/Pages/ProductManagement.razor`** — Viết lại hoàn toàn:
  - Đổi tên trang thành "Quản lý Quét mã & Phân loại"
  - 4 stat card: Tổng đã quét / Nội tỉnh / Liên tỉnh / Chờ phân loại
  - Bộ lọc theo loại (Nội tỉnh / Liên tỉnh / Tất cả)
  - Bảng hiển thị: mã vạch, mã kiện, người gửi/nhận, tỉnh gốc/đích, loại hàng (badge màu), khu phân loại (A/B/C/D), trọng lượng, trạng thái
- **`Components/Layout/NavMenu.razor`** — Đổi icon thành `qr_code_scanner`, nhãn thành "Quét mã & Phân loại"

---

## 4. Hướng dẫn tích hợp dữ liệu JS vào Blazor (nếu cần nâng cấp)

Để các file `.js` trong `wwwroot/Assets/data/` được Blazor gọi thực sự (thay vì HTML tĩnh), dùng **JS Interop**:

```csharp
// Trong file .razor
@inject IJSRuntime JS

@code {
    private ImportRecord[] records = [];

    protected override async Task OnInitializedAsync()
    {
        records = await JS.InvokeAsync<ImportRecord[]>("getAllImportRecords");
    }
}
```

Kèm thêm thẻ `<script>` trong `App.razor`:
```html
<script src="Assets/data/importData.js"></script>
```

---

## 5. Lệnh build & chạy local

```bash
cd WMS-
dotnet run
# Truy cập: https://localhost:PORT/dashboard
```
