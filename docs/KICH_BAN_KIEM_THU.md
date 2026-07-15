# Kịch Bản Kiểm Thử Sản Phẩm WMS

## 1. Mục tiêu

Tài liệu này là checklist kiểm thử thủ công cho hệ thống quản lý kho WMS. Mục tiêu là xác nhận giao diện, API và dữ liệu kho hoạt động đúng trong các luồng nhập kho, xuất kho, điều phối và tra cứu.

## 2. Môi trường kiểm thử

| Thành phần | Giá trị |
| --- | --- |
| Website | URL ngrok đang chạy hoặc `http://127.0.0.1:5295` |
| API | `<website>/api` |
| Cơ sở dữ liệu | PostgreSQL, cơ sở dữ liệu `WmsDb` |
| Trình duyệt | Chrome, Edge hoặc Firefox bản mới nhất |

Trước khi test, bảo đảm API truy cập được tại `/api/Dashboard/summary` và dữ liệu mẫu đã được khởi tạo.

## 3. Quy ước kết quả

Ghi một trong ba trạng thái cho mỗi kịch bản:

- `Đạt`: kết quả thực tế đúng với kết quả mong đợi.
- `Không đạt`: có lỗi, sai dữ liệu hoặc không hoàn tất được thao tác.
- `Chưa test`: chưa thực hiện.

## 4. Kịch bản kiểm thử

| Mã | Chức năng | Bước thực hiện | Kết quả mong đợi | Trạng thái |
| --- | --- | --- | --- | --- |
| TC-01 | Mở hệ thống | Mở URL website từ máy khác hoặc mạng khác. | Trang WMS hiển thị, không có lỗi trắng trang hoặc lỗi tải tài nguyên. | Chưa test |
| TC-02 | Dashboard | Vào trang Dashboard và chờ dữ liệu tải xong. | Các chỉ số tổng quan, biểu đồ và nhật ký gần đây hiển thị; không có lỗi API trên trình duyệt. | Chưa test |
| TC-03 | Kiểm tra API | Mở `<website>/api/Dashboard/summary`. | API trả về mã `200` và dữ liệu JSON hợp lệ. | Chưa test |
| TC-04 | Danh mục vị trí | Vào Hạ tầng > Địa điểm, thêm một địa điểm thử nghiệm, sau đó tìm lại. | Địa điểm mới xuất hiện trong danh sách và lưu đúng thông tin. | Chưa test |
| TC-05 | Danh mục khu vực | Tạo khu vực kho gắn với địa điểm ở TC-04. | Khu vực được tạo và có thể lọc theo địa điểm. | Chưa test |
| TC-06 | Quản lý nhân sự | Vào Nhân sự, tạo hoặc cập nhật một nhân viên thử nghiệm. | Thông tin được lưu, danh sách và bộ lọc hiển thị đúng. | Chưa test |
| TC-07 | Quản lý phương tiện | Vào Đội xe, thêm hoặc cập nhật xe vận chuyển. | Xe xuất hiện trong danh sách với trạng thái đúng. | Chưa test |
| TC-08 | Nhập kho | Tạo lệnh nhập kho ở trạng thái `Pending`, xem chi tiết và chuyển trạng thái sang `InProgress` rồi `Completed`. | Lệnh nhập lưu được; trạng thái thay đổi đúng và dữ liệu không bị mất. | Chưa test |
| TC-09 | Tạo lệnh xuất kho | Vào Xuất kho, tạo một lệnh xuất mới ở trạng thái `Pending`. | Lệnh xuất được tạo; API `GET /api/OutboundOrders/{id}` trả về đúng lệnh. | Chưa test |
| TC-10 | Giữ hàng xuất kho | Chọn một bao hàng đang sẵn sàng, gửi yêu cầu giữ hàng cho lệnh xuất. | Tạo giữ chỗ thành công; bao hàng không thể được giữ đồng thời cho lệnh xuất khác. | Chưa test |
| TC-11 | Chống giữ hàng trùng | Dùng lệnh xuất thứ hai cố giữ chính bao hàng của TC-10. | Hệ thống từ chối thao tác và trả thông báo xung đột; dữ liệu giữ chỗ ban đầu không thay đổi. | Chưa test |
| TC-12 | Hoàn tất xuất kho | Hoàn tất lệnh xuất đã có bao hàng được giữ. | Trạng thái lệnh xuất chuyển sang hoàn thành; bao hàng được đánh dấu đã xuất; giữ chỗ liên quan không còn hiệu lực. | Chưa test |
| TC-13 | Giải phóng giữ chỗ | Tạo một giữ chỗ mới, sau đó thực hiện giải phóng giữ chỗ. | Giữ chỗ bị xóa hoặc chuyển trạng thái đã giải phóng; bao hàng có thể dùng lại cho lệnh khác. | Chưa test |
| TC-14 | Lọc và tìm kiếm | Thử lọc lệnh nhập, lệnh xuất, bao hàng và chuyến xe theo trạng thái. | Chỉ hiển thị các bản ghi phù hợp; khi bỏ lọc, danh sách đầy đủ trở lại. | Chưa test |
| TC-15 | Nhật ký thao tác | Vào Nhật ký hệ thống sau các thao tác tạo/cập nhật/xuất kho. | Có bản ghi log tương ứng, đúng loại thao tác và thời gian. | Chưa test |
| TC-16 | Kiểm tra lỗi dữ liệu | Thử gửi mã lệnh không tồn tại hoặc dữ liệu thiếu trường bắt buộc qua giao diện/API. | Hệ thống trả lỗi `400` hoặc `404` rõ ràng, không làm dừng ứng dụng và không sinh dữ liệu sai. | Chưa test |
| TC-17 | Khả năng truy cập công khai | Mở link ngrok từ thiết bị không cùng mạng Wi-Fi. | Website và API hoạt động như máy nội bộ; dữ liệu tải được qua đường dẫn `/api`. | Chưa test |

## 5. Kết quả tổng hợp

| Ngày test | Người test | Số TC đạt | Số TC không đạt | Ghi chú |
| --- | --- | ---: | ---: | --- |
|  |  |  |  |  |

## 6. Báo lỗi

Khi phát hiện lỗi, ghi theo mẫu:

```text
Mã lỗi: BUG-XXX
Kịch bản liên quan: TC-XX
Mô tả: ...
Bước tái hiện: ...
Kết quả thực tế: ...
Kết quả mong đợi: ...
Ảnh chụp hoặc log: ...
Mức độ: Nghiêm trọng / Cao / Trung bình / Thấp
```

## 7. Smoke Test Tự Động

Script `tests/SmokeTest.ps1` chạy các kiểm tra chỉ đọc cho trang chủ, dashboard và các API danh mục/nghiệp vụ. Script không tạo, sửa hoặc xóa dữ liệu.

Chạy trên máy đang chạy WMS:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\SmokeTest.ps1
```

Chạy trên URL công khai:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\SmokeTest.ps1 -BaseUrl "https://your-ngrok-url.ngrok-free.dev"
```
