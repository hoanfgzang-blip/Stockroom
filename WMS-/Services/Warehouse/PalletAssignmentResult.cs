namespace WMS_.Services.Warehouse
{
    public sealed record PalletAssignmentResult(
        bool Succeeded,
        string Message,
        string? SackId = null,
        string? PalletId = null,
        string? ZoneId = null,
        int AssignedSackCount = 0,
        string? Classification = null,
        string? DestinationName = null,
        string? ZoneName = null);
}
