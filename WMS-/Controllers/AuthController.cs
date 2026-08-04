using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Configuration;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Services.Auth;

namespace WMS_.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly WmsDbContext _db;

    public AuthController(WmsDbContext db) => _db = db;

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthUserResponse>> Login([FromBody] LoginRequest request)
    {
        if (!PasswordHasher.IsAscii(request.Password))
            return Unauthorized(new { message = "Mật khẩu chỉ dùng ký tự không dấu." });

        var username = request.Username.Trim();
        var account = await _db.UserAccounts
            .Include(user => user.Employee)
                .ThenInclude(employee => employee.Location)
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.Username == username);

        // var isValidPassword = PasswordHasher.Verify(request.Password, account.PasswordHash) 
        //     || (request.Username == "admin" && request.Password == "admin123");

        // if (account == null || !account.IsActive || !isValidPassword)
        if (account == null || !account.IsActive || !PasswordHasher.Verify(request.Password, account.PasswordHash))
            return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng." });

        var response = AuthUserResponse.From(
            account.UserId,
            account.Username,
            account.Employee.EmployeeName,
            account.Employee.RoleName,
            account.Employee.LocationId,
            account.Employee.Location?.LocationName);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, response.UserId),
            new(ClaimTypes.Name, response.Username),
            new(ClaimTypes.Role, response.RoleName),
            new("employee_id", account.EmployeeId)
        };
        if (!string.IsNullOrEmpty(account.Employee.LocationId))
        {
            claims.Add(new("location_id", account.Employee.LocationId));
        }
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = request.RememberMe, AllowRefresh = true });

        return Ok(response);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthUserResponse>> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var account = await _db.UserAccounts
            .Include(user => user.Employee)
                .ThenInclude(employee => employee.Location)
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.UserId == userId && user.IsActive);

        return account == null
            ? Unauthorized()
            : Ok(AuthUserResponse.From(
                account.UserId,
                account.Username,
                account.Employee.EmployeeName,
                account.Employee.RoleName,
                account.Employee.LocationId,
                account.Employee.Location?.LocationName));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [Authorize(Policy = "ManagerOnly")]
    [HttpGet("accounts")]
    public async Task<ActionResult<IEnumerable<AccountResponse>>> GetAccounts([FromQuery] string? locationId = null)
    {
        if (!string.IsNullOrWhiteSpace(locationId) && await FindHubAsync(locationId) == null)
            return BadRequest(new { message = "Hub không tồn tại hoặc không hợp lệ." });

        var query = _db.UserAccounts
            .Include(account => account.Employee)
                .ThenInclude(employee => employee.Location)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(locationId))
            query = query.Where(account => account.Employee.LocationId == locationId.Trim());

        var accounts = await query
            .AsNoTracking()
            .OrderBy(account => account.Username)
            .ToListAsync();

        return Ok(accounts.Select(AccountResponse.From));
    }

    [Authorize(Policy = "ManagerOnly")]
    [HttpPost("accounts")]
    public async Task<ActionResult<AccountResponse>> CreateAccount([FromBody] SaveAccountRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            return BadRequest(new { message = "Mật khẩu phải có ít nhất 8 ký tự." });
        if (!PasswordHasher.IsAscii(request.Password))
            return BadRequest(new { message = "Mật khẩu chỉ dùng ký tự không dấu." });

        var employee = await _db.Employees.FindAsync(request.EmployeeId);
        if (employee == null)
            return BadRequest(new { message = "Không tìm thấy nhân viên." });

        var hub = await FindHubAsync(request.LocationId);
        if (hub == null)
            return BadRequest(new { message = "Tài khoản phải được gán vào một hub hợp lệ." });

        var username = request.Username.Trim();
        if (await _db.UserAccounts.AnyAsync(account => account.Username == username))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại." });
        if (await _db.UserAccounts.AnyAsync(account => account.EmployeeId == request.EmployeeId))
            return Conflict(new { message = "Nhân viên này đã có tài khoản." });

        employee.RoleName = request.RoleName;
        await AssignEmployeeHubAsync(employee, hub);
        var account = new WMS_.Data.Entities.UserAccount
        {
            UserId = await GenerateUserIdAsync(),
            EmployeeId = employee.EmployeeId,
            Username = username,
            PasswordHash = PasswordHasher.Hash(request.Password),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            Employee = employee
        };
        _db.UserAccounts.Add(account);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAccounts), AccountResponse.From(account));
    }

    [Authorize(Policy = "ManagerOnly")]
    [HttpPut("accounts/{id}")]
    public async Task<ActionResult<AccountResponse>> UpdateAccount(string id, [FromBody] SaveAccountRequest request)
    {
        var account = await _db.UserAccounts
            .Include(item => item.Employee)
            .SingleOrDefaultAsync(item => item.UserId == id);
        if (account == null)
            return NotFound();

        if (!string.Equals(account.EmployeeId, request.EmployeeId, StringComparison.Ordinal))
            return BadRequest(new { message = "Không được đổi nhân viên của tài khoản." });

        var hub = await FindHubAsync(request.LocationId);
        if (hub == null)
            return BadRequest(new { message = "Tài khoản phải được gán vào một hub hợp lệ." });

        var username = request.Username.Trim();
        if (await _db.UserAccounts.AnyAsync(item => item.Username == username && item.UserId != id))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại." });

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId == id && !request.IsActive)
            return BadRequest(new { message = "Không thể vô hiệu hóa tài khoản đang đăng nhập." });

        account.Username = username;
        account.IsActive = request.IsActive;
        account.Employee.RoleName = request.RoleName;
        await AssignEmployeeHubAsync(account.Employee, hub);
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (request.Password.Length < 8)
                return BadRequest(new { message = "Mật khẩu phải có ít nhất 8 ký tự." });
            if (!PasswordHasher.IsAscii(request.Password))
                return BadRequest(new { message = "Mật khẩu chỉ dùng ký tự không dấu." });
            account.PasswordHash = PasswordHasher.Hash(request.Password);
        }

        await _db.SaveChangesAsync();
        return Ok(AccountResponse.From(account));
    }

    [Authorize(Policy = "ManagerOnly")]
    [HttpDelete("accounts/{id}")]
    public async Task<IActionResult> DisableAccount(string id)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId == id)
            return BadRequest(new { message = "Không thể vô hiệu hóa tài khoản đang đăng nhập." });

        var account = await _db.UserAccounts.FindAsync(id);
        if (account == null)
            return NotFound();

        account.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private Task<Location?> FindHubAsync(string? locationId)
    {
        var normalizedLocationId = locationId?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedLocationId))
            return Task.FromResult<Location?>(null);

        return _db.Locations.FirstOrDefaultAsync(location =>
            location.LocationId == normalizedLocationId &&
            location.LocationType == "Hub" &&
            OperationalHubScope.HubIds.Contains(location.LocationId));
    }

    private async Task AssignEmployeeHubAsync(Employee employee, Location hub)
    {
        employee.LocationId = hub.LocationId;
        employee.Location = hub;

        if (!string.IsNullOrWhiteSpace(employee.ZoneId) &&
            !await _db.Zones.AnyAsync(zone => zone.ZoneId == employee.ZoneId && zone.LocationId == hub.LocationId))
        {
            employee.ZoneId = null;
            employee.Zone = null;
        }
    }

    private async Task<string> GenerateUserIdAsync()
    {
        string userId;
        do
        {
            userId = $"USR-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..48];
        } while (await _db.UserAccounts.AnyAsync(account => account.UserId == userId));

        return userId;
    }
}

public sealed class LoginRequest
{
    [Required, MaxLength(100)]
    public string Username { get; set; } = null!;

    [Required, MinLength(8), MaxLength(200)]
    public string Password { get; set; } = null!;

    public bool RememberMe { get; set; }
}

public sealed record AuthUserResponse(
    string UserId,
    string Username,
    string EmployeeName,
    string RoleName,
    string? LocationId,
    string? LocationName)
{
    public static AuthUserResponse From(
        string userId,
        string username,
        string employeeName,
        string roleName,
        string? locationId,
        string? locationName)
        => new(userId, username, employeeName, roleName, locationId, locationName);
}

public sealed class SaveAccountRequest
{
    [Required, MaxLength(50)]
    public string EmployeeId { get; set; } = null!;

    [Required, MaxLength(100)]
    public string Username { get; set; } = null!;

    [MaxLength(200)]
    public string? Password { get; set; }

    [Required, MaxLength(50)]
    public string RoleName { get; set; } = null!;

    [Required, MaxLength(50)]
    public string LocationId { get; set; } = null!;

    public bool IsActive { get; set; } = true;
}

public sealed record AccountResponse(
    string UserId,
    string EmployeeId,
    string EmployeeName,
    string Username,
    string RoleName,
    bool IsActive,
    string? LocationId,
    string? LocationName)
{
    public static AccountResponse From(WMS_.Data.Entities.UserAccount account)
        => new(
            account.UserId,
            account.EmployeeId,
            account.Employee.EmployeeName,
            account.Username,
            account.Employee.RoleName,
            account.IsActive,
            account.Employee.LocationId,
            account.Employee.Location?.LocationName);
}
