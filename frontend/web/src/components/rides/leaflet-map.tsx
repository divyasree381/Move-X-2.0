"use client";

import type { SelectedLocation } from "@movex/shared";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
type PinMode = "pickup" | "drop";

function decodePolyline(polyline: string): RouteCoordinate[] {
  const points: RouteCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

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
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;

  do {
    byte = polyline.charCodeAt(index) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
    index += 1;
  } while (byte >= 0x20);

  return { value: result & 1 ? ~(result >> 1) : result >> 1, nextIndex: index };
}

function AutoFitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      const desktop = map.getSize().x >= 1024;
      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [56, 56],
        paddingBottomRight: desktop ? [500, 56] : [56, 280],
        maxZoom: 16,
      });
    } else {
      map.setView([12.9716, 77.5946], 12);
    }
  }, [map, points]);

  return null;
}

function CenterPinController({ location, onCenterChange, onMovingChange }: { location: SelectedLocation; onCenterChange: (lat: number, lng: number) => void; onMovingChange?: (moving: boolean) => void }) {
  const map = useMapEvents({
    movestart: () => onMovingChange?.(true),
    moveend: () => {
      const center = map.getCenter();
      onMovingChange?.(false);
      onCenterChange(center.lat, center.lng);
    },
  });

  useEffect(() => {
    const target = L.latLng(location.lat, location.lng);
    if (!map.getCenter().equals(target, 0.0000001)) {
      map.setView(target, Math.max(map.getZoom(), 16), { animate: false });
    }
  }, [location.lat, location.lng, map]);

  return null;
}

export type LeafletMapProps = {
  pickup?: SelectedLocation | null;
  drop?: SelectedLocation | null;
  routePolyline?: string | null;
  className?: string;
  pinMode?: PinMode | null;
  pinLocation?: SelectedLocation | null;
  onPinCenterChange?: (lat: number, lng: number) => void;
  onPinMovingChange?: (moving: boolean) => void;
};

export default function LeafletMap({ pickup, drop, routePolyline, className, pinMode = null, pinLocation, onPinCenterChange, onPinMovingChange }: LeafletMapProps) {
  const decodedRoute = useMemo(() => routePolyline ? decodePolyline(routePolyline).map((point) => [point.lat, point.lng] as [number, number]) : [], [routePolyline]);
  const allPoints = useMemo<[number, number][]>(() => [
    ...(pickup ? [[pickup.lat, pickup.lng] as [number, number]] : []),
    ...(drop ? [[drop.lat, drop.lng] as [number, number]] : []),
    ...decodedRoute,
  ], [decodedRoute, drop, pickup]);
  const centerPinEnabled = Boolean(pinMode && pinLocation && onPinCenterChange);

  return (
    <div className={className}>
      <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ZoomControl position="bottomleft" />
        {centerPinEnabled ? (
          <CenterPinController location={pinLocation!} onCenterChange={onPinCenterChange!} onMovingChange={onPinMovingChange} />
        ) : (
          <AutoFitBounds points={allPoints} />
        )}

        {pickup && pinMode !== "pickup" ? <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} /> : null}
        {drop && pinMode !== "drop" ? <Marker position={[drop.lat, drop.lng]} icon={dropIcon} /> : null}
        {decodedRoute.length > 0 && !pinMode ? <Polyline positions={decodedRoute} color="var(--primary)" weight={5} opacity={0.88} /> : null}
      </MapContainer>
    </div>
  );
}
