using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Npgsql;
using QRCoder;

Console.OutputEncoding = Encoding.UTF8;

const string ConnectionString =
    "Host=100.125.44.63;Port=55432;Database=wmsdb;Username=wmsdev;Password=Duy@1201;SSL Mode=Disable";

Console.WriteLine("╔══════════════════════════════════════════════════════════════╗");
Console.WriteLine("║       WMS TRIP SEEDER – Tạo Trip & Sack đến HUB Hà Nội      ║");
Console.WriteLine("╚══════════════════════════════════════════════════════════════╝");
Console.WriteLine();

try
{
    await using var conn = new NpgsqlConnection(ConnectionString);
    await conn.OpenAsync();
    Console.WriteLine("✓ Kết nối database thành công.\n");

    // 1. Tìm HUB Hà Nội
    var hubInfo = await GetHubHanoiAsync(conn);
    if (hubInfo == null)
    {
        Console.Error.WriteLine("✗ Không tìm thấy HUB Hà Nội trong database.");
        return 1;
    }
    Console.WriteLine($"✓ HUB đích: [{hubInfo.LocationId}] {hubInfo.LocationName}");

    // 2. Tìm hub xuất phát (khác HN) có driver + car
    var origin = await FindOriginHubAsync(conn, hubInfo.LocationId);
    if (origin == null)
    {
        Console.Error.WriteLine("✗ Không tìm thấy hub xuất phát hoặc driver/car phù hợp.");
        return 1;
    }
    Console.WriteLine($"✓ Hub xuất phát: [{origin.LocationId}] {origin.LocationName}");
    Console.WriteLine($"✓ Driver: [{origin.DriverId}] {origin.DriverName}");
    Console.WriteLine($"✓ Car: [{origin.CarId}] {origin.CarType}");

    // 3. Sinh ID duy nhất
    var now = DateTime.UtcNow;
    var tripId = await GenerateUniqueTripIdAsync(conn, now);
    var sacks = new List<SackDraft>();
    for (int i = 0; i < 3; i++)
        sacks.Add(await GenerateUniqueSackAsync(conn, now, i, hubInfo.LocationId));

    var qrExpiresAt = now.AddHours(168);
    var tripQrToken = RandomNumberGenerator.GetHexString(32);
    var tripQrPayload = "WMS-TRIP-QR:" + tripQrToken;

    // 4. Tạo QR codes
    Console.WriteLine("\n⏳ Đang tạo QR codes và file preview...");
    var tripQrSvg = GenerateQrSvg(tripQrPayload);
    foreach (var sack in sacks)
        sack.QrSvg = GenerateQrSvg(sack.SackId);

    // 5. Xuất file HTML preview và mở browser
    var previewHtml = HtmlBuilder.BuildPreviewHtml(tripId, tripQrPayload, tripQrSvg, qrExpiresAt,
        origin, hubInfo, sacks, now);
    var htmlPath = Path.Combine(Path.GetTempPath(), "wms_trip_preview_" + tripId + ".html");
    await File.WriteAllTextAsync(htmlPath, previewHtml, Encoding.UTF8);

    Console.WriteLine($"✓ File preview: {htmlPath}");
    Console.WriteLine("⟹  Đang mở trình duyệt...\n");
    Process.Start(new ProcessStartInfo(htmlPath) { UseShellExecute = true });

    // 6. Chờ xác nhận
    Console.WriteLine("┌─────────────────────────────────────────────────────────────┐");
    Console.WriteLine("│  Xem xét thông tin trong trình duyệt vừa mở.               │");
    Console.WriteLine("│                                                             │");
    Console.WriteLine("│  Nhấn [Y] + Enter để XÁC NHẬN và ghi vào database.         │");
    Console.WriteLine("│  Nhấn [N] + Enter hoặc bất kỳ phím nào khác để HUỶ.        │");
    Console.WriteLine("└─────────────────────────────────────────────────────────────┘");
    Console.Write("\n  Quyết định của bạn [Y/N]: ");

    var input = Console.ReadLine()?.Trim().ToUpperInvariant();
    if (input != "Y")
    {
        Console.WriteLine("\n✗ Đã huỷ. Không có dữ liệu nào được ghi vào database.");
        return 0;
    }

    // 7. Ghi vào database
    Console.WriteLine("\n⏳ Đang ghi vào database...");
    await using var transaction = await conn.BeginTransactionAsync();
    try
    {
        await InsertTripAsync(conn, transaction, tripId, origin, hubInfo.LocationId, now);
        foreach (var sack in sacks)
            await InsertSackAsync(conn, transaction, sack, tripId, now);
        await InsertTripQrTokenAsync(conn, transaction, tripId, tripQrToken, now, qrExpiresAt);
        await transaction.CommitAsync();
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }

    // 8. In kết quả ra console
    Console.WriteLine();
    Console.WriteLine("╔══════════════════════════════════════════════════════════════╗");
    Console.WriteLine("║                 ✓ GHI DATABASE THÀNH CÔNG                    ║");
    Console.WriteLine("╠══════════════════════════════════════════════════════════════╣");
    Console.WriteLine("║  Trip ID : " + tripId.PadRight(50) + "║");
    Console.WriteLine("╠══════════════════════════════════════════════════════════════╣");
    foreach (var sack in sacks)
        Console.WriteLine("║  Sack ID : " + sack.SackId.PadRight(50) + "║");
    Console.WriteLine("╚══════════════════════════════════════════════════════════════╝");
    Console.WriteLine();

    // 9. Mở trang kết quả
    var successHtml = HtmlBuilder.BuildSuccessHtml(tripId, sacks, tripQrPayload, tripQrSvg, origin, hubInfo, now);
    var successPath = Path.Combine(Path.GetTempPath(), "wms_trip_success_" + tripId + ".html");
    await File.WriteAllTextAsync(successPath, successHtml, Encoding.UTF8);
    Process.Start(new ProcessStartInfo(successPath) { UseShellExecute = true });
    Console.WriteLine($"✓ Trang kết quả: {successPath}");

    return 0;
}
catch (PostgresException ex)
{
    Console.Error.WriteLine("\n✗ PostgreSQL lỗi (" + ex.SqlState + "): " + ex.MessageText);
    return 3;
}
catch (NpgsqlException ex)
{
    Console.Error.WriteLine("\n✗ Lỗi kết nối database: " + ex.Message);
    return 3;
}
catch (Exception ex)
{
    Console.Error.WriteLine("\n✗ Lỗi không mong đợi: " + ex.Message);
    Console.Error.WriteLine(ex.StackTrace);
    return 1;
}

// ──────────────────────────────────────────────────────────────────────────────
// DATABASE HELPERS
// ──────────────────────────────────────────────────────────────────────────────

static async Task<HubInfo?> GetHubHanoiAsync(NpgsqlConnection conn)
{
    const string sql = @"
        SELECT location_id, location_name
        FROM location
        WHERE location_type = 'Hub'
          AND (location_id = 'DEMO-HUB-HN'
               OR LOWER(location_name) LIKE '%ha noi%'
               OR LOWER(location_name) LIKE '%ha n%'
               OR LOWER(location_name) LIKE '%hanoi%')
        LIMIT 1";
    await using var cmd = new NpgsqlCommand(sql, conn);
    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return null;
    return new HubInfo(reader.GetString(0), reader.GetString(1));
}

static async Task<OriginInfo?> FindOriginHubAsync(NpgsqlConnection conn, string excludeHubId)
{
    const string sql = @"
        SELECT l.location_id, l.location_name,
               e.employee_id, e.employee_name,
               c.car_id, c.type AS car_type
        FROM location l
        JOIN employee e ON e.location_id = l.location_id AND e.role_name = 'Driver'
        CROSS JOIN car c
        WHERE l.location_type = 'Hub'
          AND l.location_id <> @excludeHub
        ORDER BY l.location_id, e.employee_id, c.car_id
        LIMIT 1";
    await using var cmd = new NpgsqlCommand(sql, conn);
    cmd.Parameters.AddWithValue("excludeHub", excludeHubId);
    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return null;
    return new OriginInfo(
        reader.GetString(0), reader.GetString(1),
        reader.GetString(2), reader.GetString(3),
        reader.GetString(4), reader.GetString(5));
}

static async Task<string> GenerateUniqueTripIdAsync(NpgsqlConnection conn, DateTime now)
{
    for (int i = 0; i < 10; i++)
    {
        var candidate = "TRIP-IN-" + now.ToString("yyyyMMddHHmmssfff") + "-" + RandomNumberGenerator.GetHexString(4).ToUpper();
        const string sql = "SELECT EXISTS (SELECT 1 FROM trip WHERE trip_id = @id)";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", candidate);
        if (!(bool)(await cmd.ExecuteScalarAsync() ?? false))
            return candidate;
    }
    throw new InvalidOperationException("Không thể tạo trip ID duy nhất.");
}

static async Task<SackDraft> GenerateUniqueSackAsync(NpgsqlConnection conn, DateTime now, int index, string destinationId)
{
    for (int i = 0; i < 10; i++)
    {
        var sackId = "SACK-" + now.ToString("yyyyMMddHHmmssfff") + "-" + index.ToString("D2") + RandomNumberGenerator.GetHexString(2).ToUpper();
        const string sql = "SELECT EXISTS (SELECT 1 FROM sack WHERE sack_id = @id)";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", sackId);
        if (!(bool)(await cmd.ExecuteScalarAsync() ?? false))
            return new SackDraft(sackId, destinationId);
    }
    throw new InvalidOperationException("Không thể tạo sack ID duy nhất.");
}

static async Task InsertTripAsync(NpgsqlConnection conn, NpgsqlTransaction tx,
    string tripId, OriginInfo origin, string destinationId, DateTime now)
{
    const string sql = @"
        INSERT INTO trip (trip_id, employee_id, car_id, origin, destination, type, status, created_at)
        VALUES (@tripId, @driverId, @carId, @origin, @destination, 'Inbound', 'InProgress', @createdAt)";
    await using var cmd = new NpgsqlCommand(sql, conn, tx);
    cmd.Parameters.AddWithValue("tripId", tripId);
    cmd.Parameters.AddWithValue("driverId", origin.DriverId);
    cmd.Parameters.AddWithValue("carId", origin.CarId);
    cmd.Parameters.AddWithValue("origin", origin.LocationId);
    cmd.Parameters.AddWithValue("destination", destinationId);
    cmd.Parameters.AddWithValue("createdAt", now);
    await cmd.ExecuteNonQueryAsync();
}

static async Task InsertSackAsync(NpgsqlConnection conn, NpgsqlTransaction tx,
    SackDraft sack, string tripId, DateTime now)
{
    const string sql = @"
        INSERT INTO sack (sack_id, trip_id, status, created_at, s_destination)
        VALUES (@sackId, @tripId, 'InTransit', @createdAt, @destination)";
    await using var cmd = new NpgsqlCommand(sql, conn, tx);
    cmd.Parameters.AddWithValue("sackId", sack.SackId);
    cmd.Parameters.AddWithValue("tripId", tripId);
    cmd.Parameters.AddWithValue("createdAt", now);
    cmd.Parameters.AddWithValue("destination", sack.DestinationId);
    await cmd.ExecuteNonQueryAsync();
}

static async Task InsertTripQrTokenAsync(NpgsqlConnection conn, NpgsqlTransaction tx,
    string tripId, string token, DateTime issuedAt, DateTime expiresAt)
{
    const string sql = @"
        INSERT INTO trip_qr_token (token_hash, trip_id, issued_at, expires_at, manifest_version)
        VALUES (@tokenHash, @tripId, @issuedAt, @expiresAt, 1)";
    var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    await using var cmd = new NpgsqlCommand(sql, conn, tx);
    cmd.Parameters.AddWithValue("tokenHash", tokenHash);
    cmd.Parameters.AddWithValue("tripId", tripId);
    cmd.Parameters.AddWithValue("issuedAt", issuedAt);
    cmd.Parameters.AddWithValue("expiresAt", expiresAt);
    await cmd.ExecuteNonQueryAsync();
}

// ──────────────────────────────────────────────────────────────────────────────
// QR CODE
// ──────────────────────────────────────────────────────────────────────────────

static string GenerateQrSvg(string payload)
{
    using var gen = new QRCodeGenerator();
    using var data = gen.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
    using var qrCode = new SvgQRCode(data);
    return qrCode.GetGraphic(4, "#1a1a2e", "#ffffff");
}

// ──────────────────────────────────────────────────────────────────────────────
// RECORDS
// ──────────────────────────────────────────────────────────────────────────────

sealed record HubInfo(string LocationId, string LocationName);

sealed record OriginInfo(
    string LocationId, string LocationName,
    string DriverId, string DriverName,
    string CarId, string CarType);

sealed class SackDraft(string sackId, string destinationId)
{
    public string SackId { get; } = sackId;
    public string DestinationId { get; } = destinationId;
    public string QrSvg { get; set; } = string.Empty;
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML BUILDER (dùng string replace để tránh conflict với raw string literals)
// ──────────────────────────────────────────────────────────────────────────────
static class HtmlBuilder
{
    private static readonly string Css = @"
    :root {
      --bg: #0a0a1a; --surface: #12122a; --border: #2a2a5a;
      --accent: #6366f1; --accent2: #8b5cf6; --success: #10b981;
      --warn: #f59e0b; --text: #e2e8f0; --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg); color: var(--text); min-height: 100vh;
      background-image:
        radial-gradient(ellipse at 20% 20%, rgba(99,102,241,.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139,92,246,.10) 0%, transparent 50%);
    }
    .header {
      background: linear-gradient(135deg, #1a1a3e 0%, #12122a 100%);
      border-bottom: 1px solid var(--border);
      padding: 24px 40px; display: flex; align-items: center; gap: 16px;
    }
    .header-icon { font-size: 36px; }
    .header-title { font-size: 22px; font-weight: 800;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header-sub { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .badge { margin-left: auto; padding: 6px 16px; border-radius: 20px;
      font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .badge-pending { background: rgba(245,158,11,.15); border: 1px solid rgba(245,158,11,.4); color: #f59e0b; animation: pulse 2s infinite; }
    .badge-success { background: rgba(16,185,129,.15); border: 1px solid rgba(16,185,129,.4); color: #10b981; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px; }
    .alert {
      border-radius: 12px; padding: 20px 24px; margin-bottom: 32px;
      display: flex; align-items: center; gap: 16px;
    }
    .alert-warn { background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.3); border-left: 4px solid #f59e0b; }
    .alert-ok   { background: rgba(16,185,129,.08);  border: 1px solid rgba(16,185,129,.3);  border-left: 4px solid #10b981; }
    .alert .icon { font-size: 28px; }
    .alert .msg  { font-size: 15px; font-weight: 500; }
    .alert .sub  { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .section-title {
      font-size: 13px; font-weight: 700; color: var(--text-muted); letter-spacing: 1.5px;
      text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
    }
    .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .trip-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; margin-bottom: 32px; box-shadow: 0 8px 32px rgba(0,0,0,.4); }
    .trip-card-header { background: linear-gradient(135deg, rgba(99,102,241,.2), rgba(139,92,246,.1)); border-bottom: 1px solid var(--border); padding: 20px 28px; display: flex; align-items: center; gap: 14px; }
    .trip-icon { background: var(--accent); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .trip-label { font-size: 18px; font-weight: 700; }
    .id-badge { margin-left: auto; background: rgba(99,102,241,.15); border: 1px solid rgba(99,102,241,.4); color: #a5b4fc; padding: 6px 14px; border-radius: 8px; font-family: monospace; font-size: 14px; font-weight: 600; }
    .trip-body { display: grid; grid-template-columns: 1fr auto; }
    .trip-info { padding: 24px 28px; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .info-label { font-size: 11px; font-weight: 600; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .info-value { font-size: 15px; font-weight: 600; }
    .info-value.mono { font-family: monospace; font-size: 13px; color: #a5b4fc; }
    .route-display { display: flex; align-items: center; gap: 12px; margin: 20px 0; padding: 16px 20px; background: rgba(99,102,241,.06); border: 1px solid rgba(99,102,241,.15); border-radius: 10px; }
    .route-hub { font-size: 14px; font-weight: 700; padding: 8px 14px; border-radius: 8px; }
    .route-origin { background: rgba(99,102,241,.2); color: #a5b4fc; }
    .route-dest { background: rgba(16,185,129,.2); color: #6ee7b7; }
    .route-arrow { color: var(--text-muted); font-size: 18px; }
    .qr-panel { padding: 24px; border-left: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(99,102,241,.04); }
    .qr-label { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; }
    .qr-wrap-main { width: 160px; height: 160px; background: white; border-radius: 12px; padding: 8px; display: flex; align-items: center; justify-content: center; }
    .qr-wrap-main svg { width: 100%; height: 100%; }
    .qr-payload { font-family: monospace; font-size: 10px; color: var(--text-muted); max-width: 160px; word-break: break-all; text-align: center; }
    .qr-expires { font-size: 11px; color: var(--warn); }
    .sacks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
    .sack-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: transform .2s, box-shadow .2s; }
    .sack-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(139,92,246,.2); }
    .sack-card-header { border-bottom: 1px solid var(--border); padding: 14px 18px; display: flex; align-items: center; gap: 10px; }
    .sack-card-header-preview { background: linear-gradient(135deg, rgba(139,92,246,.2), rgba(99,102,241,.1)); }
    .sack-card-header-success { background: linear-gradient(135deg, rgba(16,185,129,.15), rgba(99,102,241,.08)); }
    .sack-icon { font-size: 22px; }
    .sack-num { font-size: 15px; font-weight: 700; }
    .sack-body { padding: 16px 18px; }
    .sack-id-box { border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
    .sack-id-box-preview { background: rgba(139,92,246,.08); border: 1px solid rgba(139,92,246,.2); }
    .sack-id-box-success { background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.2); }
    .sack-id-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
    .sack-id-preview { font-family: monospace; font-size: 13px; color: #c4b5fd; font-weight: 600; margin-top: 4px; word-break: break-all; }
    .sack-id-success { font-family: monospace; font-size: 13px; color: #6ee7b7; font-weight: 600; margin-top: 4px; word-break: break-all; }
    .sack-qr-wrap { background: white; border-radius: 10px; padding: 8px; margin-bottom: 10px; }
    .sack-qr-wrap svg { width: 100%; height: auto; }
    .sack-dest { font-size: 12px; color: var(--text-muted); text-align: center; }
    .sack-dest span { color: #6ee7b7; font-weight: 600; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .tag-inbound { background: rgba(99,102,241,.15); color: #a5b4fc; }
    .tag-inprogress { background: rgba(16,185,129,.12); color: #6ee7b7; }
    .tag-intransit { background: rgba(245,158,11,.12); color: #fcd34d; }
    .id-summary-box { background: rgba(16,185,129,.06); border: 1px solid rgba(16,185,129,.2); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
    .id-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .id-row:last-child { margin-bottom: 0; }
    .id-key { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; min-width: 80px; }
    .id-val { font-family: monospace; font-size: 16px; font-weight: 700; color: #6ee7b7; background: rgba(16,185,129,.1); padding: 6px 14px; border-radius: 8px; }
    .qr-section { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 32px; }
    .qr-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 200px; }
    .qr-card-label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
    .qr-card-wrap { background: white; border-radius: 10px; padding: 8px; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; }
    .qr-card-wrap svg { width: 100%; height: 100%; }
    .qr-card-id { font-family: monospace; font-size: 11px; color: #a5b4fc; word-break: break-all; text-align: center; max-width: 180px; }
    .action-bar { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 28px 32px; display: flex; align-items: center; justify-content: space-between; gap: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.3); }
    .action-title { font-size: 16px; font-weight: 700; }
    .action-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .action-btns { display: flex; gap: 12px; }
    .btn { padding: 14px 28px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all .2s; display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; }
    .btn-confirm { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; box-shadow: 0 4px 20px rgba(99,102,241,.4); }
    .btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(99,102,241,.5); }
    .btn-cancel { background: rgba(255,255,255,.05); color: var(--text-muted); border: 1px solid var(--border); }
    .btn-cancel:hover { background: rgba(255,255,255,.1); }
    .footer { text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px; }";

    private static string PageShell(string title, string headerIcon, string headerTitle,
        string headerSub, string badgeClass, string badgeText, string body, string footerText)
    {
        return "<!DOCTYPE html>\n<html lang=\"vi\">\n<head>\n<meta charset=\"UTF-8\"/>\n" +
               "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>\n" +
               "<title>" + title + "</title>\n" +
               "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"/>\n" +
               "<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap\" rel=\"stylesheet\"/>\n" +
               "<style>" + Css + "</style>\n</head>\n<body>\n" +
               "<div class=\"header\">\n" +
               "  <div class=\"header-icon\">" + headerIcon + "</div>\n" +
               "  <div>\n" +
               "    <div class=\"header-title\">" + headerTitle + "</div>\n" +
               "    <div class=\"header-sub\">" + headerSub + "</div>\n" +
               "  </div>\n" +
               "  <div class=\"badge " + badgeClass + "\">" + badgeText + "</div>\n" +
               "</div>\n" +
               "<div class=\"container\">\n" + body + "\n</div>\n" +
               "<div class=\"footer\">" + footerText + "</div>\n</body>\n</html>";
    }

    private static string SackCards(List<SackDraft> sacks, bool success)
    {
        var sb = new StringBuilder();
        string headerClass = success ? "sack-card-header-success" : "sack-card-header-preview";
        string idBoxClass  = success ? "sack-id-box-success" : "sack-id-box-preview";
        string idValClass  = success ? "sack-id-success" : "sack-id-preview";

        for (int i = 0; i < sacks.Count; i++)
        {
            var s = sacks[i];
            sb.Append("<div class=\"sack-card\">");
            sb.Append("<div class=\"sack-card-header " + headerClass + "\">");
            sb.Append("<div class=\"sack-icon\">📦</div>");
            sb.Append("<div class=\"sack-num\">Sack #" + (i + 1) + "</div>");
            sb.Append("<div style=\"margin-left:auto\"><span class=\"tag tag-intransit\">InTransit</span></div>");
            sb.Append("</div>");
            sb.Append("<div class=\"sack-body\">");
            sb.Append("<div class=\"sack-id-box " + idBoxClass + "\">");
            sb.Append("<div class=\"sack-id-label\">Sack ID</div>");
            sb.Append("<div class=\"" + idValClass + "\">" + s.SackId + "</div>");
            sb.Append("</div>");
            sb.Append("<div class=\"sack-qr-wrap\">" + s.QrSvg + "</div>");
            sb.Append("<div class=\"sack-dest\">Đích đến: <span>HUB Hà Nội</span><br/><small style=\"opacity:.6\">" + s.DestinationId + "</small></div>");
            sb.Append("</div>");
            sb.Append("</div>\n");
        }
        return sb.ToString();
    }

    public static string BuildPreviewHtml(
        string tripId, string tripQrPayload, string tripQrSvg, DateTime qrExpiresAt,
        OriginInfo origin, HubInfo destination, List<SackDraft> sacks, DateTime now)
    {
        var localNow     = now.AddHours(7);
        var localExpires = qrExpiresAt.AddHours(7);

        var body = new StringBuilder();

        // Alert
        body.Append("<div class=\"alert alert-warn\">");
        body.Append("<div class=\"icon\">⚠️</div>");
        body.Append("<div><div class=\"msg\">Xem xét thông tin bên dưới trước khi xác nhận</div>");
        body.Append("<div class=\"sub\">Dữ liệu <strong>chưa được lưu</strong> vào database. Quay lại cửa sổ console và nhấn <strong>Y + Enter</strong> để xác nhận, hoặc <strong>N + Enter</strong> để huỷ bỏ.</div>");
        body.Append("</div></div>\n");

        // Trip section
        body.Append("<div class=\"section-title\">🚛 Thông tin chuyến xe (Trip)</div>\n");
        body.Append("<div class=\"trip-card\">");
        body.Append("<div class=\"trip-card-header\">");
        body.Append("<div class=\"trip-icon\">🚛</div>");
        body.Append("<div><div class=\"trip-label\">Chuyến Inbound mới</div></div>");
        body.Append("<div class=\"id-badge\">" + tripId + "</div>");
        body.Append("</div>");

        body.Append("<div class=\"trip-body\">");
        body.Append("<div class=\"trip-info\">");
        body.Append("<div class=\"route-display\">");
        body.Append("<div class=\"route-hub route-origin\">📦 " + origin.LocationName + "<br/><small style=\"font-size:10px;opacity:.7\">" + origin.LocationId + "</small></div>");
        body.Append("<div class=\"route-arrow\">⟶</div>");
        body.Append("<div class=\"route-hub route-dest\">🏢 " + destination.LocationName + "<br/><small style=\"font-size:10px;opacity:.7\">" + destination.LocationId + "</small></div>");
        body.Append("</div>");
        body.Append("<div class=\"info-grid\">");
        InfoItem(body, "Trip ID", "<span class=\"mono\">" + tripId + "</span>");
        InfoItem(body, "Loại chuyến", "<span class=\"tag tag-inbound\">Inbound</span>");
        InfoItem(body, "Trạng thái", "<span class=\"tag tag-inprogress\">InProgress</span>");
        InfoItem(body, "Tài xế", origin.DriverName);
        InfoItem(body, "Driver ID", "<span class=\"mono\">" + origin.DriverId + "</span>");
        InfoItem(body, "Phương tiện", origin.CarType + " <span style=\"color:var(--text-muted);font-size:12px\">(" + origin.CarId + ")</span>");
        InfoItem(body, "Thời gian tạo", localNow.ToString("dd/MM/yyyy HH:mm:ss"));
        InfoItem(body, "QR hết hạn", "<span style=\"color:#f59e0b\">" + localExpires.ToString("dd/MM/yyyy HH:mm") + "</span>");
        body.Append("</div></div>");

        // QR panel
        body.Append("<div class=\"qr-panel\">");
        body.Append("<div class=\"qr-label\">QR Trip</div>");
        body.Append("<div class=\"qr-wrap-main\">" + tripQrSvg + "</div>");
        body.Append("<div class=\"qr-payload\">" + tripQrPayload + "</div>");
        body.Append("<div class=\"qr-expires\">Hết hạn: " + localExpires.ToString("HH:mm dd/MM/yy") + "</div>");
        body.Append("</div>");
        body.Append("</div></div>\n");

        // Sacks section
        body.Append("<div class=\"section-title\">📦 3 Bao hàng (Sacks)</div>\n");
        body.Append("<div class=\"sacks-grid\">" + SackCards(sacks, false) + "</div>\n");

        // Action bar
        body.Append("<div class=\"action-bar\">");
        body.Append("<div><div class=\"action-title\">Xác nhận ghi vào database?</div>");
        body.Append("<div class=\"action-sub\">1 trip · 3 sacks · HUB Hà Nội · Quay lại console để xác nhận hoặc huỷ bỏ.</div></div>");
        body.Append("<div class=\"action-btns\">");
        body.Append("<button class=\"btn btn-cancel\" onclick=\"window.close()\">✕ Đóng trang này</button>");
        body.Append("<button class=\"btn btn-confirm\" onclick=\"alert('Quay lại cửa sổ console và nhấn Y + Enter để xác nhận!')\">✓ Xác nhận (tại console)</button>");
        body.Append("</div></div>\n");

        return PageShell(
            "WMS – Xét duyệt Trip Mới", "🚛",
            "WMS Trip Seeder",
            "Tạo Trip Inbound → HUB Hà Nội · " + localNow.ToString("dd/MM/yyyy HH:mm") + " (GMT+7)",
            "badge-pending", "⏳ Chờ Duyệt",
            body.ToString(),
            "WMS Trip Seeder &nbsp;·&nbsp; Dữ liệu preview – chưa ghi vào database");
    }

    public static string BuildSuccessHtml(
        string tripId, List<SackDraft> sacks, string tripQrPayload, string tripQrSvg,
        OriginInfo origin, HubInfo destination, DateTime now)
    {
        var localNow = now.AddHours(7);
        var body = new StringBuilder();

        // Alert success
        body.Append("<div class=\"alert alert-ok\">");
        body.Append("<div class=\"icon\">🎉</div>");
        body.Append("<div><div class=\"msg\">Trip và 3 sack đã được ghi thành công vào database!</div>");
        body.Append("<div class=\"sub\">1 trip Inbound · 3 sacks InTransit · Đích đến: " + destination.LocationName + " (" + destination.LocationId + ")</div>");
        body.Append("</div></div>\n");

        // ID summary
        body.Append("<div class=\"section-title\">🆔 ID đã được ghi</div>\n");
        body.Append("<div class=\"id-summary-box\">");
        body.Append("<div class=\"id-row\"><div class=\"id-key\">Trip ID</div><div class=\"id-val\">" + tripId + "</div></div>");
        for (int i = 0; i < sacks.Count; i++)
            body.Append("<div class=\"id-row\"><div class=\"id-key\">Sack #" + (i + 1) + "</div><div class=\"id-val\">" + sacks[i].SackId + "</div></div>");
        body.Append("</div>\n");

        // QR section
        body.Append("<div class=\"section-title\">📱 QR Codes</div>\n");
        body.Append("<div class=\"qr-section\">");
        body.Append("<div class=\"qr-card\">");
        body.Append("<div class=\"qr-card-label\">🚛 QR Trip</div>");
        body.Append("<div class=\"qr-card-wrap\">" + tripQrSvg + "</div>");
        body.Append("<div class=\"qr-card-id\">" + tripQrPayload + "</div>");
        body.Append("</div>");
        for (int i = 0; i < sacks.Count; i++)
        {
            body.Append("<div class=\"qr-card\">");
            body.Append("<div class=\"qr-card-label\">📦 QR Sack #" + (i + 1) + "</div>");
            body.Append("<div class=\"qr-card-wrap\">" + sacks[i].QrSvg + "</div>");
            body.Append("<div class=\"qr-card-id\">" + sacks[i].SackId + "</div>");
            body.Append("</div>");
        }
        body.Append("</div>\n");

        // Sacks detail
        body.Append("<div class=\"section-title\">📦 Chi tiết 3 Sacks</div>\n");
        body.Append("<div class=\"sacks-grid\">" + SackCards(sacks, true) + "</div>\n");

        return PageShell(
            "WMS – Trip Tạo Thành Công", "✅",
            "Tạo Trip Thành Công!",
            "Dữ liệu đã được ghi vào database lúc " + localNow.ToString("dd/MM/yyyy HH:mm:ss") + " (GMT+7)",
            "badge-success", "✓ Đã Duyệt",
            body.ToString(),
            "WMS Trip Seeder &nbsp;·&nbsp; Dữ liệu đã được ghi vào database &nbsp;·&nbsp; " + localNow.ToString("dd/MM/yyyy HH:mm"));
    }

    private static void InfoItem(StringBuilder sb, string label, string value)
    {
        sb.Append("<div class=\"info-item\">");
        sb.Append("<div class=\"info-label\">" + label + "</div>");
        sb.Append("<div class=\"info-value\">" + value + "</div>");
        sb.Append("</div>");
    }
}
