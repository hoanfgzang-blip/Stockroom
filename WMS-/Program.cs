using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Threading.RateLimiting;
using WMS_.Data;
using WMS_.Services;
using WMS_.Services.Warehouse;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration["WMS_DB_CONNECTION"]
    ?? builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("WMS_DB_CONNECTION or ConnectionStrings:DefaultConnection is required.");
builder.Services.AddDbContext<WmsDbContext>(options => options.UseNpgsql(connectionString));

builder.Services.AddControllers();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "__Host-wms-auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events.OnValidatePrincipal = async context =>
        {
            var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var db = context.HttpContext.RequestServices.GetRequiredService<WmsDbContext>();
            var account = string.IsNullOrWhiteSpace(userId)
                ? null
                : await db.UserAccounts.Include(item => item.Employee)
                    .SingleOrDefaultAsync(item => item.UserId == userId);
            var currentRole = context.Principal?.FindFirstValue(ClaimTypes.Role);
            var currentHub = context.Principal?.FindFirstValue("location_id");
            if (account?.IsActive != true || account?.Employee == null ||
                !string.Equals(currentRole, account.Employee?.RoleName, StringComparison.Ordinal) ||
                !string.Equals(currentHub, account.Employee?.LocationId, StringComparison.Ordinal))
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.AddPolicy("WarehouseOperations", policy =>
        policy.RequireRole("Manager", "Supervisor", "WarehouseStaff", "Operator"));
    options.AddPolicy("ReadOnlyOperations", policy =>
        policy.RequireRole("Manager", "Supervisor", "WarehouseStaff", "Operator", "Driver"));
    options.AddPolicy("DispatchOperations", policy =>
        policy.RequireRole("Manager", "Supervisor"));
    options.AddPolicy("ManagerOnly", policy => policy.RequireRole("Manager"));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("login", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IInboundService, InboundService>();
builder.Services.AddScoped<IOutboundService, OutboundService>();
builder.Services.AddScoped<IZoneService, ZoneService>();
builder.Services.AddScoped<IPalletService, PalletService>();
builder.Services.AddScoped<IWarehouseOperationService, WarehouseOperationService>();
builder.Services.AddScoped<ITrackingService, TrackingService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "WMS API", Version = "v1", Description = "Warehouse Management System REST API" });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "WMS API v1"));
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();
