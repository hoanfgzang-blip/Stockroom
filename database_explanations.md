# Tài Liệu Giải Thích Ý Nghĩa Các Bảng Cơ Sở Dữ Liệu - WMS & Logistics

Tài liệu này giải thích chi tiết ý nghĩa, mục đích sử dụng và các mối liên kết của tất cả 16 bảng dữ liệu trong hệ thống tích hợp Quản lý kho hàng - WMS và Mạng lưới vận chuyển - Logistics. Đơn vị theo dõi cốt lõi của toàn hệ thống là Bao hàng - Sack.

---

## 1. Nhóm Địa Lý & Tổ Chức Kho - Topology

### 1.1 Bảng `province` - Tỉnh thành
* **Ý nghĩa**: Quản lý danh mục các tỉnh thành trong phạm vi hoạt động của mạng lưới logistics.
* **Các trường dữ liệu**:
  * `province_id` - Khóa chính: Mã định danh tỉnh thành, ví dụ: `HN`, `HCM`, `DN`.
  * `province_name`: Tên tỉnh thành hoặc khu vực tương ứng.

### 1.2 Bảng `location` - Địa điểm / Hub trung chuyển / Bưu cục
* **Ý nghĩa**: Đại diện cho mỗi điểm nút hoạt động - Node trong mạng lưới giao nhận hoặc các tổng kho chứa hàng.
* **Các trường dữ liệu**:
  * `location_id` - Khóa chính: Mã địa điểm duy nhất, ví dụ: `HUB_LONG_BIEN`, `KHO_WMS_DONG_NAI`.
  * `province_id` - Khóa ngoại: Thuộc tỉnh thành nào.
  * `location_type`: Phân loại nút hoạt động - `Warehouse` - Kho hàng, `SortingCenter` - Trung tâm phân loại, `PostOffice` - Bưu cục.
  * `location_name`: Tên chi tiết của chi nhánh hoặc bưu cục.

### 1.3 Bảng `zone` - Phân khu vận hành
* **Ý nghĩa**: Phân chia chi tiết không gian hoạt động bên trong một Địa điểm - Location.
* **Các trường dữ liệu**:
  * `zone_id` - Khóa chính: Mã phân khu duy nhất.
  * `location_id` - Khóa ngoại: Thuộc địa điểm hoặc bưu cục nào.
  * `zone_name`: Tên phân khu, ví dụ: Cửa dỡ hàng Inbound, Kệ lưu kho Zone A, Khu phân loại hàng đi liên tỉnh.
  * `zone_type`: Loại phân khu - `Storage` - Lưu trữ, `Sorting` - Phân loại, `Dock` - Cửa tải hoặc dỡ hàng.
  * `capacity`: Sức chứa tối đa của phân khu.

### 1.4 Bảng `pallet` - Pallet chứa hàng
* **Ý nghĩa**: Quản lý tấm pallet lưu trữ trong các phân khu của kho để xếp dỡ sản phẩm dễ dàng.
* **Các trường dữ liệu**:
  * `pallet_id` - Khóa chính: Mã pallet duy nhất dán trên nhãn.
  * `zone_id` - Khóa ngoại: Nằm tại phân khu chức năng nào trong kho.
  * `status`: Trạng thái pallet - `Empty` - Trống, `Loaded` - Đang chứa hàng, `Damaged` - Bị hỏng.
  * `capacity`: Tải trọng tối đa cho phép của pallet tính bằng kg.

---

## 2. Nhóm Nhân Sự & Ca Làm Việc - Staff

### 2.1 Bảng `shift` - Ca làm việc
* **Ý nghĩa**: Quản lý các khung giờ hoạt động định kỳ của nhân sự vận hành.
* **Các trường dữ liệu**:
  * `shift_id` - Khóa chính: Mã ca làm việc, ví dụ: `CA_1`, `CA_2`, `CA_3`.
  * `shift_name`: Tên ca trực, ví dụ: Ca sáng, Ca chiều, Ca đêm.
  * `start_at`: Thời gian bắt đầu ca.
  * `end_at`: Thời gian kết thúc ca.

### 2.2 Bảng `employee` - Nhân viên
* **Ý nghĩa**: Danh sách nhân sự vận hành kho bãi, phân loại, bốc xếp hoặc lái xe giao hàng.
* **Các trường dữ liệu**:
  * `employee_id` - Khóa chính: Mã số nhân viên.
  * `employee_name`: Tên đầy đủ của nhân viên.
  * `role_name`: Vai trò vận hành - `Driver` - Lái xe, `Sorter` - Phân loại hàng, `Storekeeper` - Thủ kho, `Manager` - Quản lý.
  * `location_id` - Khóa ngoại, tùy chọn: Nơi làm việc chính của nhân viên, có thể để trống đối với tài xế tự do toàn hệ thống.
  * `zone_id` - Khóa ngoại, tùy chọn: Phân khu làm việc trực tiếp nếu có.
  * `shift_id` - Khóa ngoại: Ca làm việc hiện tại của nhân viên.

---

## 3. Nhóm Đội Xe & Vận Chuyển Hàng Hóa - Transport

### 3.1 Bảng `car` - Phương tiện vận chuyển
* **Ý nghĩa**: Quản lý đội xe tải hoặc các phương tiện vận chuyển hàng hóa giữa các kho hoặc hub.
* **Các trường dữ liệu**:
  * `car_id` - Khóa chính: Biển kiểm soát hoặc mã số xe tải.
  * `type`: Phân loại xe, ví dụ: Xe tải 5 tấn, Xe tải 10 tấn, Container.
  * `capacity`: Tải trọng tối đa xe có thể chở tính bằng kg.

### 3.2 Bảng `trip` - Chuyến xe vận chuyển
* **Ý nghĩa**: Hành trình di chuyển hàng hóa thực tế từ một bưu cục hoặc kho đi tới bưu cục hoặc kho khác.
* **Các trường dữ liệu**:
  * `trip_id` - Khóa chính: Mã chuyến đi.
  * `employee_id` - Khóa ngoại: Tài xế lái xe cho chuyến đi này.
  * `car_id` - Khóa ngoại: Xe tải được điều động sử dụng.
  * `origin` - Khóa ngoại -> Location: Địa điểm xuất phát.
  * `destination` - Khóa ngoại -> Location: Địa điểm đến dự kiến.
  * `type`: Loại tuyến đường - `Inter-provincial` - Liên tỉnh, `Inner-city` - Nội tỉnh.
  * `status`: Trạng thái hành trình - `Pending` - Chờ xuất phát, `InTransit` - Đang trên đường, `Completed` - Đã đến đích.
  * `created_at`: Giờ xe xuất phát thực tế.
  * `end_at`: Giờ xe cập bến.

### 3.3 Bảng `sack` - Bao hàng vận chuyển
* **Ý nghĩa**: Bao chứa đóng gói niêm phong. Đây là đơn vị lưu kho và phân phối cốt lõi của hệ thống thay thế cho sản phẩm lẻ.
* **Các trường dữ liệu**:
  * `sack_id` - Khóa chính: Mã số bao hàng.
  * `trip_id` - Khóa ngoại, tùy chọn: Chuyến xe đang chuyên chở bao hàng này, bằng NULL nếu đang lưu trữ tại hub.
  * `pallet_id` - Khóa ngoại, tùy chọn: Pallet lưu giữ bao hàng trong phân khu kho.
  * `status`: Trạng thái bao hàng - `Sorting` - Đang gom hàng, `Sealed` - Đã niêm phong, `InTransit` - Đang đi đường, `Received` - Đã nhận tại trạm đích.
  * `zone_id` - Khóa ngoại: Phân khu lưu giữ bao hàng hiện tại.
  * `s_destination` - Khóa ngoại -> Location: Điểm đến cuối cùng của bao hàng.
  * `created_at`: Thời gian đóng bao hàng.
  * `end_at`: Thời gian mở bao hàng để chia chọn.

---

## 4. Nhóm Định Tuyến Phân Luồng - Routing

### 4.1 Bảng `routing_rule` - Quy tắc định tuyến
* **Ý nghĩa**: Định nghĩa logic phân luồng tự động cho bao hàng.
* **Các trường dữ liệu**:
  * `rule_id` - Khóa chính: Mã quy tắc định tuyến.
  * `current_location` - Khóa ngoại -> Location: Trạm hiện tại mà bao hàng đang nằm.
  * `c_destination` - Khóa ngoại -> Province: Tỉnh thành đích cuối cùng của bao hàng.
  * `next_hop` - Khóa ngoại -> Location: Trạm trung chuyển tiếp theo cần gửi hàng tới.

---

## 5. Nhóm Nhập - Xuất Kho & Giữ Chỗ - Operations

### 5.1 Bảng `inbound_order` - Đơn nhập kho
* **Ý nghĩa**: Lập phiếu dự kiến nhận các bao hàng nhập vào từ chi nhánh hoặc nhà cung cấp.
* **Các trường dữ liệu**:
  * `inbound_order_id` - Khóa chính: ID đơn nhập.
  * `order_number`: Mã số đơn nhập.
  * `supplier_name`: Tên đơn vị bàn giao.
  * `status`: Trạng thái đơn nhập - `Pending` - Đang chờ nhận, `Completed` - Đã nhập kho thành công.
  * `created_at`: Ngày tạo đơn.

### 5.2 Bảng `inbound_order_item` - Chi tiết đơn nhập
* **Ý nghĩa**: Chi tiết các bao hàng cụ thể cần nhập trong đơn hàng.
* **Các trường dữ liệu**:
  * `inbound_order_item_id` - Khóa chính: ID dòng chi tiết.
  * `inbound_order_id` - Khóa ngoại: Thuộc đơn nhập nào.
  * `sack_id` - Khóa ngoại: Mã bao hàng cần nhập.

### 5.3 Bảng `outbound_order` - Đơn xuất kho
* **Ý nghĩa**: Đơn xuất các bao hàng từ kho gửi đi cho các bưu cục khác hoặc khách hàng nhận cuối.
* **Các trường dữ liệu**:
  * `outbound_order_id` - Khóa chính: ID đơn xuất.
  * `order_number`: Mã số đơn xuất.
  * `customer_name`: Tên người nhận hoặc đơn vị nhận bàn giao bao hàng.
  * `destination` - Khóa ngoại -> Location: Bưu cục hoặc Địa điểm nhận hàng bàn giao.
  * `status`: Trạng thái xử lý - `Pending`, `Processing` - Đang gom hàng, `Completed` - Đã xuất xong.
  * `created_at`: Ngày tạo đơn xuất.

### 6.4 Bảng `outbound_order_item` - Chi tiết đơn xuất
* **Ý nghĩa**: Chi tiết các bao hàng cần xuất trong đơn hàng.
* **Các trường dữ liệu**:
  * `outbound_order_item_id` - Khóa chính: ID dòng chi tiết.
  * `outbound_order_id` - Khóa ngoại: Thuộc đơn xuất nào.
  * `sack_id` - Khóa ngoại: Bao hàng cần xuất.

### 6.5 Bảng `inventory_reservation` - Giữ chỗ bao hàng tạm thời
* **Ý nghĩa**: Khóa giữ các bao hàng trong vòng 12 tiếng để phục vụ đóng xe vận chuyển, tránh bị các đơn khác lấy mất.
* **Các trường dữ liệu**:
  * `reservation_id` - Khóa chính: ID giao dịch khóa hàng.
  * `outbound_order_id` - Khóa ngoại: Giữ hàng cho đơn xuất nào.
  * `sack_id` - Khóa ngoại: Giữ bao hàng nào.
  * `reserved_at`: Giờ bắt đầu khóa hàng.
  * `expires_at`: Giờ hết hạn giữ chỗ, mặc định bằng reserved_at cộng 12 tiếng.
  * `status`: Trạng thái khóa - `Active` - Đang tạm giữ, `Completed` - Đã xuất xong, `Expired` - Quá 12h chưa xuất xe nên tự động nhả bao hàng về kho.

---

## 6. Nhóm Nhật Ký Hệ Thống - Audit Security

### 6.1 Bảng `audit_log` - Nhật ký hệ thống
* **Ý nghĩa**: Ghi lại lịch sử chỉnh sửa dữ liệu để phục vụ công tác giám sát, bảo mật và thanh tra.
* **Các trường dữ liệu**:
  * `audit_log_id` - Khóa chính: ID tự tăng dần.
  * `user_name`: Tên tài khoản nhân viên sửa đổi.
  * `action_type`: Thao tác dữ liệu - `INSERT`, `UPDATE`, `DELETE`.
  * `table_name`: Bảng dữ liệu bị thay đổi.
  * `record_id`: ID của bản ghi bị thay đổi.
  * `old_values`: Chuỗi dữ liệu dạng JSON ghi nhận trạng thái cũ trước khi sửa.
  * `new_values`: Chuỗi dữ liệu dạng JSON ghi nhận trạng thái mới sau khi sửa.
  * `created_at`: Thời gian thực hiện hành động.
