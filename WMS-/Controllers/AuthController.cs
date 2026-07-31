using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
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
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.Username == username);

        if (account == null || !account.IsActive || !PasswordHasher.Verify(request.Password, account.PasswordHash))
            return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng." });

        var response = AuthUserResponse.From(account.UserId, account.Username, account.Employee.EmployeeName, account.Employee.RoleName);
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
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.UserId == userId && user.IsActive);

        return account == null
            ? Unauthorized()
            : Ok(AuthUserResponse.From(account.UserId, account.Username, account.Employee.EmployeeName, account.Employee.RoleName));
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
    public async Task<ActionResult<IEnumerable<AccountResponse>>> GetAccounts()
    {
        var accounts = await _db.UserAccounts
            .Include(account => account.Employee)
            .Where(account => account.IsActive)
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

        var username = request.Username.Trim();
        if (await _db.UserAccounts.AnyAsync(account => account.Username == username))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại." });
        if (await _db.UserAccounts.AnyAsync(account => account.EmployeeId == request.EmployeeId))
            return Conflict(new { message = "Nhân viên này đã có tài khoản." });

        employee.RoleName = request.RoleName;
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

        var username = request.Username.Trim();
        if (await _db.UserAccounts.AnyAsync(item => item.Username == username && item.UserId != id))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại." });

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId == id && !request.IsActive)
            return BadRequest(new { message = "Không thể vô hiệu hóa tài khoản đang đăng nhập." });

        account.Username = username;
        account.IsActive = request.IsActive;
        account.Employee.RoleName = request.RoleName;
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

public sealed record AuthUserResponse(string UserId, string Username, string EmployeeName, string RoleName)
{
    public static AuthUserResponse From(string userId, string username, string employeeName, string roleName)
        => new(userId, username, employeeName, roleName);
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

    public bool IsActive { get; set; } = true;
}

public sealed record AccountResponse(string UserId, string EmployeeId, string EmployeeName, string Username, string RoleName, bool IsActive)
{
    public static AccountResponse From(WMS_.Data.Entities.UserAccount account)
        => new(account.UserId, account.EmployeeId, account.Employee.EmployeeName, account.Username, account.Employee.RoleName, account.IsActive);
}
