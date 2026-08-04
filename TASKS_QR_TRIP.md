# Backlog QR chuyến xe và kiểm đếm kho

## Quy ước giao task

- Chỉ sửa các file được nêu trong task.
- Không đổi API, database hoặc chức năng ngoài phạm vi task nếu chưa được yêu cầu.
- Không xóa luồng cũ khi luồng thay thế chưa hoàn thiện end-to-end.
- Sau mỗi task: báo file đã sửa, lỗi còn lại, và kết quả build/test.

## Đã hoàn thành

### Task 1 - Cập nhật chuyến mới trên UI

- Chuyến mới xuất hiện ngay sau khi tạo.
- Sắp xếp chuyến mới nhất lên đầu và cập nhật bộ đếm.

### Task 2 - QR inbound sau khi tạo chuyến

- Có dialog loading, lỗi, thử lại, xem QR và in QR.

### Task 3 - Backend QR token ngắn

- Lưu token hash trong bảng `trip_qr_token`.
- Cấp token ngắn, resolve token thành manifest mới nhất.
- Outbound chỉ được cấp token sau khi chốt seal.

### Task 3.1 - Quyền hub và thu hồi token

- Chỉ hub đích được resolve QR.
- Thu hồi token khi chuyến hoàn tất.
- `CompletedWithMissing` vẫn giữ token để nhận bổ sung bao thiếu.

---

## Task 4 - Frontend in QR token ngắn

### Mục tiêu

Thay QR JSON dày đặc bằng QR chứa `WMS-TRIP-QR:<token>`.

### File được sửa

- `frontend/src/types/index.ts`
- `frontend/src/api/services.ts`
- `frontend/src/pages/TripsPage.tsx`

### Yêu cầu

1. Thêm type khớp response cấp QR token của backend.
2. Thêm API `issueQrToken(tripId)` gọi `POST /Trips/{id}/qr-token`.
3. Sau khi tạo inbound, gọi API token thay cho `qr-manifest`.
4. QR hiển thị và QR in đều mã hóa `qrValue`, không mã hóa JSON manifest.
5. Dialog vẫn hiện mã chuyến, tài xế, xe, tuyến, số bao, thời điểm hết hạn.
6. Nút in trên chuyến outbound đã seal cũng phải dùng API token.
7. Khi in/cấp lại QR, hiện cảnh báo: `Cấp lại QR sẽ làm QR đã in trước đó hết hiệu lực.`
8. Không hiển thị token thô dưới dạng text.
9. Chưa sửa scanner trong task này.

### Tiêu chí hoàn thành

- QR quét ra chuỗi bắt đầu bằng `WMS-TRIP-QR:`.
- QR không còn là JSON và in 30-40 mm vẫn quét được.
- Inbound có QR ngay sau khi tạo.
- Outbound chỉ có QR sau chốt seal.
- Frontend build không có lỗi mới.

---

## Task 5 - Chuẩn hóa API nhận hàng theo danh sách quét thực tế

### Mục tiêu

Loại bỏ lỗi quét QR xe là tự coi tất cả sack đã đến.

### File được sửa

- `WMS-/Controllers/TripsController.cs`
- `frontend/src/api/services.ts`
- `frontend/src/types/index.ts`

### Yêu cầu

1. Không dùng manifest do frontend gửi để quyết định sack nào đã đến.
2. Tạo hoặc đổi API xác nhận nhận hàng nhận vào `tripId` và danh sách `arrivedSackIds` thực tế.
3. Server tự lấy danh sách sack dự kiến từ database.
4. Server trả về: expected, arrived, received, missing, unexpected, trạng thái chuyến và zone nhập.
5. Xóa default tự điền toàn bộ sack từ manifest trong `checkInByQr`.
6. Không thay đổi trạng thái sack/chuyến khi danh sách thực tế rỗng.
7. Giữ token active cho `CompletedWithMissing`; thu hồi khi `Completed`.

### Tiêu chí hoàn thành

- Quét QR xe một mình không thể xác nhận đã nhận đủ hàng.
- Chỉ sack thực tế trong `arrivedSackIds` mới được nhận.
- Sack dư trả về `unexpected` và không cập nhật dữ liệu.
- Sack thiếu trả về `missing` và chuyến thành `CompletedWithMissing`.

---

## Task 6 - Scanner QR token và phiên kiểm đếm

### Mục tiêu

Quét QR xe để mở phiên đối chiếu; sau đó quét từng sack thực tế trước khi chốt nhận hàng.

### File được sửa

- `frontend/src/pages/BarcodeScannerPage.tsx`
- `frontend/src/pages/InboundOrdersPage.tsx`
- `frontend/src/pages/OutboundOrdersPage.tsx` nếu trang này cũng nhận hàng từ QR xe
- `frontend/src/api/services.ts`

### Yêu cầu

1. Nhận diện chuỗi bắt đầu bằng `WMS-TRIP-QR:`.
2. Gọi `resolve-qr` để lấy manifest mới nhất.
3. Mở màn hình/khối kiểm đếm gồm mã chuyến, xe, tài xế, tuyến, số bao dự kiến.
4. Hiển thị ba danh sách: đã quét, còn thiếu, không thuộc chuyến.
5. QR xe chỉ mở phiên; không gọi API chốt nhận hàng ngay.
6. Mỗi lần quét sack chỉ cập nhật state phiên kiểm đếm.
7. Nút `Xác nhận nhập hàng` mới gửi danh sách sack đã quét thực tế lên API Task 5.
8. Sau khi chốt, hiện kết quả đủ/thiếu/dư và reload dữ liệu liên quan.
9. Giữ hỗ trợ QR JSON cũ tạm thời hoặc báo rõ QR cũ không còn hỗ trợ; không âm thầm coi QR token là mã chuyến.

### Tiêu chí hoàn thành

- Quét QR xe không đổi trạng thái chuyến.
- Quét 3/5 sack cho thấy còn thiếu 2 sack.
- Quét sack ngoài danh sách hiển thị cảnh báo và không cho chốt.
- Quét đủ rồi chốt mới chuyển chuyến thành `Completed`.

---

## Task 7 - Hiển thị chuyến thiếu hàng trên điều phối

### Mục tiêu

Chuyến `CompletedWithMissing` không được biến mất khỏi bảng điều phối.

### File được sửa

- `frontend/src/lib/utils.ts`
- `frontend/src/pages/TripsPage.tsx`

### Yêu cầu

1. Thêm cột/trạng thái `Đến thiếu hàng`.
2. Badge có màu cảnh báo hoặc danger rõ ràng.
3. Thẻ chuyến hiện số sack thiếu và nút xem chi tiết.
4. Khi kho nhận bổ sung đủ, trạng thái chuyển sang `Completed` và token bị thu hồi.

### Tiêu chí hoàn thành

- Chuyến thiếu hàng luôn thấy được.
- Người dùng biết chính xác còn thiếu sack nào.

---

## Task 8 - Audit log cho QR và kiểm đếm

### Mục tiêu

Có thể truy vết ai cấp/in QR, ai quét và ai chốt hàng thiếu/dư.

### File dự kiến

- `WMS-/Controllers/TripsController.cs`
- Entity/service audit log hiện có trong backend
- `frontend/src/pages/AuditLogsPage.tsx` nếu cần bổ sung bộ lọc/nhãn

### Sự kiện cần ghi

- Cấp hoặc in lại QR.
- Token cũ bị thu hồi.
- QR resolve thất bại do sai hub/hết hạn/thu hồi.
- Bắt đầu phiên kiểm đếm.
- Chốt đủ hàng, thiếu hàng hoặc có hàng dư.

---

## Task 9 - Test end-to-end và phân quyền

### Kịch bản bắt buộc

1. Tạo inbound -> cấp QR -> in -> hub đích resolve -> quét đủ sack -> hoàn tất.
2. Quét thiếu sack -> `CompletedWithMissing` -> nhận bổ sung -> `Completed`.
3. Quét sack dư -> không được chốt.
4. Hub sai quét QR -> 403.
5. QR hết hạn, thu hồi hoặc QR cũ sau in lại -> bị từ chối.
6. Outbound: tạo -> mở seal -> quét sack -> chốt seal -> cấp QR -> nhập tại hub đích.
7. Tài xế hoàn tất -> QR không còn hiệu lực.

---

## Backlog WMS sau QR

- Dashboard không được nuốt lỗi API thành số 0.
- Sơ đồ zone phải có vị trí, sức chứa và cảnh báo đầy kho.
- Kiểm tra phân quyền/location để người dùng không bị thấy bảng trống khó hiểu.
- Chuẩn hóa migration và seed database cho cả nhóm phát triển.
- Bổ sung test API cho luồng nhập/xuất/chuyến xe.
