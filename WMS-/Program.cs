using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Services;
using WMS_.Services.Warehouse;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<WmsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "__Host-wms-auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
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
        policy.RequireRole("Manager", "Supervisor", "WarehouseStaff", "Operator", "Driver"));
    options.AddPolicy("DispatchOperations", policy =>
        policy.RequireRole("Manager", "Supervisor"));
    options.AddPolicy("ManagerOnly", policy => policy.RequireRole("Manager"));
});
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
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();
