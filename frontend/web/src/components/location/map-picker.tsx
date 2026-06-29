"use client";

import dynamic from "next/dynamic";
import type { SelectedLocation } from "@movex/shared";

const DynamicMapPicker = dynamic(() => import("./map-picker.client").then((mod) => mod.MapPickerClient), {
  ssr: false,
  loading: () => <div className="h-72 rounded-md border border-input bg-surface-muted" aria-label="Loading map" />,
});

type MapPickerProps = {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
};

export function MapPicker(props: MapPickerProps) {
  return <DynamicMapPicker {...props} />;
}