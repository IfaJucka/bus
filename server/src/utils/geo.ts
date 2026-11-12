export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteStopPoint {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  stopSequence: number;
  scheduledTime?: string;
}

/**
 * Validate latitude and longitude coordinates
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Great-circle distance between two points using Haversine formula (in Kilometers)
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Calculate route-aware remaining distance to target stop
 * Sums: distance from bus to next stop + distances between intermediate stops along the route sequence
 */
export function calculateRouteRemainingDistanceKm(
  currentLat: number,
  currentLng: number,
  stops: RouteStopPoint[],
  targetStopId: number
): { remainingDistanceKm: number; nextStopIndex: number; straightLineKm: number; busDeparted: boolean } {
  if (!stops || stops.length === 0) {
    return { remainingDistanceKm: 0, nextStopIndex: -1, straightLineKm: 0, busDeparted: false };
  }

  const sortedStops = [...stops].sort((a, b) => a.stopSequence - b.stopSequence);
  const targetIndex = sortedStops.findIndex((s) => s.id === targetStopId);

  if (targetIndex === -1) {
    const defaultTarget = sortedStops[sortedStops.length - 1];
    const straightLine = haversineDistanceKm(currentLat, currentLng, defaultTarget.latitude, defaultTarget.longitude);
    return { remainingDistanceKm: straightLine, nextStopIndex: 0, straightLineKm: straightLine, busDeparted: false };
  }

  const targetStop = sortedStops[targetIndex];
  const straightLine = haversineDistanceKm(currentLat, currentLng, targetStop.latitude, targetStop.longitude);

  // Find the closest stop along the entire route to determine current progress
  let nextStopIndex = 0;
  let minDistanceToStop = Infinity;

  for (let i = 0; i < sortedStops.length; i++) {
    const dist = haversineDistanceKm(currentLat, currentLng, sortedStops[i].latitude, sortedStops[i].longitude);
    if (dist < minDistanceToStop) {
      minDistanceToStop = dist;
      nextStopIndex = i;
    }
  }

  // If bus is within 150m of this stop, consider bus moving to next stop
  if (minDistanceToStop < 0.15 && nextStopIndex < sortedStops.length - 1) {
    nextStopIndex++;
  }

  // If the bus is past the target stop sequence, it has already departed this stop
  const busDeparted = nextStopIndex > targetIndex;
  if (busDeparted) {
    return {
      remainingDistanceKm: 0,
      nextStopIndex,
      straightLineKm: straightLine,
      busDeparted: true,
    };
  }

  // Compute road path distance: Bus -> next upcoming stop -> sequence of stops to target
  let remainingDistance = haversineDistanceKm(
    currentLat,
    currentLng,
    sortedStops[nextStopIndex].latitude,
    sortedStops[nextStopIndex].longitude
  );

  for (let i = nextStopIndex; i < targetIndex; i++) {
    const segment = haversineDistanceKm(
      sortedStops[i].latitude,
      sortedStops[i].longitude,
      sortedStops[i + 1].latitude,
      sortedStops[i + 1].longitude
    );
    // Multiply by road curvature factor (typically 1.15 to 1.25 for coastal highway & city approach)
    remainingDistance += segment * 1.15;
  }

  return {
    remainingDistanceKm: parseFloat(remainingDistance.toFixed(2)),
    nextStopIndex,
    straightLineKm: straightLine,
    busDeparted: false,
  };
}

/**
 * Calculate route-aware ETA in minutes
 * Accounts for bus speed, road conditions, and 2-min stop dwell time per intermediate stop
 */
export function calculateETA(
  remainingDistanceKm: number,
  currentSpeedKmH: number = 35,
  intermediateStopsCount: number = 0,
  delayOffsetMins: number = 0
): { etaMinutes: number; estimatedArrivalTime: string } {
  // Safe bounded speed: if stationary or slow (< 15 km/h), assume urban average 35 km/h
  const effectiveSpeed = currentSpeedKmH > 15 && currentSpeedKmH < 90 ? currentSpeedKmH : 38;
  
  const travelTimeMinutes = (remainingDistanceKm / effectiveSpeed) * 60;
  const dwellTimeMinutes = intermediateStopsCount * 2.0; // 2 minutes per stop
  const totalMinutes = Math.max(1, Math.round(travelTimeMinutes + dwellTimeMinutes + delayOffsetMins));

  const now = new Date();
  const arrivalDate = new Date(now.getTime() + totalMinutes * 60 * 1000);
  
  const hours = arrivalDate.getHours();
  const minutes = arrivalDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const estimatedArrivalTime = `${displayHours}:${displayMinutes} ${ampm}`;

  return {
    etaMinutes: totalMinutes,
    estimatedArrivalTime,
  };
}

/**
 * Check if a location coordinate is close enough to a stop (within radius in meters)
 */
export function isNearStop(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number = 200
): boolean {
  const distanceKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
  return distanceKm * 1000 <= radiusMeters;
}

/**
 * Calculate speed between two timestamped points in km/h
 */
export function calculateSpeedKmH(
  lat1: number,
  lon1: number,
  time1: Date | number,
  lat2: number,
  lon2: number,
  time2: Date | number
): number {
  const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
  const t1 = typeof time1 === 'number' ? time1 : time1.getTime();
  const t2 = typeof time2 === 'number' ? time2 : time2.getTime();
  const hours = Math.abs(t2 - t1) / (1000 * 60 * 60);
  if (hours <= 0) return 0;
  const speed = distKm / hours;
  return parseFloat(Math.min(speed, 100).toFixed(1));
}

/**
 * Check if GPS data is stale (no updates in > staleThresholdSec)
 */
export function isGpsStale(lastTimestamp: Date | string | number | null, staleThresholdSec: number = 45): boolean {
  if (!lastTimestamp) return true;
  const lastTime = new Date(lastTimestamp).getTime();
  if (isNaN(lastTime)) return true;
  const now = Date.now();
  return (now - lastTime) / 1000 > staleThresholdSec;
}

export interface RoadRouteResult {
  coordinates: [number, number][]; // [lat, lng] array for Leaflet
  totalDistanceKm: number;
  estimatedDurationMins: number;
  legs: Array<{ distanceKm: number; durationMins: number }>;
}

/**
 * Fetch genuine road network driving route from OSRM with graceful fallback
 */
export async function calculateRoadNetworkRoute(
  stops: Array<{ latitude: number; longitude: number }>
): Promise<RoadRouteResult> {
  if (!stops || stops.length === 0) {
    return { coordinates: [], totalDistanceKm: 0, estimatedDurationMins: 0, legs: [] };
  }

  if (stops.length === 1) {
    return {
      coordinates: [[stops[0].latitude, stops[0].longitude]],
      totalDistanceKm: 0,
      estimatedDurationMins: 0,
      legs: [],
    };
  }

  try {
    const coordsStr = stops.map((s) => `${s.longitude},${s.latitude}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SmartCollegeBus/1.0' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM returns GeoJSON coordinates as [lng, lat] -> convert to Leaflet [lat, lng]
        const latLngCoords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );
        const totalDistanceKm = parseFloat((route.distance / 1000).toFixed(2));
        const estimatedDurationMins = Math.round(route.duration / 60);

        const legs = (route.legs || []).map((leg: any) => ({
          distanceKm: parseFloat((leg.distance / 1000).toFixed(2)),
          durationMins: Math.round(leg.duration / 60),
        }));

        return {
          coordinates: latLngCoords,
          totalDistanceKm,
          estimatedDurationMins,
          legs,
        };
      }
    }
  } catch (err: any) {
    console.warn('[Geo] OSRM road routing request failed, falling back to highway interpolation:', err.message);
  }

  // Fallback: Generate highway-interpolated waypoints between consecutive stops
  const interpolatedCoords: [number, number][] = [];
  let totalDistanceKm = 0;
  const legs: Array<{ distanceKm: number; durationMins: number }> = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i];
    const end = stops[i + 1];
    const straightDist = haversineDistanceKm(start.latitude, start.longitude, end.latitude, end.longitude);
    const roadDist = parseFloat((straightDist * 1.18).toFixed(2));
    totalDistanceKm += roadDist;
    const legMins = Math.max(3, Math.round((roadDist / 38) * 60));
    legs.push({ distanceKm: roadDist, durationMins: legMins });

    // Generate intermediate curve points
    const stepCount = Math.max(4, Math.min(20, Math.round(straightDist * 2)));
    for (let step = 0; step < stepCount; step++) {
      const t = step / stepCount;
      const lat = start.latitude + (end.latitude - start.latitude) * t;
      const lng = start.longitude + (end.longitude - start.longitude) * t;
      interpolatedCoords.push([lat, lng]);
    }
  }

  const lastStop = stops[stops.length - 1];
  interpolatedCoords.push([lastStop.latitude, lastStop.longitude]);

  return {
    coordinates: interpolatedCoords,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
    estimatedDurationMins: Math.round((totalDistanceKm / 38) * 60),
    legs,
  };
}
