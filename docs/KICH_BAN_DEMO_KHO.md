# Kịch bản demo kho WMS

## Mục tiêu

Trình diễn đầy đủ vòng đời của một lô bao: xe inbound đến kho, phân loại lần một theo nội tỉnh/liên tỉnh, phân loại lần hai theo phường hoặc điểm phát, chốt pallet và xuất kho bằng chuyến xe outbound.

## Chuẩn bị trước khi demo

1. Đăng nhập bằng tài khoản điều phối hoặc quản lý kho.
2. Tạo một pallet cho khu nhận hàng, một pallet liên tỉnh, một pallet nội tỉnh và các pallet đại diện cho từng phường/điểm phát.
3. Tại màn hình `Quét mã vạch`, tạo từ 3 đến 6 bao hàng. Hệ thống tự sinh mã `SACK-...`; bấm `In tem` để in Code 39 và QR dự phòng cho từng bao.
4. Chọn điểm đến sao cho có cả bao trong cùng tỉnh với hub và bao ở tỉnh khác. Với bao nội tỉnh, dùng các điểm đến đại diện cho các phường khác nhau.
5. Tại màn hình `Trip Coordinator`, tạo chuyến `Inbound`, chọn xe, tài xế, hub đi/đến và các bao vừa tạo. Bấm `In mã xe` để in QR của chuyến `TRIP-IN-...`.

## Trình tự trình diễn

1. Mở `Quét mã vạch`, chọn chế độ `Xe inbound`, quét tem của chuyến xe.
   - Kết quả cần thấy: xe đã vào kho, số bao của chuyến và zone inbound mà các bao đã được đưa vào.
2. Chuyển sang `Chia chọn`, quét pallet liên tỉnh rồi quét các bao có điểm đến khác tỉnh.
   - Kết quả cần thấy: popup `Hàng liên tỉnh`, điểm đến và zone của pallet.
3. Quét pallet nội tỉnh rồi quét các bao cùng tỉnh.
   - Kết quả cần thấy: popup `Hàng nội tỉnh`, điểm đến và zone hiện tại.
4. Thực hiện phân loại lần hai: quét pallet của từng phường/điểm phát, sau đó quét lại bao nội tỉnh tương ứng. Nếu bao đang ở pallet cũ, dùng nút `Chuyển sang pallet đang quét`.
   - Kết quả cần thấy: bao chuyển sang pallet và zone mới. Có thể đối chiếu tại màn hình quản lý sack.
5. Khi một pallet đã đủ bao cho một chuyến, bấm `Chốt pallet` trong quản lý pallet.
   - Kết quả cần thấy: các bao chuyển sang `ReadyForOutbound`; pallet chuyển `Finalized`.
6. Tại `Trip Coordinator`, tạo chuyến `Outbound`, chọn xe/tài xế/điểm đi/điểm đến và chỉ chọn các bao `ReadyForOutbound`.
7. Đăng nhập tài khoản tài xế, nhận chuyến và chuyển trạng thái chuyến sang `InProgress`.
   - Kết quả cần thấy: bao của chuyến chuyển `InTransit`.
8. Tại điểm đích, dùng chế độ `Nhận hàng` quét từng bao.
   - Kết quả cần thấy: bao chuyển `Received`.

## Kiểm tra nghiệp vụ bắt buộc

- Không thể tạo chuyến outbound với bao chưa chốt pallet.
- Không thể đóng gói bao vào đơn outbound nếu điểm đến bao khác điểm đến của đơn.
- Không thể xác nhận giao hàng nếu bao chưa ở trạng thái `InTransit`.
- Không thể sửa trực tiếp trạng thái pallet hoặc bao qua API chung; trạng thái thay đổi qua quét, chuyển pallet, chốt pallet và chuyến xe.

## Mã in và quét

- Tem bao: Code 39 và QR cùng chứa mã `SACK-...`.
- Tem xe inbound: QR chứa mã `TRIP-IN-...`.
- Camera không khả dụng thì dùng máy quét USB/Bluetooth hoặc nhập mã bằng bàn phím.