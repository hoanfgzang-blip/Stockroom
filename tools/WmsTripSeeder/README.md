# WmsTripSeeder

Chương trình **standalone** (độc lập với Backend và Frontend) để tạo 1 trip Inbound và 3 sack đích đến HUB Hà Nội, với luồng phê duyệt trực quan trước khi ghi vào database.

## Chức năng

- Tự động lấy thông tin **HUB Hà Nội** từ database
- Tự động chọn **hub xuất phát**, **driver** và **xe** phù hợp
- Sinh **ID duy nhất** cho 1 trip và 3 sack
- Tạo **mã QR** (SVG) cho trip và từng sack
- Hiển thị danh sách pallet và cho phép **quét/nhập mã pallet** cho từng sack
- Xuất file **HTML preview đẹp** mở tự động trong browser
- Chờ **xác nhận từ người dùng** tại console (Y/N)
- Sau khi duyệt mới ghi vào database (trip + sack + trip_qr_token + cập nhật trạng thái pallet)
- Mở **trang kết quả** hiển thị ID thực và QR codes sau khi ghi thành công

## Cách chạy

```powershell
# Từ thư mục gốc WMS-
dotnet run --project tools/WmsTripSeeder
```

Hoặc dùng script:

```powershell
.\tools\run-trip-seeder.bat
```

## Luồng hoạt động

```
Kết nối DB → Lấy hub HN + hub xuất phát → Sinh ID trip & 3 sack
     ↓
Hiển thị danh sách pallet → Nhập/quét pallet ID cho từng sack
     ↓
Tạo QR codes (SVG) → Mở HTML preview trong browser
     ↓
Người dùng xem xét → Console: [Y/N]?
     ↓
   [Y] → Ghi DB (trip + sack × 3 + qr_token + cập nhật pallet) → Mở trang kết quả với ID thực
   [N] → Huỷ, không ghi gì
```

## Dữ liệu được tạo

| Thực thể | Trạng thái | Ghi chú |
|----------|-----------|---------|
| `trip`   | `InProgress` | type=`Inbound`, destination=HUB Hà Nội |
| `sack` × 3 | `InTransit` | s_destination=HUB Hà Nội, gắn với trip, có thể gắn `pallet_id` |
| `pallet` | `Occupied` | Cập nhật nếu sack được gắn vào pallet |
| `trip_qr_token` | – | Hết hạn 7 ngày |

## Yêu cầu

- .NET 10 SDK
- Kết nối PostgreSQL (cấu hình trong `Program.cs` hoặc env `WMS_CLI_CONNECTION_STRING`)
