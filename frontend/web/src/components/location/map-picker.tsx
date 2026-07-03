"use client";

import dynamic from "next/dynamic";
import type { SelectedLocation } from "@movex/shared";

const DynamicMapPicker = dynamic(() => import("./map-picker.client").then((mod) => mod.MapPickerClient), {
  ssr: false,
  loading: () => <div className="min-h-[28rem] rounded-lg border border-border bg-surface-muted shadow-[var(--shadow-shell)] sm:min-h-[34rem]" aria-label="Loading map" />,
});

type MapPickerProps = {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
  showAdvancedControls?: boolean;
};

export function MapPicker(props: MapPickerProps) {
  return <DynamicMapPicker {...props} />;
}

