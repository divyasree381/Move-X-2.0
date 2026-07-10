"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SelectedLocation } from "@movex/shared";

// Fix for default marker icons in Leaflet with Webpack/Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pickupIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMDY1ZjQ2IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiPjwvY2lyY2xlPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9IndoaXRlIj48L2NpcmNsZT48L3N2Zz4=",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const dropIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNFRjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMTBjMCA0LjkyNS04IDEyLTggMTJzLTgtNy4wNzUtOC0xMiBhOCA4IDAgMCAxIDE2IDBaIiBmaWxsPSIjRUY0NDQ0Ij48L3BhdGg+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyIgZmlsbD0id2hpdGUiIHN0cm9rZT0ibm9uZSI+PC9jaXJjbGU+PC9zdmc+",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

type RouteCoordinate = { lat: number; lng: number };

function decodePolyline(polyline: string): RouteCoordinate[] {
  const points: RouteCoordinate[] = [];
  let index = 0, lat = 0, lng = 0;

  try {
    while (index < polyline.length) {
      const latitude = decodePolylineValue(polyline, index);
      index = latitude.nextIndex;
      lat += latitude.value;

      const longitude = decodePolylineValue(polyline, index);
      index = longitude.nextIndex;
      lng += longitude.value;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
  } catch {
    return [];
  }
  return points;
}

function decodePolylineValue(polyline: string, startIndex: number) {
  let result = 0, shift = 0, index = startIndex, byte = 0;
  do {
    byte = polyline.charCodeAt(index) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
    index += 1;
  } while (byte >= 0x20);

  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

function AutoFitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else {
      map.setView([12.9716, 77.5946], 12); // Default to Bengaluru
    }
  }, [map, points]);
  return null;
}

export type LeafletMapProps = {
  pickup?: SelectedLocation | null;
  drop?: SelectedLocation | null;
  routePolyline?: string | null;
  className?: string;
};

export default function LeafletMap({ pickup, drop, routePolyline, className }: LeafletMapProps) {
  const decodedRoute = routePolyline ? decodePolyline(routePolyline).map(p => [p.lat, p.lng] as [number, number]) : [];
  
  const allPoints: [number, number][] = [
    ...(pickup ? [[pickup.lat, pickup.lng] as [number, number]] : []),
    ...(drop ? [[drop.lat, drop.lng] as [number, number]] : []),
    ...decodedRoute
  ];

  return (
    <div className={className}>
      <MapContainer 
        center={[12.9716, 77.5946]} 
        zoom={12} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoFitBounds points={allPoints} />
        
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {drop && <Marker position={[drop.lat, drop.lng]} icon={dropIcon} />}
        {decodedRoute.length > 0 && (
          <Polyline positions={decodedRoute} color="#0F6E56" weight={4} opacity={0.8} />
        )}
      </MapContainer>
    </div>
  );
}
