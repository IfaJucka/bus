import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';

interface MapLocationPickerProps {
  latitude: number;
  longitude: number;
  address?: string;
  onChange: (lat: number, lng: number, address?: string) => void;
  className?: string;
}

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  latitude,
  longitude,
  address,
  onChange,
  className = 'h-[250px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = Number(latitude) && !isNaN(Number(latitude)) ? Number(latitude) : 14.04;
    const initialLng = Number(longitude) && !isNaN(Number(longitude)) ? Number(longitude) : 74.52;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Custom Draggable Pin Icon
    const customIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full">
          <div class="w-8 h-8 bg-brand-navy rounded-full border-2 border-brand-primary flex items-center justify-center text-white shadow-elevated text-xs font-bold">
            📍
          </div>
          <div class="w-2.5 h-2.5 bg-brand-navy rotate-45 -mt-1.5 shadow-sm"></div>
        </div>
      `,
      className: 'location-picker-pin',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: customIcon,
    }).addTo(map);

    marker.bindTooltip('Drag or click map to reposition', {
      permanent: false,
      direction: 'top',
    });

    // Marker drag end event
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const newLat = parseFloat(pos.lat.toFixed(6));
      const newLng = parseFloat(pos.lng.toFixed(6));
      onChange(newLat, newLng);
      reverseGeocode(newLat, newLng);
    });

    // Map click event
    map.on('click', (e: L.LeafletMouseEvent) => {
      const newLat = parseFloat(e.latlng.lat.toFixed(6));
      const newLng = parseFloat(e.latlng.lng.toFixed(6));
      marker.setLatLng([newLat, newLng]);
      onChange(newLat, newLng);
      reverseGeocode(newLat, newLng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position if external latitude/longitude change
  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const currentPos = markerRef.current.getLatLng();
        if (Math.abs(currentPos.lat - lat) > 0.0001 || Math.abs(currentPos.lng - lng) > 0.0001) {
          markerRef.current.setLatLng([lat, lng]);
          mapRef.current.setView([lat, lng], mapRef.current.getZoom());
        }
      }
    }
  }, [latitude, longitude]);

  // Reverse geocoding using Nominatim
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'SmartCollegeBus/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          onChange(lat, lng, data.display_name);
        }
      }
    } catch (e) {
      // Ignore geocoding network errors gracefully
    }
  };

  // Search places via Nominatim
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setShowResults(true);

    try {
      // Focus search in coastal Karnataka region by appending query context if not specific
      const query = searchQuery.trim();
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'User-Agent': 'SmartCollegeBus/1.0' } }
      );

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
      }
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (item: any) => {
    const lat = parseFloat(parseFloat(item.lat).toFixed(6));
    const lng = parseFloat(parseFloat(item.lon).toFixed(6));

    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], 16);
    }

    onChange(lat, lng, item.display_name);
    setShowResults(false);
    setSearchQuery(item.display_name.split(',')[0]);
  };

  return (
    <div className="space-y-2">
      {/* Search Input Bar */}
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Search place / landmark (e.g. Bhatkal Main Stand, Shirali, Tengingundi)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-brand-primary/70 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-accent text-brand-navy shadow-subtle"
            />
            <Search className="w-3.5 h-3.5 text-brand-gray absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isSearching || !searchQuery.trim()}
            className="px-3 py-1.5 bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 shadow-subtle shrink-0"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            <span>Find Place</span>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-brand-secondary rounded-xl shadow-elevated max-h-48 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((item, idx) => (
                <button
                  key={`${item.place_id}-${idx}`}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-brand-cream/60 flex items-start gap-2 border-b border-gray-100 last:border-b-0"
                >
                  <MapPin className="w-3.5 h-3.5 text-brand-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-brand-navy">{item.display_name.split(',')[0]}</p>
                    <p className="text-[10px] text-brand-gray truncate max-w-sm">{item.display_name}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-3 text-xs text-brand-gray text-center italic">
                {isSearching ? 'Searching locations...' : 'No exact places found. Try clicking the map directly.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Leaflet Map Canvas */}
      <div className={`relative rounded-2xl overflow-hidden border border-brand-primary/60 shadow-subtle ${className}`}>
        <div ref={containerRef} className="w-full h-full z-0" />
        <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-brand-primary/40 text-[10px] font-semibold text-brand-navy shadow-subtle flex items-center gap-1.5 pointer-events-none">
          <MapPin className="w-3 h-3 text-brand-accent" />
          <span>Click map or drag marker to set exact location</span>
        </div>
      </div>
    </div>
  );
};
