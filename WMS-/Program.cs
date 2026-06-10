using WMS_.Components;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddDbContext<WmsDbContext>(options =>
    options.UseSqlite("Data Source=wms.db"));

builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<InboundService>();
builder.Services.AddScoped<OutboundService>();

var app = builder.Build();

// Ensure SQLite Database is initialized and seeded on start
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WmsDbContext>();
    db.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();


app.UseAntiforgery();

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();