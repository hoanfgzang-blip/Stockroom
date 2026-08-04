const fs = require('fs');

// AppLayout.tsx
let al = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf-8');
al = al.replace(/PanelLeftOpen,\s*/, '');
fs.writeFileSync('src/components/layout/AppLayout.tsx', al);

// InboundOrdersPage.tsx
let ib = fs.readFileSync('src/pages/InboundOrdersPage.tsx', 'utf-8');
ib = ib.replace(/function formatTripQrResult\(trip: InboundCheckInResult, manifest\?: TripQrManifest \| null\) \{/, 'function formatTripQrResult(trip: InboundCheckInResult) {');
ib = ib.replace(/<div>\s*<p className="text-\[10px\] text-slate-400">Xe<\/p>\s*<p className="text-xs font-semibold">\{tripManifest\.vehicle\.id\}<\/p>\s*<\/div>/g, '');
ib = ib.replace(/<div>\s*<p className="text-\[10px\] text-slate-400">Từ<\/p>\s*<p className="text-xs font-medium">\{tripManifest\.origin\.name\}<\/p>\s*<\/div>/g, '');
ib = ib.replace(/<span className="font-mono font-semibold text-slate-800 truncate">\{tripManifest\.vehicle\.id\}<\/span>/g, '<span className="font-mono font-semibold text-slate-800 truncate">{tripManifest.tripId}</span>');
ib = ib.replace(/addResult\(result\.tripId, formatTripQrResult\(checkInResult, tripManifest\),/g, 'addResult(result.tripId, formatTripQrResult(checkInResult),');
fs.writeFileSync('src/pages/InboundOrdersPage.tsx', ib);
