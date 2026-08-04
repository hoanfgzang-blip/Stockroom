namespace WMS_.Data.Entities
{
    public static class ZoneProcessRoles
    {
        public const string General = "General";
        public const string InboundReceipt = "InboundReceipt";
        public const string LocalSortBuffer = "LocalSortBuffer";
        public const string LocalOutbound = "LocalOutbound";
        public const string InterprovinceOutbound = "InterprovinceOutbound";

        public static bool IsDispatch(string? processRole)
            => processRole is LocalOutbound or InterprovinceOutbound;

        public static bool IsKnown(string? processRole)
            => processRole is General or InboundReceipt or LocalSortBuffer or LocalOutbound or InterprovinceOutbound;
    }
}
