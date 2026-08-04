using System.Security.Claims;

namespace WMS_.Security;

public static class HubAccess
{
    public static string? HubId(this ClaimsPrincipal user)
        => user.FindFirstValue("location_id");

    public static bool CanAccessHub(this ClaimsPrincipal user, string? hubId)
        => !string.IsNullOrWhiteSpace(hubId) &&
           string.Equals(user.HubId(), hubId, StringComparison.Ordinal);
}
