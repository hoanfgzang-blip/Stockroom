namespace WMS_.Configuration;

public static class OperationalHubScope
{
    public static readonly string[] HubIds =
    [
        "DEMO-HUB-HN",
        "DEMO-HUB-HCM",
        "DEMO-HUB-DN"
    ];

    public static readonly string[] ProvinceIds =
    [
        "DEMO-HN",
        "DEMO-HCM",
        "DEMO-DN"
    ];

    public static readonly string[] LocalDispatchLocationIds =
    [
        "DEMO-LOC-HN-01", "DEMO-LOC-HN-02", "DEMO-LOC-HN-03", "DEMO-LOC-HN-04",
        "DEMO-LOC-DN-01", "DEMO-LOC-DN-02", "DEMO-LOC-DN-03", "DEMO-LOC-DN-04",
        "DEMO-LOC-HCM-01", "DEMO-LOC-HCM-02", "DEMO-LOC-HCM-03", "DEMO-LOC-HCM-04"
    ];

    public static bool IsHub(string? locationId) => locationId != null && HubIds.Contains(locationId);
    public static bool IsProvince(string? provinceId) => provinceId != null && ProvinceIds.Contains(provinceId);
    public static bool IsLocalDispatchLocation(string? locationId) => locationId != null && LocalDispatchLocationIds.Contains(locationId);
    public static bool IsOutboundDestination(string? locationId) => IsHub(locationId) || IsLocalDispatchLocation(locationId);
}
