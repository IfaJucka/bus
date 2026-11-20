import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Calendar,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Info,
  Layers,
} from 'lucide-react';

export interface HistoricalWaypoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  stopName?: string;
}

export interface DayRouteData {
  hasTrip: boolean;
  isHoliday: boolean;
  isNoTrip: boolean;
  isMissingGps: boolean;
  statusText: string;
  message: string;
  date: string;
  dayOfWeek?: string;
  trip?: any;
  routePath?: HistoricalWaypoint[];
  stops?: any[];
}

interface HistoricalRouteMapProps {
  data: DayRouteData | null;
  isLoading?: boolean;
}

export const HistoricalRouteMap: React.FC<HistoricalRouteMapProps> = ({ data, isLoading }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<HistoricalWaypoint | null>(null);

  // Initialize or re-render map when data changes
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [14.04, 74.52],
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing polyline & markers
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!data || !data.hasTrip || data.isMissingGps || !data.routePath || data.routePath.length === 0) {
      setSelectedPoint(null);
      return;
    }

    const pathCoords = data.routePath.map((p) => [p.lat, p.lng] as [number, number]);

    // Draw route polyline
    const poly = L.polyline(pathCoords, {
      color: '#1B365D',
      weight: 5,
      opacity: 0.85,
      smoothFactor: 1,
    }).addTo(map);
    polylineRef.current = poly;

    // Fit bounds
    if (pathCoords.length > 0) {
      map.fitBounds(poly.getBounds(), { padding: [40, 40] });
    }

    // Add interactive markers for each recorded checkpoint
    data.routePath.forEach((pt, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === data.routePath!.length - 1;
      const isStop = Boolean(pt.stopName);

      const markerColor = isStart ? '#10B981' : isEnd ? '#1B365D' : isStop ? '#F59E0B' : '#7BAFD4';
      const markerSize = isStart || isEnd || isStop ? 26 : 14;

      const iconHtml = `
        <div style="
          width: ${markerSize}px;
          height: ${markerSize}px;
          background: ${markerColor};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: bold;
          cursor: pointer;
        ">
          ${isStart ? 'S' : isEnd ? 'E' : isStop ? '•' : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'historical-checkpoint-icon',
        html: iconHtml,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const marker = L.marker([pt.lat, pt.lng], { icon: customIcon }).addTo(map);

      const timeFormatted = formatTime(pt.timestamp);
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 4px;">
          <strong style="color: #1B365D; font-size: 13px;">${pt.stopName || `Checkpoint #${idx + 1}`}</strong><br/>
          <span style="color: #4B6B94;">🕒 Recorded Time: <b>${timeFormatted}</b></span><br/>
          <span style="color: #4B6B94;">📍 Coordinates: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</span><br/>
          <span style="color: #10B981; font-weight: bold;">⚡ Speed: ${pt.speed} km/h</span>
        </div>
      `);

      marker.on('click', () => {
        setSelectedPoint(pt);
      });

      markersRef.current.push(marker);
    });

    // Default select first stop
    if (data.routePath.length > 0) {
      setSelectedPoint(data.routePath[0]);
    }
  }, [data]);

  const formatTime = (ts: string) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-brand-cream/30 rounded-2xl border border-brand-primary/50 p-4 space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-primary/30 pb-3">
        <div>
          <h3 className="text-base font-bold text-brand-navy flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-accent" />
            <span>Interactive Historical Route Map</span>
            {data?.date && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-secondary text-brand-navy">
                {data.dayOfWeek ? `${data.dayOfWeek}, ` : ''}{data.date}
              </span>
            )}
          </h3>
          <p className="text-xs text-brand-gray mt-0.5">
            Click any checkpoint or stop along the journey to inspect exact recorded timestamps and speed.
          </p>
        </div>

        {data?.statusText && (
          <span
            className={`text-xs font-bold px-3 py-1 rounded-xl self-start sm:self-center flex items-center gap-1.5 ${
              data.isHoliday
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : data.isNoTrip
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : data.isMissingGps
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            {data.isHoliday ? (
              <Calendar className="w-3.5 h-3.5" />
            ) : data.isNoTrip ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : data.isMissingGps ? (
              <Info className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{data.statusText}</span>
          </span>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 text-center text-xs text-brand-gray flex items-center justify-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-brand-navy border-t-transparent animate-spin" />
          <span>Loading historical trip telemetry...</span>
        </div>
      )}

      {/* Holiday / No Trip / Missing GPS Banner State */}
      {!isLoading && data && (data.isHoliday || data.isNoTrip || data.isMissingGps) && (
        <div
          className={`p-6 rounded-2xl border text-center space-y-2 ${
            data.isHoliday
              ? 'bg-purple-50/70 border-purple-200 text-purple-900'
              : data.isNoTrip
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-blue-50/70 border-blue-200 text-blue-900'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-white shadow-sm mb-2">
            {data.isHoliday ? (
              <Calendar className="w-6 h-6 text-purple-600" />
            ) : data.isNoTrip ? (
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            ) : (
              <Info className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <h4 className="font-extrabold text-sm sm:text-base">{data.message}</h4>
          <p className="text-xs opacity-80 max-w-md mx-auto">
            {data.isHoliday
              ? 'College was closed on this date according to the college operating schedule. No bus routes were operated.'
              : data.isNoTrip
              ? 'The college bus was not dispatched on this calendar day. No GPS tracking or trip start events were created.'
              : 'Trip records exist for this day, but GPS telemetry streaming was disabled or offline on the driver device.'}
          </p>
        </div>
      )}

      {/* Map Display & Point Telemetry Inspector */}
      {!isLoading && data && data.hasTrip && !data.isMissingGps && (
        <div className="space-y-3">
          <div
            ref={mapContainerRef}
            className="w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-brand-primary/60 shadow-inner z-0"
          />

          {/* Interactive Checkpoint Detail Bar */}
          {selectedPoint && (
            <div className="bg-white rounded-xl p-3.5 border border-brand-primary/50 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/30 flex items-center justify-center text-brand-navy">
                  <MapPin className="w-4 h-4 text-brand-accent" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-brand-gray block">Selected Location</span>
                  <span className="font-bold text-brand-navy text-sm">
                    {selectedPoint.stopName || `GPS Checkpoint (${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lng.toFixed(4)})`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] uppercase font-bold text-brand-gray flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Recorded Time
                  </span>
                  <span className="font-bold font-mono text-brand-navy text-sm">
                    {formatTime(selectedPoint.timestamp)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-brand-gray flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Vehicle Speed
                  </span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {selectedPoint.speed} km/h
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
