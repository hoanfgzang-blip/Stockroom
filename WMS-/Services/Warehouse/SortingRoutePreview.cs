using System.Collections.Generic;

namespace WMS_.Services.Warehouse
{
    public sealed record SortingPalletTarget(
        string PalletId,
        string DestinationLocationId,
        string DestinationName,
        string Status,
        int AssignedSackCount,
        decimal Capacity,
        string ZoneId,
        string ZoneName,
        string ProcessRole);

    public sealed record SortingRoutePreview(
        string SackId,
        string Classification,
        string DestinationId,
        string DestinationName,
        string NextHopId,
        string NextHopName,
        string TargetProcessRole,
        string TargetZoneLabel,
        IReadOnlyList<SortingPalletTarget> CandidatePallets,
        string? RecommendedPalletId);

    public sealed record AutoSortingResult(
        SortingRoutePreview Route,
        PalletAssignmentResult Assignment);
}
