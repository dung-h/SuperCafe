export type DeliveryEstimatorConfig = {
  defaultShippingVnd: number;
  shopLat: number;
  shopLng: number;
  baseEtaMinutes: number;
  perKmEtaMinutes: number;
  fallbackEtaMinutes: number;
};

export type DeliveryEstimate = {
  shippingVnd: number;
  estimatedDeliveryMinutes: number;
  deliveryDistanceKm?: number;
};

export function estimateDeliveryFromAddress(address: string, config: DeliveryEstimatorConfig): DeliveryEstimate {
  const trimmed = String(address || "").trim();
  const fallbackShipping = Math.max(0, Math.trunc(config.defaultShippingVnd));
  const fallbackEta = Math.max(10, Math.trunc(config.fallbackEtaMinutes));
  const coords = extractLatLngFromText(trimmed);

  if (!coords) {
    return {
      shippingVnd: fallbackShipping,
      estimatedDeliveryMinutes: fallbackEta,
    };
  }

  const distanceKm = haversineKm(config.shopLat, config.shopLng, coords.lat, coords.lng);
  const roundedDistance = Number(distanceKm.toFixed(2));

  const nearFee = Math.max(10000, Math.round(fallbackShipping * 0.5));
  const standardFee = Math.max(15000, Math.round(fallbackShipping * 0.83));
  const farBaseFee = Math.max(35000, fallbackShipping);

  let shippingVnd = fallbackShipping;
  if (distanceKm <= 2) {
    shippingVnd = nearFee;
  } else if (distanceKm <= 5) {
    shippingVnd = standardFee;
  } else {
    shippingVnd = farBaseFee + Math.ceil(distanceKm - 5) * 3000;
  }

  const eta = Math.max(
    Math.trunc(config.baseEtaMinutes),
    Math.min(120, Math.trunc(config.baseEtaMinutes + Math.ceil(distanceKm * config.perKmEtaMinutes))),
  );

  return {
    shippingVnd,
    estimatedDeliveryMinutes: eta,
    deliveryDistanceKm: roundedDistance,
  };
}

export function extractLatLngFromText(input: string): { lat: number; lng: number } | null {
  if (!input) {
    return null;
  }

  const normalized = safeDecodeURIComponent(input);
  const candidates = [input, normalized];

  for (const value of candidates) {
    const fromAt = value.match(/@\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
    if (fromAt) {
      const point = toPoint(fromAt[1], fromAt[2]);
      if (point) return point;
    }

    const fromQuery = value.match(/[?&](?:q|query|ll)=\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i);
    if (fromQuery) {
      const point = toPoint(fromQuery[1], fromQuery[2]);
      if (point) return point;
    }

    const fromEmbed = value.match(/!3d\s*(-?\d{1,2}(?:\.\d+)?)!4d\s*(-?\d{1,3}(?:\.\d+)?)/i);
    if (fromEmbed) {
      const point = toPoint(fromEmbed[1], fromEmbed[2]);
      if (point) return point;
    }

    const fromGeo = value.match(/geo:\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i);
    if (fromGeo) {
      const point = toPoint(fromGeo[1], fromGeo[2]);
      if (point) return point;
    }
  }

  return null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toPoint(latRaw: string, lngRaw: string): { lat: number; lng: number } | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}
