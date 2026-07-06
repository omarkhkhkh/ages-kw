/**
 * TruckMap — Leaflet map showing GPS positions of transportation orders.
 * Uses dynamic import to avoid SSR issues with Leaflet.
 */
import { useEffect, useRef } from "react";

interface TruckMarker {
  id: number;
  orderNumber: string | null;
  description: string;
  vehicleInfo: string | null;
  status: string;
  lat: number;
  lng: number;
  locationUpdatedAt: string | null;
  origin: string | null;
  destination: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    "#d97706",
  in_transit: "#2563eb",
  delivered:  "#16a34a",
  cancelled:  "#dc2626",
};
const STATUS_LABELS: Record<string, string> = {
  pending:    "قيد الانتظار",
  in_transit: "جارٍ النقل",
  delivered:  "تم التسليم",
  cancelled:  "ملغي",
};

function truckSvg(color: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="18" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"/>
      <circle cx="19" cy="19" r="13" fill="${color}" fill-opacity="0.85"/>
      <text x="19" y="24" text-anchor="middle" font-size="16" fill="white">🚛</text>
    </svg>
  `;
}

export function TruckMap({ markers, onUpdateLocation, canEdit, isAdmin }: {
  markers: TruckMarker[];
  onUpdateLocation: (id: number, lat: number, lng: number) => void;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const mapRef   = useRef<HTMLDivElement>(null);
  const leafRef  = useRef<any>(null);   // L instance
  const mapInst  = useRef<any>(null);   // map instance
  const layerRef = useRef<any>(null);   // marker layer

  // Bootstrap Leaflet once
  useEffect(() => {
    if (mapInst.current || !mapRef.current) return;

    // Inject Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then(L => {
      leafRef.current = L;
      const defaultLat = 29.3759, defaultLng = 47.9774; // Kuwait City
      const m = L.map(mapRef.current!, { zoomControl: true }).setView([defaultLat, defaultLng], 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(m);

      mapInst.current  = m;
      layerRef.current = L.layerGroup().addTo(m);
      renderMarkers();
    });

    return () => {
      mapInst.current?.remove();
      mapInst.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers whenever data changes
  useEffect(() => { renderMarkers(); }, [markers, canEdit, isAdmin]);

  function renderMarkers() {
    const L = leafRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;

    layer.clearLayers();

    markers.forEach(m => {
      const color = STATUS_COLORS[m.status] ?? "#6b7280";
      const icon  = L.divIcon({
        html: truckSvg(color),
        iconSize:   [38, 38],
        iconAnchor: [19, 38],
        popupAnchor:[0, -38],
        className:  "",
      });

      const updatedStr = m.locationUpdatedAt
        ? new Date(m.locationUpdatedAt).toLocaleString("ar-KW", { timeZone: "Asia/Kuwait" })
        : "غير معروف";

      const updateBtn = canEdit
        ? `<button id="gps-update-${m.id}" style="margin-top:8px;width:100%;padding:6px 0;border-radius:8px;border:none;background:#D4A534;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📍 تحديث الموقع الآن</button>`
        : "";

      const googleBtn = `<a href="https://www.google.com/maps?q=${m.lat},${m.lng}" target="_blank" style="display:block;margin-top:6px;text-align:center;font-size:11px;color:#2563eb;text-decoration:underline">فتح في خرائط Google</a>`;

      const popup = L.popup({ maxWidth: 260, className: "" }).setContent(`
        <div dir="rtl" style="font-family:'Cairo',sans-serif;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
            <strong style="font-size:13px;color:#132a18">${m.description}</strong>
          </div>
          ${m.orderNumber ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px">رقم الأمر: <b>${m.orderNumber}</b></div>` : ""}
          ${m.vehicleInfo ? `<div style="font-size:11px;color:#374151;margin-bottom:4px">🚛 ${m.vehicleInfo}</div>` : ""}
          ${(m.origin||m.destination) ? `<div style="font-size:11px;color:#374151;margin-bottom:4px">📍 ${m.origin??""} ← ${m.destination??""}</div>` : ""}
          <div style="font-size:11px;padding:5px 8px;border-radius:6px;background:${color}18;color:${color};font-weight:700;margin-bottom:4px">${STATUS_LABELS[m.status]??m.status}</div>
          <div style="font-size:10px;color:#9ca3af">آخر تحديث: ${updatedStr}</div>
          <div style="font-size:10px;color:#9ca3af;font-family:monospace">${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</div>
          ${updateBtn}
          ${googleBtn}
        </div>
      `);

      const mk = L.marker([m.lat, m.lng], { icon }).addTo(layer).bindPopup(popup);

      mk.on("popupopen", () => {
        const btn = document.getElementById(`gps-update-${m.id}`);
        if (btn) {
          btn.addEventListener("click", () => {
            btn.textContent = "⏳ جاري تحديد الموقع...";
            btn.setAttribute("disabled", "true");
            navigator.geolocation.getCurrentPosition(
              pos => { onUpdateLocation(m.id, pos.coords.latitude, pos.coords.longitude); mk.closePopup(); },
              () => { btn.textContent = "❌ تعذّر الوصول للموقع"; btn.removeAttribute("disabled"); },
              { enableHighAccuracy: true, timeout: 15000 }
            );
          });
        }
      });
    });

    // Auto-zoom to markers if any
    if (markers.length > 0 && mapInst.current) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]));
      mapInst.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  return (
    <div ref={mapRef} style={{ width: "100%", height: "100%", borderRadius: 16, overflow: "hidden" }} />
  );
}
