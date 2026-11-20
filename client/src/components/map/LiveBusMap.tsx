import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  Navigation2,
  Maximize2,
  AlertCircle,
  Clock,
  Gauge,
  Milestone,
} from 'lucide-react';
import { Bus, Route, RouteStop } from '../../types';
import { api } from '../../services/api';

interface LiveBusMapProps {
  bus: Bus | null;
  route: Route | null;
  selectedStopId?: number | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  onSelectStop?: (stop: RouteStop) => void;
  className?: string;
}

export const LiveBusMap: React.FC<LiveBusMapProps> = ({
  bus,
  route,
  selectedStopId,
  etaMinutes,
  distanceKm,
  onSelectStop,
  className = 'h-[500px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const bgPolylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const routeFittedIdRef = useRef<number | null>(null);
  const [autoCenter, setAutoCenter] = useState<boolean>(true);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center near Murdeshwar / Bhatkal coastal highway (14.04, 74.52)
    const map = L.map(mapContainerRef.current, {
      center: [14.04, 74.52],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Turn off autoCenter when the user manually explores, drags, or zooms the map
    map.on('dragstart', () => {
      setAutoCenter(false);
    });
    map.on('zoomstart', () => {
      setAutoCenter(false);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Route Polyline and Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route || !route.stops || route.stops.length === 0) return;

    // Clear old markers and polylines
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (bgPolylineRef.current) {
      bgPolylineRef.current.remove();
      bgPolylineRef.current = null;
    }

    const sortedStops = [...route.stops].sort((a, b) => a.stop_sequence - b.stop_sequence);
    const stopCoords: [number, number][] = sortedStops.map((s) => [s.latitude, s.longitude]);

    // Check if route already has genuine road network geometry
    const hasRoadGeometry = (route as any).road_geometry && Array.isArray((route as any).road_geometry) && (route as any).road_geometry.length > 0;
    const initialCoords: [number, number][] = hasRoadGeometry ? (route as any).road_geometry : stopCoords;

    // Draw route polyline
    const polyline = L.polyline(initialCoords, {
      color: '#6FA8D6',
      weight: 6,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '1, 10',
      dashSpeed: 20,
    } as any).addTo(map);

    // Add solid background path
    const bgLine = L.polyline(initialCoords, {
      color: '#263746',
      weight: 4,
      opacity: 0.6,
    }).addTo(map);

    routePolylineRef.current = polyline;
    bgPolylineRef.current = bgLine;

    // If no road network geometry was pre-saved, fetch genuine road path dynamically via OSRM
    if (!hasRoadGeometry && stopCoords.length >= 2) {
      api.routes
        .calculateRoadPath(sortedStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })))
        .then((res) => {
          if (res && res.coordinates && res.coordinates.length > 0 && mapInstanceRef.current) {
            polyline.setLatLngs(res.coordinates);
            bgLine.setLatLngs(res.coordinates);
          }
        })
        .catch(() => {});
    }

    // Add markers for each stop
    sortedStops.forEach((stop, index) => {
      const isSelected = selectedStopId === stop.pickup_point_id;
      const isCollege = index === sortedStops.length - 1;

      const stopIconHtml = `
        <div class="relative flex items-center justify-center">
          ${
            isSelected
              ? '<div class="absolute -inset-2 bg-brand-primary rounded-full animate-ping opacity-60"></div>'
              : ''
          }
          <div class="w-8 h-8 rounded-full border-2 ${
            isSelected
              ? 'bg-[#263746] border-[#A9D6F5] text-white'
              : isCollege
              ? 'bg-emerald-600 border-white text-white'
              : 'bg-white border-[#6FA8D6] text-[#263746]'
          } flex items-center justify-center font-bold text-xs shadow-md cursor-pointer hover:scale-110 transition-transform">
            ${isCollege ? '🎓' : stop.stop_sequence}
          </div>
        </div>
      `;

      const stopIcon = L.divIcon({
        html: stopIconHtml,
        className: 'custom-stop-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(map);

      marker.bindPopup(`
        <div class="p-1 font-sans text-brand-navy">
          <div class="font-bold text-sm">${stop.stop_name}</div>
          <div class="text-xs text-gray-500 mt-0.5">Stop #${stop.stop_sequence} • Sched: ${stop.scheduled_arrival_time}</div>
          ${stop.landmark ? `<div class="text-xs text-brand-accent mt-1">📍 ${stop.landmark}</div>` : ''}
          ${isSelected ? '<div class="mt-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">✓ Your Selected Pickup Stop</div>' : ''}
        </div>
      `);

      marker.on('click', () => {
        if (onSelectStop) onSelectStop(stop);
      });

      stopMarkersRef.current.push(marker);
    });

    // Fit map bounds to route on initial load or when stop count changes
    if (stopCoords.length > 0 && (routeFittedIdRef.current !== route.id || !bus)) {
      try {
        map.fitBounds(L.latLngBounds(stopCoords), { padding: [40, 40] });
      } catch (err) {}
      routeFittedIdRef.current = route.id;
    }
  }, [route?.id, route?.stops?.length, (route as any)?.road_geometry, selectedStopId]);

  // Update Bus Marker with Real-time GPS Position
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!bus || !bus.last_latitude || !bus.last_longitude) {
      if (busMarkerRef.current) {
        busMarkerRef.current.remove();
        busMarkerRef.current = null;
      }
      return;
    }

    const busLat = bus.last_latitude;
    const busLng = bus.last_longitude;
    const heading = bus.last_heading || 0;
    const isOffline = bus.gps_status === 'offline' || bus.status === 'trip_completed' || bus.status === 'not_started';
    const isStale = bus.gps_status === 'stale';

    const busIconHtml = `
      <div class="relative flex items-center justify-center w-12 h-12">
        ${
          !isStale && !isOffline && bus.status === 'running_on_time'
            ? '<div class="absolute -inset-2.5 bg-[#A9D6F5] rounded-full animate-pulse opacity-75 pointer-events-none"></div>'
            : ''
        }
        ${
          !isOffline && heading !== undefined && heading !== null && heading !== 0
            ? `<div class="absolute -inset-2 flex items-start justify-center pointer-events-none transition-transform duration-500 ease-out" style="transform: rotate(${heading}deg);">
                <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-[#A9D6F5] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"></div>
              </div>`
            : ''
        }
        <div class="w-12 h-12 rounded-2xl ${
          isOffline
            ? 'bg-gray-700 border-2 border-gray-400'
            : isStale
            ? 'bg-[#263746] border-2 border-amber-400'
            : 'bg-[#263746] border-2 border-[#A9D6F5]'
        } flex flex-col items-center justify-center text-white shadow-xl transition-all select-none" style="transform: none !important;">
          <span class="text-xl leading-none select-none" style="display: inline-block; transform: none !important;">🚌</span>
          <span class="text-[9px] font-bold ${
            isOffline ? 'text-gray-300' : isStale ? 'text-amber-300' : 'text-[#A9D6F5]'
          } mt-0.5 tracking-tighter leading-none">${bus.bus_number.split('-')[0]}</span>
        </div>
      </div>
    `;

    const busIcon = L.divIcon({
      html: busIconHtml,
      className: 'custom-bus-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    const popupHtml = `
      <div class="p-1 font-sans text-brand-navy">
        <div class="font-bold text-sm">${bus.bus_name} (${bus.bus_number})</div>
        <div class="text-xs text-gray-500 mt-0.5">Driver: ${bus.driver_name || 'Assigned Driver'}</div>
        <div class="text-xs font-semibold mt-1">Speed: ${bus.last_speed ?? 0} km/h • Heading: ${heading}°</div>
        <div class="text-xs font-medium mt-0.5 ${
          isOffline ? 'text-gray-500' : isStale ? 'text-amber-600' : 'text-emerald-600'
        }">
          Status: <span class="capitalize">${isOffline ? 'Offline' : isStale ? 'GPS Signal Lost' : 'Live Tracking'}</span>
        </div>
      </div>
    `;

    if (busMarkerRef.current) {
      busMarkerRef.current.setLatLng([busLat, busLng]);
      busMarkerRef.current.setIcon(busIcon);
      busMarkerRef.current.setPopupContent(popupHtml);
    } else {
      busMarkerRef.current = L.marker([busLat, busLng], { icon: busIcon, zIndexOffset: 1000 }).addTo(map);
      busMarkerRef.current.bindPopup(popupHtml);
    }

    if (autoCenter) {
      map.panTo([busLat, busLng], { animate: true, duration: 0.8 });
    }
  }, [bus?.last_latitude, bus?.last_longitude, bus?.last_heading, bus?.last_speed, bus?.gps_status, bus?.status, autoCenter]);

  const handleFitRoute = () => {
    const map = mapInstanceRef.current;
    if (!map || !route || !route.stops || route.stops.length === 0) return;
    const coords: [number, number][] = route.stops.map((s) => [s.latitude, s.longitude]);
    if (bus?.last_latitude && bus?.last_longitude) {
      coords.push([bus.last_latitude, bus.last_longitude]);
    }
    map.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });
    setAutoCenter(false);
  };

  const handleRecenterBus = () => {
    const map = mapInstanceRef.current;
    if (!map || !bus?.last_latitude || !bus?.last_longitude) return;
    map.flyTo([bus.last_latitude, bus.last_longitude], 14, { animate: true, duration: 1.2 });
    setAutoCenter(true);
  };

  const isBusOffline = !bus || bus.gps_status === 'offline' || bus.status === 'trip_completed' || bus.status === 'not_started';
  const isGpsStale = bus?.gps_status === 'stale';
  const hasLiveGps = !!(bus?.last_latitude && bus?.last_longitude && bus?.gps_status === 'active' && !isGpsStale && !isBusOffline);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-brand-primary/50 shadow-card bg-brand-cream flex flex-col ${className}`}>
      {/* Interactive Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0 flex-1" />

      {/* Floating Map Action Buttons */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleRecenterBus}
          className={`p-2.5 rounded-xl shadow-card backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-semibold ${
            autoCenter
              ? 'bg-[#263746] text-white shadow-md'
              : 'bg-white/90 text-brand-navy hover:bg-brand-primary'
          }`}
          title="Recenter on Bus"
        >
          <Navigation2 className="w-4 h-4 text-brand-primary" />
          <span className="hidden sm:inline">Follow Bus</span>
        </button>

        <button
          onClick={handleFitRoute}
          className="p-2.5 bg-white/90 hover:bg-brand-primary text-brand-navy rounded-xl shadow-card backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-semibold"
          title="View Complete Route"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Fit Route</span>
        </button>
      </div>

      {/* GPS Status Indicator Ribbon */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {hasLiveGps ? (
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-emerald-200 flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live GPS Active</span>
          </div>
        ) : isGpsStale ? (
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-amber-200 flex items-center gap-2 text-xs font-semibold text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>GPS Signal Lost (Reconnecting...)</span>
          </div>
        ) : isBusOffline ? (
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 text-xs font-semibold text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
            <span>Bus Offline (Trip Inactive)</span>
          </div>
        ) : (
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-brand-secondary flex items-center gap-2 text-xs font-semibold text-brand-gray">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
            <span>Waiting for GPS Signal...</span>
          </div>
        )}
      </div>

      {/* Live Telemetry Card (Desktop Overlay / Mobile Bottom Card) */}
      <div className="bg-white/95 backdrop-blur-md border-t border-brand-primary/40 px-4 py-3 z-10 flex flex-wrap items-center justify-between gap-3 text-xs text-brand-navy">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Milestone className="w-4 h-4 text-brand-accent flex-shrink-0" />
            <span>
              Distance to Stop:{' '}
              <strong className="text-brand-navy font-bold">
                {hasLiveGps && distanceKm !== null && distanceKm !== undefined
                  ? `${distanceKm} km`
                  : isBusOffline
                  ? 'Trip Inactive'
                  : isGpsStale
                  ? 'Signal Lost'
                  : 'Waiting GPS'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              ETA:{' '}
              <strong className="text-emerald-700 font-bold">
                {hasLiveGps && etaMinutes !== null && etaMinutes !== undefined
                  ? `${etaMinutes} mins`
                  : isBusOffline
                  ? 'Trip Inactive'
                  : isGpsStale
                  ? 'Signal Lost'
                  : 'Waiting for GPS'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 hidden sm:flex">
            <Gauge className="w-4 h-4 text-brand-gray flex-shrink-0" />
            <span>
              Speed: <strong>{bus?.last_speed ?? 0} km/h</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 hidden md:flex text-brand-gray">
            <Compass className="w-4 h-4 text-brand-gray flex-shrink-0" />
            <span>
              Coords:{' '}
              {bus?.last_latitude && bus?.last_longitude
                ? `${bus.last_latitude.toFixed(4)}°, ${bus.last_longitude.toFixed(4)}°`
                : 'Waiting signal'}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-brand-gray">
          Last GPS update:{' '}
          {bus?.last_gps_timestamp
            ? new Date(bus.last_gps_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'No telemetry yet'}
        </div>
      </div>
    </div>
  );
};
