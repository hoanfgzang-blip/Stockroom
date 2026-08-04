# WmsTripCli

CLI doc lap de he thong ben ngoai tao mot inbound trip dang van chuyen, cac sack tren trip va QR tuong thich voi WMS. Project nay ghi truc tiep vao PostgreSQL; khong tham chieu frontend hoac backend.

## Cai dat

Can .NET SDK 9 va quyen ghi vao database WMS. Khong dat connection string trong source code. Truyen qua bien moi truong:

```powershell
$env:WMS_CLI_CONNECTION_STRING = 'Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require'
```

## Tao trip

```powershell
dotnet run --project tools/WmsTripCli -- create `
  --driver-id DEMO-EMP-005 `
  --car-id DEMO-CAR-002 `
  --origin DEMO-HUB-HCM `
  --destination DEMO-HUB-HN `
  --sack-destination DEMO-LOC-HN-01 `
  --count 3
```

Co the tao sack cho nhieu diem den. `--count` ap dung cho moi diem den:

```powershell
dotnet run --project tools/WmsTripCli -- create `
  --driver-id DEMO-EMP-005 `
  --car-id DEMO-CAR-002 `
  --origin DEMO-HUB-HCM `
  --destination DEMO-HUB-HN `
  --sack-destination DEMO-LOC-HN-01,DEMO-LOC-HN-02 `
  --count 2
```

CLI in ra trip ID, tat ca sack ID, QR payload va QR ASCII. QR trip co dang `WMS-TRIP-QR:<token>` va token hash duoc luu trong `trip_qr_token`, nen quet duoc bang luong QR hien tai. QR cua sack la chinh ma sack, vi scanner WMS nhan ma sack truc tiep.

## Hanh vi va rang buoc

- Trip luon co `type = Inbound`, `status = InProgress`; sack co `status = InTransit` va lien ket voi trip.
- Driver phai co role `Driver` va thuoc hub origin; car, origin, destination va sack destination deu duoc kiem tra ton tai truoc khi ghi.
- Origin va destination cua trip phai la location loai `Hub` va khac nhau.
- Tat ca ban ghi trip, sack va QR token duoc ghi trong mot transaction. Bat ky loi nao deu rollback toan bo.
- Outbound khong duoc tao truc tiep boi CLI, vi phai di qua Zone B/C, pallet da chot va outbound order cua WMS.
- Database can da ap dung migration co bang `trip_qr_token`.

Chay `dotnet run --project tools/WmsTripCli -- create --help` de xem day du tuy chon.
