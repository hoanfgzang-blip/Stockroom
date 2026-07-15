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
