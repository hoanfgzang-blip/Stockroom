# Kế Hoạch Phân Chia Công Việc - Dự Án Warehouse Management System

Tài liệu này phân tích cấu trúc dự án WMS hiện tại và phân chia công việc chi tiết cho nhóm 3 lập trình viên. Mỗi lập trình viên phụ trách đúng 4 nhiệm vụ cụ thể để đảm bảo tính độc lập, chuyên môn hóa nghiệp vụ và giảm thiểu xung đột mã nguồn.

---

## 📌 Tổng Quan Kiến Trúc Dự Án WMS
*   **Database:** Quản lý qua file SQL cài đặt và Entity Framework Core Migrations.
*   **Backend:** Thư mục WMS- con chứa DbContext, các Entity và các REST API Controller.
*   **Frontend:** Thư mục frontend chứa mã nguồn giao diện React, TypeScript kết nối API qua Axios Client.

---

## 🗂️ Sơ Đồ Phân Chia Vai Trò Nhóm 3 Người

```text
                     HỆ THỐNG QUẢN LÝ KHO WMS
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 LẬP TRÌNH VIÊN A        LẬP TRÌNH VIÊN B        LẬP TRÌNH VIÊN C
  Phân Khu Nhập           Quản Lý Kho           Xuất Kho & Vận Tải
        │                       │                       │
        ├─ Đơn nhập             ├─ Phân khu             ├─ Đơn xuất
        ├─ Bao hàng nhập        ├─ Pallet               ├─ Giữ chỗ tồn kho
        ├─ Tuyến đường          ├─ Xếp hàng kệ          ├─ Đội xe tải
        └─ Next Hop tự động     └─ Nhật ký di chuyển    └─ Chuyến xe gom hàng
```

### Bảng Phân Chia Đầu Việc Chi Tiết

| Lập Trình Viên A | Lập Trình Viên B | Lập Trình Viên C |
| :--- | :--- | :--- |
| **Phân Khu Nhập** | **Quản Lý Kho** | **Xuất Kho & Vận Tải** |
| 1. Quản lý đơn nhập kho | 1. Quản lý phân khu | 1. Quản lý đơn xuất kho |
| 2. Xử lý bao hàng nhập | 2. Quản lý pallet | 2. Tạm giữ tồn kho |
| 3. Cấu hình tuyến đường | 3. Logic xếp hàng lên kệ | 3. Quản lý đội xe tải |
| 4. Next Hop tự động | 4. Nhật ký di chuyển | 4. Điều phối chuyến xe |

---

## 👤 LẬP TRÌNH VIÊN A: PHÂN KHU NHẬP KHO & ĐỊNH TUYẾN

### 📋 Nhiệm Vụ 1: Quản Lý Đơn Nhập Kho
*   **Mô tả:** Tạo và quản lý các yêu cầu nhập hàng từ các nhà cung cấp bên ngoài.
*   **Các Thực Thể Liên Quan:** `InboundOrder`.
*   **Công Cụ Sử Dụng:** Backend Service, API Controller, React.
*   **Công Việc Cụ Thể:**
    1. Viết API thêm mới, sửa đổi và xóa đơn nhập kho.
    2. Cập nhật trạng thái đơn nhập từ đang xử lý sang hoàn thành.
    3. Thiết kế giao diện danh sách đơn nhập kho trên giao diện người dùng.
*   **Mục Tiêu Cuối Cùng:** Tạo và lưu trữ thông tin đơn nhập kho thành công trong cơ sở dữ liệu.

### 📋 Nhiệm Vụ 2: Xử Lý Bao Hàng Nhập
*   **Mô tả:** Quản lý chi tiết danh sách bao hàng gắn liền với từng đơn nhập.
*   **Các Thực Thể Liên Quan:** `InboundOrderItem`, `Sack`.
*   **Công Việc Cụ Thể:**
    1. Viết dịch vụ liên kết bao hàng vào chi tiết đơn nhập.
    2. Tự động chuyển trạng thái bao hàng thành đang phân loại khi đơn nhập bắt đầu xử lý.
    3. Hiển thị danh sách bao hàng của đơn nhập trên màn hình chi tiết.
*   **Mục Tiêu Cuối Cùng:** Khai báo đầy đủ danh sách bao hàng thực tế khi nhập kho.

### 📋 Nhiệm Vụ 3: Cấu Hình Tuyến Đường Vận Chuyển
*   **Mô tả:** Thiết lập quy tắc chuyển tiếp bao hàng giữa các kho trung chuyển.
*   **Các Thực Thể Liên Quan:** `RoutingRule`.
*   **Công Việc Cụ Thể:**
    1. Viết API CRUD cấu hình định tuyến cho bưu cục.
    2. Thiết lập ràng buộc duy nhất giữa bưu cục hiện tại và tỉnh thành đích để tránh cấu hình trùng lặp.
    3. Thiết kế màn hình thiết lập tuyến đường trên giao diện.
*   **Mục Tiêu Cuối Cùng:** Lưu trữ thành công sơ đồ chuyển tiếp hàng hóa của toàn hệ thống.

### 📋 Nhiệm Vụ 4: Tự Động Xác Định Next Hop
*   **Mô tả:** Tự động tìm kiếm chặng đi tiếp theo cho bao hàng dựa vào tỉnh thành đích khi quét bưu kiện.
*   **Các Thực Thể Liên Quan:** `RoutingRule`, `Sack`, `Location`, `Province`.
*   **Công Việc Cụ Thể:**
    1. Viết hàm tra cứu chặng kế tiếp dựa vào kho hiện hành và địa chỉ đích của bao hàng.
    2. Trả về thông tin bưu cục chặng kế tiếp để thông báo cho nhân viên phân loại.
*   **Mục Tiêu Cuối Cùng:** Tự động hóa việc phân luồng bao hàng tại khu vực phân loại mà không cần nhân viên tra cứu thủ công.

---

## 👤 LẬP TRÌNH VIÊN B: QUẢN LÝ LƯU TRỮ & HẠ TẦNG KHO

### 📋 Nhiệm Vụ 1: Quản Lý Phân Khu Kho
*   **Mô tả:** Quản lý cấu trúc các phân khu vận hành vật lý trong bưu cục hoặc kho trung chuyển.
*   **Các Thực Thể Liên Quan:** `Zone`.
*   **Công Cụ Sử Dụng:** Backend Service, API Controller, React.
*   **Công Việc Cụ Thể:**
    1. Tạo API quản lý thông tin phân khu kho bao gồm tên phân khu, loại phân khu và sức chứa tối đa.
    2. Thiết kế giao diện hiển thị danh sách phân khu kèm biểu đồ sức chứa hiện tại.
*   **Mục Tiêu Cuối Cùng:** Định nghĩa đầy đủ các vùng không gian lưu trữ trong kho trên hệ thống.

### 📋 Nhiệm Vụ 2: Quản Lý Pallet
*   **Mô tả:** Quản lý danh sách các pallet đặt tại từng phân khu để chứa bao hàng.
*   **Các Thực Thể Liên Quan:** `Pallet`.
*   **Công Việc Cụ Thể:**
    1. Tạo API CRUD cho các pallet, tự động thiết lập trạng thái ban đầu là trống.
    2. Thiết kế giao diện danh sách pallet trong phân khu và hiển thị trạng thái của từng pallet.
*   **Mục Tiêu Cuối Cùng:** Kiểm soát số lượng và vị trí các kệ chứa hàng trên hệ thống.

### 📋 Nhiệm Vụ 3: Logic Xếp Hàng Lên Kệ
*   **Mô tả:** Đưa các bao hàng đã phân loại lên pallet tương ứng trong kho và kiểm soát sức chứa thực tế.
*   **Các Thực Thể Liên Quan:** `Sack`, `Pallet`, `Zone`.
*   **Công Việc Cụ Thể:**
    1. Viết hàm gán bao hàng vào pallet, đổi trạng thái bao hàng thành đã lưu kho.
    2. Kiểm tra giới hạn sức chứa của pallet và phân khu trước khi thực hiện xếp hàng.
    3. Cập nhật trạng thái pallet sang đang xếp hàng hoặc đã đầy khi số lượng thay đổi.
*   **Mục Tiêu Cuối Cùng:** Thực hiện giao dịch xếp hàng lên kệ kho chính xác, không vượt tải trọng cho phép.

### 📋 Nhiệm Vụ 4: Nhật Ký Di Chuyển Hàng
*   **Mô tả:** Tự động ghi nhận thông tin lịch sử thay đổi vị trí của các bao hàng trong kho để kiểm toán.
*   **Các Thực Thể Liên Quan:** `AuditLog`.
*   **Công Việc Cụ Thể:**
    1. Tích hợp ghi nhật ký hệ thống vào dịch vụ lưu kho, lưu trữ giá trị cũ và giá trị mới của bao hàng hoặc kệ hàng.
    2. Tạo màn hình hiển thị lịch sử thao tác của thủ kho trên giao diện.
*   **Mục Tiêu Cuối Cùng:** Bảo đảm tính minh bạch, ghi nhận chính xác thời gian và nhân sự thực hiện dịch chuyển hàng.

---

## 👤 LẬP TRÌNH VIÊN C: XUẤT KHO & VẬN TẢI ĐỘI XE

### 📋 Nhiệm Vụ 1: Quản Lý Đơn Xuất Kho
*   **Mô tả:** Tạo mới và xử lý yêu cầu vận chuyển hàng hóa đi tới các đại lý hoặc kho hàng khác.
*   **Các Thực Thể Liên Quan:** `OutboundOrder`, `OutboundOrderItem`.
*   **Công Cụ Sử Dụng:** Backend Service, API Controller, React.
*   **Công Việc Cụ Thể:**
    1. Xây dựng dịch vụ thêm mới, sửa đổi và xóa đơn xuất kho.
    2. Quản lý liên kết bao hàng cần xuất với đơn xuất tương ứng.
    3. Thiết kế màn hình quản lý đơn xuất kho trên giao diện người dùng.
*   **Mục Tiêu Cuối Cùng:** Tạo và xuất thành công danh sách bao hàng theo yêu cầu đơn hàng.

### 📋 Nhiệm Vụ 2: Tạm Giữ Tồn Kho
*   **Mô tả:** Khóa tạm thời bao hàng trong kho khi tạo đơn xuất để tránh tình trạng xuất trùng lặp.
*   **Các Thực Thể Liên Quan:** `InventoryReservation`, `Sack`.
*   **Công Việc Cụ Thể:**
    1. Viết hàm tạo bản ghi tạm giữ bao hàng với thời gian hết hạn và cơ chế chặn đặt trùng bao hàng.
    2. Thiết lập tác vụ chạy ngầm định kỳ quét và giải phóng các bao hàng bị tạm giữ quá hạn mà đơn hàng chưa hoàn thành.
    3. Hiển thị danh sách bao hàng đang bị tạm giữ tồn kho trên màn hình quản lý.
*   **Mục Tiêu Cuối Cùng:** Đảm bảo bao hàng xuất đi được giữ chỗ an toàn và khôi phục khi đơn hàng bị hủy.

### 📋 Nhiệm Vụ 3: Quản Lý Đội Xe Tải
*   **Mô tả:** Quản lý danh sách phương tiện vận chuyển và tải trọng giới hạn của từng xe.
*   **Các Thực Thể Liên Quan:** `Car`.
*   **Công Việc Cụ Thể:**
    1. Viết API CRUD quản lý danh sách xe tải vận chuyển, bao gồm biển số xe, loại xe và tải trọng tối đa.
    2. Thiết kế giao diện danh sách xe tải kèm trạng thái hoạt động và tải trọng khả dụng.
*   **Mục Tiêu Cuối Cùng:** Quản lý và theo dõi hiệu năng của đội xe phân phối.

### 📋 Nhiệm Vụ 4: Điều Phối Chuyến Xe
*   **Mô tả:** Gom các bao hàng đã xuất kho chất xếp lên xe tải tương ứng và gán tài xế thực hiện chuyến đi.
*   **Các Thực Thể Liên Quan:** `Trip`, `Sack`, `Employee`.
*   **Công Việc Cụ Thể:**
    1. Viết API tạo chuyến xe, gán tài xế, gán phương tiện và kiểm tra tổng tải trọng bao hàng không vượt quá sức chứa của xe.
    2. Cập nhật trạng thái chuyến xe và tự động chuyển đổi trạng thái bao hàng thành đã giao hàng khi xe đến nơi.
    3. Thiết kế màn hình gom hàng và gán chuyến đi trên giao diện.
*   **Mục Tiêu Cuối Cùng:** Điều phối chuyến đi tối ưu hóa tải trọng và cập nhật hành trình giao nhận hàng tự động.

---

## 🤝 Quy Tắc Phối Hợp Nhóm

1.  **Thiết kế Interface trước khi code logic:** Trước khi bắt tay vào code cụ thể, các thành viên cần thống nhất và tạo sẵn các file Interface trong thư mục `Services/Interfaces/`. Điều này giúp các thành viên có thể gọi các phương thức của nhau mà không cần đợi đối phương viết xong code thực tế.
2.  **Không tự ý sửa Database Schema:** Bất kỳ sự thay đổi nào về bảng dữ liệu cần được thảo luận trước với cả nhóm và tạo Migration hợp lệ.
3.  **Quy trình Git:**
    *   Mỗi người làm việc trên một nhánh riêng.
    *   Tạo Pull Request để người khác review trước khi merge vào nhánh `main`.
