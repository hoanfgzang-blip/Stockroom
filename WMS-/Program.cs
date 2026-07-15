using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Services;
using WMS_.Services.Warehouse;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<WmsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();
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
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
