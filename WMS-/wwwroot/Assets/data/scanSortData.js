/**
 * scanSortData.js
 * Dữ liệu bảng Quản lý Quét mã & Phân loại
 * Hiển thị các hàng được phân loại: Nội tỉnh | Liên tỉnh
 */

/** @typedef {Object} ScanSortRecord
 * @property {string}   barcode       - Mã vạch / mã quét
 * @property {string}   packageId     - Mã kiện hàng
 * @property {string}   sender        - Người gửi
 * @property {string}   receiver      - Người nhận
 * @property {string}   originCity    - Tỉnh/TP gốc
 * @property {string}   destCity      - Tỉnh/TP đích
 * @property {"Nội tỉnh"|"Liên tỉnh"} category - Loại hàng
 * @property {string}   sortZone      - Khu vực đích: A | B | C | D
 * @property {number}   weightKg      - Trọng lượng (kg)
 * @property {string}   scannedAt     - Thời điểm quét (ISO 8601)
 * @property {"Đã phân loại"|"Chờ phân loại"|"Lỗi quét"} status - Trạng thái
 */

/** @type {ScanSortRecord[]} */
const scanSortRecords = [
    {
        barcode: "VN0001234567",
        packageId: "PKG-2024-0001",
        sender: "Nguyễn Văn Hùng",
        receiver: "Trần Thị Mai",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Quận 7, TP. HCM",
        category: "Nội tỉnh",
        sortZone: "A",
        weightKg: 1.5,
        scannedAt: "2024-06-11T07:45:00+07:00",
        status: "Đã phân loại"
    },
    {
        barcode: "VN0001234568",
        packageId: "PKG-2024-0002",
        sender: "Lê Văn Dũng",
        receiver: "Phạm Thị Lan",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Hà Nội",
        category: "Liên tỉnh",
        sortZone: "B",
        weightKg: 3.2,
        scannedAt: "2024-06-11T07:52:00+07:00",
        status: "Đã phân loại"
    },
    {
        barcode: "VN0001234569",
        packageId: "PKG-2024-0003",
        sender: "Hoàng Anh Tuấn",
        receiver: "Đinh Văn Nam",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Đà Nẵng",
        category: "Liên tỉnh",
        sortZone: "B",
        weightKg: 0.8,
        scannedAt: "2024-06-11T08:01:00+07:00",
        status: "Đã phân loại"
    },
    {
        barcode: "VN0001234570",
        packageId: "PKG-2024-0004",
        sender: "Vũ Thị Hà",
        receiver: "Ngô Văn Bình",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Bình Thạnh, TP. HCM",
        category: "Nội tỉnh",
        sortZone: "A",
        weightKg: 2.1,
        scannedAt: "2024-06-11T08:10:00+07:00",
        status: "Đã phân loại"
    },
    {
        barcode: "VN0001234571",
        packageId: "PKG-2024-0005",
        sender: "Trịnh Văn Cường",
        receiver: "Bùi Thị Thu",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Cần Thơ",
        category: "Liên tỉnh",
        sortZone: "C",
        weightKg: 5.4,
        scannedAt: "2024-06-11T08:18:00+07:00",
        status: "Đã phân loại"
    },
    {
        barcode: "VN0001234572",
        packageId: "PKG-2024-0006",
        sender: "Đặng Hữu Nghĩa",
        receiver: "Lý Thị Xuân",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Thủ Đức, TP. HCM",
        category: "Nội tỉnh",
        sortZone: "A",
        weightKg: 1.0,
        scannedAt: "2024-06-11T08:25:00+07:00",
        status: "Chờ phân loại"
    },
    {
        barcode: "VN0001234573",
        packageId: "PKG-2024-0007",
        sender: "Phan Văn Đạt",
        receiver: "Cao Thị Thảo",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Huế",
        category: "Liên tỉnh",
        sortZone: "D",
        weightKg: 4.7,
        scannedAt: "2024-06-11T08:30:00+07:00",
        status: "Chờ phân loại"
    },
    {
        barcode: "VN0001234574",
        packageId: "PKG-2024-0008",
        sender: "Tô Thanh Hải",
        receiver: "Lưu Thị Bích",
        originCity: "TP. Hồ Chí Minh",
        destCity: "Gò Vấp, TP. HCM",
        category: "Nội tỉnh",
        sortZone: "A",
        weightKg: 0.5,
        scannedAt: "2024-06-11T08:40:00+07:00",
        status: "Lỗi quét"
    }
];

/**
 * Lấy tất cả bản ghi quét mã và phân loại
 * @returns {ScanSortRecord[]}
 */
function getAllScanSortRecords() {
    return scanSortRecords;
}

/**
 * Lọc bản ghi theo loại hàng
 * @param {"Nội tỉnh"|"Liên tỉnh"} category
 * @returns {ScanSortRecord[]}
 */
function getScanSortRecordsByCategory(category) {
    return scanSortRecords.filter(r => r.category === category);
}

/**
 * Lọc bản ghi theo khu vực phân loại
 * @param {"A"|"B"|"C"|"D"} zone
 * @returns {ScanSortRecord[]}
 */
function getScanSortRecordsByZone(zone) {
    return scanSortRecords.filter(r => r.sortZone === zone);
}

/**
 * Thống kê tổng hợp
 * @returns {{ noiTinh: number, lienTinh: number, total: number }}
 */
function getScanSortSummary() {
    const noiTinh = scanSortRecords.filter(r => r.category === "Nội tỉnh").length;
    const lienTinh = scanSortRecords.filter(r => r.category === "Liên tỉnh").length;
    return { noiTinh, lienTinh, total: scanSortRecords.length };
}

// Export cho dùng trong môi trường module (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        scanSortRecords,
        getAllScanSortRecords,
        getScanSortRecordsByCategory,
        getScanSortRecordsByZone,
        getScanSortSummary
    };
}
