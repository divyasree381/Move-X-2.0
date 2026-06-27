"use client";

import { useEffect } from "react";

import { realtimeSubscribeUrl, type RealtimeMessage } from "@/lib/api";

export function useRealtimeTopic(topic: string | null, onMessage: (message: RealtimeMessage) => void) {
  useEffect(() => {
    if (!topic || typeof EventSource === "undefined") {
      return;
    }

    const source = new EventSource(realtimeSubscribeUrl(topic), { withCredentials: true });

    function handle(event: MessageEvent) {
      try {
        onMessage(JSON.parse(event.data) as RealtimeMessage);
      } catch {
        // Ignore malformed realtime payloads from stale browser connections.
      }
    }

    source.addEventListener("order.status.changed", handle);
    source.addEventListener("order.partner.assigned", handle);
    source.addEventListener("partner.location.updated", handle);
    source.addEventListener("order.rated", handle);
    source.addEventListener("ride.requested", handle);
    source.addEventListener("ride.offer.created", handle);
    source.addEventListener("ride.accepted", handle);
    source.addEventListener("ride.status.changed", handle);
    source.addEventListener("ride.cancelled", handle);
    source.addEventListener("ride.rated", handle);
    source.addEventListener("driver.location.updated", handle);
    source.addEventListener("courier.requested", handle);
    source.addEventListener("courier.offer.created", handle);
    source.addEventListener("courier.accepted", handle);
    source.addEventListener("courier.status.changed", handle);
    source.addEventListener("courier.cancelled", handle);
    source.addEventListener("courier.rated", handle);
    source.addEventListener("home-service.requested", handle);
    source.addEventListener("home-service.offer.created", handle);
    source.addEventListener("home-service.accepted", handle);
    source.addEventListener("home-service.status.changed", handle);
    source.addEventListener("home-service.cancelled", handle);
    source.addEventListener("home-service.rated", handle);

    return () => source.close();
  }, [topic, onMessage]);
}