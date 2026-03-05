import { describe, expect, it } from "vitest";
import { estimateDeliveryFromAddress, extractLatLngFromText } from "../src/domain/deliveryEstimator";

const config = {
  defaultShippingVnd: 30000,
  shopLat: 10.772081646838936,
  shopLng: 106.65817769618629,
  baseEtaMinutes: 20,
  perKmEtaMinutes: 4,
  fallbackEtaMinutes: 45,
};

describe("delivery estimator", () => {
  it("extracts lat/lng from google maps @lat,lng pattern with query params", () => {
    const input = "https://www.google.com/maps/@10.7558775,106.678116,16z?entry=ttu&g_ep=EgoyMDI2MDIyNS4wIKXMDSoASAFQAw%3D%3D";
    const point = extractLatLngFromText(input);
    expect(point).toEqual({ lat: 10.7558775, lng: 106.678116 });
  });

  it("returns fallback shipping when address has no coordinates", () => {
    const estimate = estimateDeliveryFromAddress("123 Nguyen Hue, Q1, TP.HCM", config);
    expect(estimate.shippingVnd).toBe(30000);
    expect(estimate.estimatedDeliveryMinutes).toBe(45);
    expect(estimate.deliveryDistanceKm).toBeUndefined();
  });

  it("returns dynamic shipping and eta when maps coordinates exist", () => {
    const estimate = estimateDeliveryFromAddress("https://www.google.com/maps/@10.7558775,106.678116,16z", config);
    expect(estimate.shippingVnd).toBeGreaterThan(0);
    expect(estimate.estimatedDeliveryMinutes).toBeGreaterThanOrEqual(20);
    expect(estimate.deliveryDistanceKm).toBeDefined();
  });
});
