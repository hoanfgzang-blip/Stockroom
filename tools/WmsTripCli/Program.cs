using System.Security.Cryptography;
using System.Text;
using Npgsql;
using QRCoder;

Console.OutputEncoding = Encoding.UTF8;
return await RunAsync(args);

static async Task<int> RunAsync(string[] args)
{
    try
    {
        var options = CreateOptions.Parse(args);
        if (options == null)
        {
            PrintUsage();
            return 0;
        }

        var result = await new TripCreator(options).CreateAsync();
        PrintResult(result, options.PrintQr);
        return 0;
    }
    catch (CliException exception)
    {
        Console.Error.WriteLine($"Loi: {exception.Message}");
        Console.Error.WriteLine("Dung 'create --help' de xem cu phap.");
        return 2;
    }
    catch (PostgresException exception)
    {
        Console.Error.WriteLine($"PostgreSQL tu choi thao tac ({exception.SqlState}): {exception.MessageText}");
        return 3;
    }
    catch (NpgsqlException exception)
    {
        Console.Error.WriteLine($"Khong the ket noi hoac ghi database: {exception.Message}");
        return 3;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Loi khong mong muon: {exception.Message}");
        return 1;
    }
}

static void PrintResult(CreationResult result, bool printQr)
{
    Console.WriteLine();
    Console.WriteLine("Da tao chuyen inbound va ghi thanh cong vao database.");
    Console.WriteLine($"Trip ID : {result.TripId}");
    Console.WriteLine($"Trip QR : {result.TripQrPayload}");
    Console.WriteLine($"QR het han (UTC): {result.TripQrExpiresAt:O}");
    Console.WriteLine($"So sack: {result.Sacks.Count}");

    foreach (var sack in result.Sacks)
        Console.WriteLine($"  - Sack ID: {sack.SackId} | Sack QR: {sack.SackId} | Destination: {sack.DestinationId}");

    if (!printQr)
        return;

    PrintQr("QR TRIP", result.TripQrPayload);
    foreach (var sack in result.Sacks)
        PrintQr($"QR SACK {sack.SackId}", sack.SackId);
}

static void PrintQr(string title, string payload)
{
    Console.WriteLine();
    Console.WriteLine(new string('=', 72));
    Console.WriteLine(title);
    Console.WriteLine($"Payload: {payload}");

    using var generator = new QRCodeGenerator();
    using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
    using var qrCode = new AsciiQRCode(data);
    Console.WriteLine(qrCode.GetGraphic(1));
}

static void PrintUsage()
{
    Console.WriteLine("WmsTripCli - tao inbound trip va sack truc tiep trong PostgreSQL");
    Console.WriteLine();
    Console.WriteLine("Cu phap:");
    Console.WriteLine("  dotnet run --project tools/WmsTripCli -- create [tuy chon]");
    Console.WriteLine();
    Console.WriteLine("Bat buoc:");
    Console.WriteLine("  --driver-id <id>             Nhan vien co vai tro Driver tai hub xuat phat");
    Console.WriteLine("  --car-id <id>                Phuong tien da ton tai");
    Console.WriteLine("  --origin <location-id>       Hub xuat phat");
    Console.WriteLine("  --destination <location-id>  Hub dich");
    Console.WriteLine("  --sack-destination <id>     Diem den cuoi cua sack; co the lap lai hoac dung CSV");
    Console.WriteLine();
    Console.WriteLine("Tuy chon:");
    Console.WriteLine("  --count <n>                  So sack tao cho moi sack destination (mac dinh: 1, toi da: 100)");
    Console.WriteLine("  --trip-id <id>               Tu dat trip ID; mac dinh tu sinh TRIP-IN-...");
    Console.WriteLine("  --qr-expires-hours <n>       Thoi han QR trip theo gio (mac dinh: 168)");
    Console.WriteLine("  --connection <connection>    Chuoi ket noi PostgreSQL; uu tien hon bien moi truong");
    Console.WriteLine("  --no-qr                      Khong in QR ASCII; ID va QR payload van duoc in");
    Console.WriteLine();
    Console.WriteLine("Chuoi ket noi mac dinh doc tu bien moi truong WMS_CLI_CONNECTION_STRING.");
    Console.WriteLine("CLI chi tao inbound trip InProgress de khong bo qua luong outbound Zone B/C.");
}

sealed record CreateOptions(
    string ConnectionString,
    string DriverId,
    string CarId,
    string OriginId,
    string DestinationId,
    IReadOnlyList<string> SackDestinations,
    int SacksPerDestination,
    string? RequestedTripId,
    int QrExpiresHours,
    bool PrintQr)
{
    private static readonly HashSet<string> ValueOptions = new(StringComparer.OrdinalIgnoreCase)
    {
        "--connection",
        "--driver-id",
        "--car-id",
        "--origin",
        "--destination",
        "--sack-destination",
        "--count",
        "--trip-id",
        "--qr-expires-hours"
    };

    public static CreateOptions? Parse(string[] args)
    {
        if (args.Length == 0 || args.Any(arg => arg is "--help" or "-h"))
            return null;
        if (!string.Equals(args[0], "create", StringComparison.OrdinalIgnoreCase))
            throw new CliException("Lenh dau tien phai la 'create'.");

        var values = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        var printQr = true;

        for (var index = 1; index < args.Length; index++)
        {
            var name = args[index];
            if (name == "--no-qr")
            {
                printQr = false;
                continue;
            }
            if (!name.StartsWith("--", StringComparison.Ordinal))
                throw new CliException($"Tuy chon khong hop le: {name}");
            if (!ValueOptions.Contains(name))
                throw new CliException($"Tuy chon khong duoc ho tro: {name}");
            if (index + 1 >= args.Length || args[index + 1].StartsWith("--", StringComparison.Ordinal))
                throw new CliException($"Tuy chon {name} thieu gia tri.");

            var value = args[++index].Trim();
            if (value.Length == 0)
                throw new CliException($"Tuy chon {name} khong duoc de trong.");
            if (!values.TryGetValue(name, out var optionValues))
            {
                optionValues = [];
                values[name] = optionValues;
            }
            optionValues.Add(value);
        }

        var connectionString = GetSingle(values, "--connection")
            ?? Environment.GetEnvironmentVariable("WMS_CLI_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new CliException("Thieu --connection hoac bien moi truong WMS_CLI_CONNECTION_STRING.");

        var driverId = GetRequired(values, "--driver-id");
        var carId = GetRequired(values, "--car-id");
        var originId = GetRequired(values, "--origin");
        var destinationId = GetRequired(values, "--destination");
        var sackDestinations = GetMany(values, "--sack-destination")
            .SelectMany(value => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .ToList();
        if (sackDestinations.Count == 0)
            throw new CliException("Can it nhat mot --sack-destination.");

        var sacksPerDestination = GetPositiveInteger(values, "--count", 1, 100);
        var qrExpiresHours = GetPositiveInteger(values, "--qr-expires-hours", 168, 24 * 365);
        var tripId = GetSingle(values, "--trip-id");

        ValidateIdentifier(driverId, "driver ID");
        ValidateIdentifier(carId, "car ID");
        ValidateIdentifier(originId, "origin");
        ValidateIdentifier(destinationId, "destination");
        foreach (var sackDestination in sackDestinations)
            ValidateIdentifier(sackDestination, "sack destination");
        if (tripId != null)
            ValidateIdentifier(tripId, "trip ID");

        return new CreateOptions(
            connectionString,
            driverId,
            carId,
            originId,
            destinationId,
            sackDestinations,
            sacksPerDestination,
            tripId,
            qrExpiresHours,
            printQr);
    }

    private static string GetRequired(Dictionary<string, List<string>> values, string name)
        => GetSingle(values, name) ?? throw new CliException($"Thieu tuy chon bat buoc {name}.");

    private static string? GetSingle(Dictionary<string, List<string>> values, string name)
    {
        if (!values.TryGetValue(name, out var optionValues))
            return null;
        if (optionValues.Count != 1)
            throw new CliException($"Tuy chon {name} chi duoc dung mot lan.");
        return optionValues[0];
    }

    private static IReadOnlyList<string> GetMany(Dictionary<string, List<string>> values, string name)
        => values.TryGetValue(name, out var optionValues) ? optionValues : [];

    private static int GetPositiveInteger(Dictionary<string, List<string>> values, string name, int defaultValue, int maximum)
    {
        var value = GetSingle(values, name);
        if (value == null)
            return defaultValue;
        if (!int.TryParse(value, out var parsed) || parsed < 1 || parsed > maximum)
            throw new CliException($"{name} phai la so nguyen tu 1 den {maximum}.");
        return parsed;
    }

    private static void ValidateIdentifier(string value, string label)
    {
        if (value.Length > 50)
            throw new CliException($"{label} khong duoc dai qua 50 ky tu.");
    }
}

sealed class TripCreator(CreateOptions options)
{
    private readonly CreateOptions _options = options;

    public async Task<CreationResult> CreateAsync()
    {
        await using var connection = new NpgsqlConnection(_options.ConnectionString);
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        await ValidateReferencesAsync(connection, transaction);

        var tripId = await GetTripIdAsync(connection, transaction);
        var sackDestinations = _options.SackDestinations
            .SelectMany(destination => Enumerable.Repeat(destination, _options.SacksPerDestination))
            .ToList();
        var sacks = await CreateSackReferencesAsync(connection, transaction, sackDestinations);
        var now = DateTime.UtcNow;
        var tripQrToken = RandomNumberGenerator.GetHexString(32);
        var tripQrPayload = $"WMS-TRIP-QR:{tripQrToken}";
        var tripQrExpiresAt = now.AddHours(_options.QrExpiresHours);

        await InsertTripAsync(connection, transaction, tripId, now);
        foreach (var sack in sacks)
            await InsertSackAsync(connection, transaction, tripId, sack, now);
        await InsertTripQrTokenAsync(connection, transaction, tripId, tripQrToken, now, tripQrExpiresAt);

        await transaction.CommitAsync();
        return new CreationResult(tripId, tripQrPayload, tripQrExpiresAt, sacks);
    }

    private async Task ValidateReferencesAsync(NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        if (string.Equals(_options.OriginId, _options.DestinationId, StringComparison.OrdinalIgnoreCase))
            throw new CliException("Origin va destination cua trip phai khac nhau.");

        var driverLocation = await GetDriverLocationAsync(connection, transaction, _options.DriverId);
        if (driverLocation == null)
            throw new CliException("Driver khong ton tai hoac khong co vai tro Driver.");
        if (!string.Equals(driverLocation, _options.OriginId, StringComparison.OrdinalIgnoreCase))
            throw new CliException("Driver phai thuoc hub origin cua trip.");
        if (!await ExistsAsync(connection, transaction, "SELECT EXISTS (SELECT 1 FROM car WHERE car_id = @id)", _options.CarId))
            throw new CliException("Car ID khong ton tai.");

        var originType = await GetLocationTypeAsync(connection, transaction, _options.OriginId);
        var destinationType = await GetLocationTypeAsync(connection, transaction, _options.DestinationId);
        if (!string.Equals(originType, "Hub", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(destinationType, "Hub", StringComparison.OrdinalIgnoreCase))
        {
            throw new CliException("Origin va destination cua inbound trip phai la hub ton tai.");
        }

        foreach (var sackDestination in _options.SackDestinations.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (await GetLocationTypeAsync(connection, transaction, sackDestination) == null)
                throw new CliException($"Sack destination khong ton tai: {sackDestination}");
        }
    }

    private async Task<string> GetTripIdAsync(NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        if (_options.RequestedTripId != null)
        {
            if (await ExistsAsync(connection, transaction, "SELECT EXISTS (SELECT 1 FROM trip WHERE trip_id = @id)", _options.RequestedTripId))
                throw new CliException($"Trip ID da ton tai: {_options.RequestedTripId}");
            return _options.RequestedTripId;
        }

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var candidate = $"TRIP-IN-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{RandomNumberGenerator.GetHexString(4)}";
            if (!await ExistsAsync(connection, transaction, "SELECT EXISTS (SELECT 1 FROM trip WHERE trip_id = @id)", candidate))
                return candidate;
        }

        throw new CliException("Khong the tao trip ID duy nhat sau 10 lan thu.");
    }

    private static async Task<List<CreatedSack>> CreateSackReferencesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IReadOnlyList<string> destinations)
    {
        var sacks = new List<CreatedSack>(destinations.Count);
        var generatedIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var destination in destinations)
        {
            string sackId;
            do
            {
                sackId = $"SACK-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{RandomNumberGenerator.GetHexString(4)}";
            }
            while (!generatedIds.Add(sackId) || await ExistsAsync(connection, transaction, "SELECT EXISTS (SELECT 1 FROM sack WHERE sack_id = @id)", sackId));

            sacks.Add(new CreatedSack(sackId, destination));
        }

        return sacks;
    }

    private async Task InsertTripAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, string tripId, DateTime now)
    {
        const string sql = """
            INSERT INTO trip (trip_id, employee_id, car_id, origin, destination, type, status, created_at)
            VALUES (@tripId, @driverId, @carId, @originId, @destinationId, 'Inbound', 'InProgress', @createdAt)
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("driverId", _options.DriverId);
        command.Parameters.AddWithValue("carId", _options.CarId);
        command.Parameters.AddWithValue("originId", _options.OriginId);
        command.Parameters.AddWithValue("destinationId", _options.DestinationId);
        command.Parameters.AddWithValue("createdAt", now);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task InsertSackAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string tripId,
        CreatedSack sack,
        DateTime now)
    {
        const string sql = """
            INSERT INTO sack (sack_id, trip_id, status, created_at, s_destination)
            VALUES (@sackId, @tripId, 'InTransit', @createdAt, @destinationId)
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("sackId", sack.SackId);
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("createdAt", now);
        command.Parameters.AddWithValue("destinationId", sack.DestinationId);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task InsertTripQrTokenAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string tripId,
        string token,
        DateTime issuedAt,
        DateTime expiresAt)
    {
        const string sql = """
            INSERT INTO trip_qr_token (token_hash, trip_id, issued_at, expires_at, manifest_version)
            VALUES (@tokenHash, @tripId, @issuedAt, @expiresAt, 1)
            """;
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("tokenHash", tokenHash);
        command.Parameters.AddWithValue("tripId", tripId);
        command.Parameters.AddWithValue("issuedAt", issuedAt);
        command.Parameters.AddWithValue("expiresAt", expiresAt);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<bool> ExistsAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, string sql, string id)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("id", id);
        return (bool)(await command.ExecuteScalarAsync() ?? false);
    }

    private static async Task<string?> GetDriverLocationAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, string driverId)
    {
        const string sql = "SELECT location_id FROM employee WHERE employee_id = @id AND role_name = 'Driver'";
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("id", driverId);
        return await command.ExecuteScalarAsync() as string;
    }

    private static async Task<string?> GetLocationTypeAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, string locationId)
    {
        const string sql = "SELECT location_type FROM location WHERE location_id = @id";
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("id", locationId);
        return await command.ExecuteScalarAsync() as string;
    }
}

sealed record CreatedSack(string SackId, string DestinationId);

sealed record CreationResult(
    string TripId,
    string TripQrPayload,
    DateTime TripQrExpiresAt,
    IReadOnlyList<CreatedSack> Sacks);

sealed class CliException(string message) : Exception(message);
