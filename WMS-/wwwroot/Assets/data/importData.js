/**
 * importData.js
 * Dữ liệu bảng Quản lý Nhập kho
 * Khu vực: Hàng chờ phân loại & Tiếp nhận dỡ hàng từ Dock 1 đến Dock 4
 */

/** @typedef {Object} ImportRecord
 * @property {string} id           - Mã phiếu nhập
 * @property {string} shipmentCode - Mã lô hàng
 * @property {string} dock         - Dock tiếp nhận (Dock 1 | Dock 2 | Dock 3 | Dock 4)
 * @property {string} supplier     - Nhà cung cấp
 * @property {string} description  - Mô tả hàng hoá
 * @property {number} totalPallets - Tổng số pallet
 * @property {number} totalPkgs    - Tổng số kiện
 * @property {string} arrivalTime  - Thời gian dỡ hàng (ISO 8601)
 * @property {string} status       - Trạng thái: "Chờ phân loại" | "Đang dỡ hàng" | "Hoàn thành"
 * @property {string} zone         - Khu vực lưu tạm: "Hàng chờ PL" | "Khu phân loại" | ...
 */

/** @type {ImportRecord[]} */
const importRecords = [
    {
        id: "IMP-2024-0001",
        shipmentCode: "SHP-DA-001",
        dock: "Dock 1",
        supplier: "Tổng công ty Bưu chính Việt Nam",
        description: "Bưu phẩm nội địa, gói nhỏ dưới 5kg",
        totalPallets: 8,
        totalPkgs: 320,
        arrivalTime: "2024-06-11T07:30:00+07:00",
        status: "Hoàn thành",
        zone: "Khu phân loại"
    },
    {
        id: "IMP-2024-0002",
        shipmentCode: "SHP-DB-002",
        dock: "Dock 2",
        supplier: "Công ty Giao Hàng Nhanh (GHN)",
        description: "Hàng thương mại điện tử, hàng hóa thông thường",
        totalPallets: 12,
        totalPkgs: 480,
        arrivalTime: "2024-06-11T08:00:00+07:00",
        status: "Đang dỡ hàng",
        zone: "Hàng chờ PL"
    },
    {
        id: "IMP-2024-0003",
        shipmentCode: "SHP-DC-003",
        dock: "Dock 3",
        supplier: "Công ty TNHH Viettel Post",
        description: "Bưu kiện liên tỉnh, hàng điện tử",
        totalPallets: 6,
        totalPkgs: 210,
        arrivalTime: "2024-06-11T08:45:00+07:00",
        status: "Chờ phân loại",
        zone: "Hàng chờ PL"
    },
    {
        id: "IMP-2024-0004",
        shipmentCode: "SHP-DD-004",
        dock: "Dock 4",
        supplier: "DHL Express Vietnam",
        description: "Hàng nhập khẩu, tài liệu thương mại",
        totalPallets: 4,
        totalPkgs: 95,
        arrivalTime: "2024-06-11T09:15:00+07:00",
        status: "Chờ phân loại",
        zone: "Hàng chờ PL"
    },
    {
        id: "IMP-2024-0005",
        shipmentCode: "SHP-DA-005",
        dock: "Dock 1",
        supplier: "J&T Express Vietnam",
        description: "Hàng thời trang, phụ kiện",
        totalPallets: 10,
        totalPkgs: 400,
        arrivalTime: "2024-06-11T10:00:00+07:00",
        status: "Đang dỡ hàng",
        zone: "Hàng chờ PL"
    },
    {
        id: "IMP-2024-0006",
        shipmentCode: "SHP-DB-006",
        dock: "Dock 2",
        supplier: "Ninja Van Vietnam",
        description: "Hàng gia dụng, thiết bị nhà bếp",
        totalPallets: 7,
        totalPkgs: 280,
        arrivalTime: "2024-06-11T10:30:00+07:00",
        status: "Hoàn thành",
        zone: "Khu phân loại"
    }
];

/**
 * Lấy tất cả bản ghi nhập kho
 * @returns {ImportRecord[]}
 */
function getAllImportRecords() {
    return importRecords;
}

/**
 * Lọc bản ghi theo Dock
 * @param {"Dock 1"|"Dock 2"|"Dock 3"|"Dock 4"} dock
 * @returns {ImportRecord[]}
 */
function getImportRecordsByDock(dock) {
    return importRecords.filter(r => r.dock === dock);
}

/**
 * Lọc bản ghi theo trạng thái
 * @param {"Chờ phân loại"|"Đang dỡ hàng"|"Hoàn thành"} status
 * @returns {ImportRecord[]}
 */
function getImportRecordsByStatus(status) {
    return importRecords.filter(r => r.status === status);
}

// Export cho dùng trong môi trường module (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { importRecords, getAllImportRecords, getImportRecordsByDock, getImportRecordsByStatus };
}
