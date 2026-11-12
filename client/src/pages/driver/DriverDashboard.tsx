import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Play,
  Square,
  AlertTriangle,
  Compass,
  Gauge,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Radio,
  Send,
  Bus as BusIcon,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Bus, Route } from '../../types';

export const DriverDashboard: React.FC = () => {
  const { user } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<number>(user?.assignedBusId || 1);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(1);

  // Trip state
  const [isTripActive, setIsTripActive] = useState<boolean>(false);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);

  // GPS Telemetry State
  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'active' | 'denied' | 'error'>('idle');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentAccuracy, setCurrentAccuracy] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Demo Simulation Mode (Clearly Labeled)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const demoIntervalRef = useRef<any>(null);
  const demoStepRef = useRef<number>(0);

  // Geolocation Watch ID
  const watchIdRef = useRef<number | null>(null);

  // Delay Modal State
  const [showDelayModal, setShowDelayModal] = useState<boolean>(false);
  const [delayMinutes, setDelayMinutes] = useState<number>(10);
  const [delayReason, setDelayReason] = useState<string>('Heavy traffic along NH 66 highway');
  const [delaySuccessMsg, setDelaySuccessMsg] = useState<string | null>(null);

  // Offline queue & Heartbeat state
  const offlineQueueRef = useRef<Array<{
    busId: number;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    timestamp: string;
  }>>([]);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const heartbeatTimerRef = useRef<any>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number; speed: number; heading: number; accuracy: number } | null>(null);

  // Drain offline queue helper
  const drainOfflineQueue = async () => {
    if (!navigator.onLine || offlineQueueRef.current.length === 0) return;
    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    setQueuedCount(0);

    for (const item of queue) {
      try {
        await api.tracking.sendLocation({
          busId: item.busId,
          latitude: item.latitude,
          longitude: item.longitude,
          speed: item.speed,
          heading: item.heading,
          accuracy: item.accuracy,
          timestamp: item.timestamp,
          isDemo: false,
        });
      } catch (e) {
        offlineQueueRef.current.push(item);
        setQueuedCount(offlineQueueRef.current.length);
        break;
      }
    }
  };

  // Reconnection listener
  useEffect(() => {
    const handleOnline = () => {
      drainOfflineQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Transmit location helper (with automatic offline queuing)
  const transmitLocation = async (payload: {
    busId: number;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
  }) => {
    const timestamp = new Date().toISOString();
    const packet = { ...payload, timestamp };

    if (!navigator.onLine) {
      offlineQueueRef.current.push(packet);
      if (offlineQueueRef.current.length > 50) offlineQueueRef.current.shift();
      setQueuedCount(offlineQueueRef.current.length);
      return;
    }

    try {
      await api.tracking.sendLocation({
        busId: packet.busId,
        latitude: packet.latitude,
        longitude: packet.longitude,
        speed: packet.speed,
        heading: packet.heading,
        accuracy: packet.accuracy,
        timestamp: packet.timestamp,
        isDemo: false,
      });

      if (offlineQueueRef.current.length > 0) {
        drainOfflineQueue();
      }
    } catch (err: any) {
      console.warn('[Driver GPS Transmit Warning]:', err.message);
      offlineQueueRef.current.push(packet);
      if (offlineQueueRef.current.length > 50) offlineQueueRef.current.shift();
      setQueuedCount(offlineQueueRef.current.length);
    }
  };

  // Load buses & routes
  useEffect(() => {
    const loadInit = async () => {
      try {
        const [busList, routeList] = await Promise.all([
          api.buses.getAll(),
          api.routes.getAll(),
        ]);
        setBuses(busList);
        setRoutes(routeList);

        // If logged in as driver, prioritize assigned vehicle
        if (user?.assignedBusId) {
          setSelectedBusId(user.assignedBusId);
          const assignedBus = busList.find((b) => b.id === user.assignedBusId);
          if (assignedBus?.assigned_route_id) {
            setSelectedRouteId(assignedBus.assigned_route_id);
          }
        } else if (busList.length > 0) {
          setSelectedBusId(busList[0].id);
        }

        if (routeList.length > 0 && !user?.assignedBusId) {
          setSelectedRouteId(routeList[0].id);
        }
      } catch (e: any) {
        console.error('[Driver] Failed loading bus/route info:', e.message);
      }
    };
    loadInit();
  }, [user?.assignedBusId]);

  // Check active trip on bus change
  useEffect(() => {
    const checkActive = async () => {
      try {
        const res = await api.tracking.getBusTracking(selectedBusId);
        if (res.activeTrip && res.activeTrip.status === 'in_progress') {
          setIsTripActive(true);
          setActiveTripId(res.activeTrip.id);
          if (!watchIdRef.current && !demoIntervalRef.current) {
            startGpsTracking();
          }
        } else {
          setIsTripActive(false);
          setActiveTripId(null);
        }
      } catch (e) {
        // No active trip
      }
    };
    checkActive();
  }, [selectedBusId]);

  // Handle Trip Start
  const handleStartTrip = async () => {
    try {
      const res = await api.tracking.start({
        busId: selectedBusId,
        driverId: user?.driverId || 1,
        routeId: selectedRouteId,
        isDemo: isDemoMode,
      });
      setIsTripActive(true);
      setActiveTripId(res.trip?.id || 1);
      startGpsTracking();
    } catch (e: any) {
      alert(`Error starting trip: ${e.message}`);
    }
  };

  // Handle Trip End
  const handleEndTrip = async () => {
    if (!activeTripId) return;
    try {
      await api.tracking.stop({ tripId: activeTripId, busId: selectedBusId });
      setIsTripActive(false);
      setActiveTripId(null);
      stopGpsTracking();
      alert('Trip completed successfully. Bus status updated.');
    } catch (e: any) {
      alert(`Error ending trip: ${e.message}`);
    }
  };

  // Start Real Browser Geolocation Watch
  const startGpsTracking = () => {
    if (isDemoMode) {
      startDemoSimulation();
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('error');
      setGpsErrorMsg('Geolocation is not supported by your browser or device.');
      return;
    }

    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setGpsErrorMsg(
        'Browser requires HTTPS or localhost for Geolocation GPS access. On mobile Chrome, please add this URL to chrome://flags/#unsafely-treat-insecure-origin-as-secure.'
      );
    }

    setGpsStatus('acquiring');
    setGpsErrorMsg(null);
    setIsGpsTracking(true);

    const onPosSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // Real speed: only report positive speed if device provides it, otherwise 0 km/h (no fake 35km/h)
      const speedKmh = pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed > 0
        ? Math.round(pos.coords.speed * 3.6)
        : 0;
      const heading = Math.round(pos.coords.heading || 0);
      const accuracy = Math.round(pos.coords.accuracy || 5);

      setCurrentCoords({ lat, lng });
      setCurrentSpeed(speedKmh);
      setCurrentHeading(heading);
      setCurrentAccuracy(accuracy);
      setLastUpdateTime(new Date().toLocaleTimeString());
      setGpsStatus('active');
      setGpsErrorMsg(null);

      latestCoordsRef.current = { lat, lng, speed: speedKmh, heading, accuracy };

      transmitLocation({
        busId: selectedBusId,
        latitude: lat,
        longitude: lng,
        speed: speedKmh,
        heading,
        accuracy,
      });
    };

    const onPosError = (err: GeolocationPositionError) => {
      console.error('[Driver Geolocation Error]', err);
      if (err.code === err.PERMISSION_DENIED) {
        setGpsStatus('denied');
        setGpsErrorMsg('Location permission was denied. Please allow location access in your browser address bar/settings.');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setGpsStatus('error');
        setGpsErrorMsg('GPS location unavailable. Please verify device GPS / Location switch is enabled.');
      } else {
        setGpsStatus('error');
        setGpsErrorMsg(`Acquiring satellite lock... (${err.message})`);
      }
    };

    // Immediate fix
    navigator.geolocation.getCurrentPosition(onPosSuccess, onPosError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    // Continuous watch
    const watchId = navigator.geolocation.watchPosition(onPosSuccess, onPosError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000,
    });
    watchIdRef.current = watchId;

    // Heartbeat transmission timer (every 3.5s) to guarantee continuous stream to students even when bus is stationary
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setInterval(() => {
      if (latestCoordsRef.current) {
        transmitLocation({
          busId: selectedBusId,
          latitude: latestCoordsRef.current.lat,
          longitude: latestCoordsRef.current.lng,
          speed: latestCoordsRef.current.speed,
          heading: latestCoordsRef.current.heading,
          accuracy: latestCoordsRef.current.accuracy,
        });
        setLastUpdateTime(new Date().toLocaleTimeString());
      }
    }, 3500);
  };

  // Stop Real GPS
  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setIsGpsTracking(false);
    setGpsStatus('idle');
  };

  // Demo Simulation Mode along NH 66 coordinates (Murdeshwar to College)
  const startDemoSimulation = () => {
    setIsGpsTracking(true);
    setGpsStatus('active');

    // Waypoints along Route 1 (Murdeshwar -> Shirali -> Bhatkal -> College)
    const waypoints = [
      { lat: 14.0940, lng: 74.4899, name: 'Murdeshwar Bus Stand' },
      { lat: 14.0750, lng: 74.5020, name: 'NH 66 Highway' },
      { lat: 14.0550, lng: 74.5150, name: 'Approaching Shirali' },
      { lat: 14.0321, lng: 74.5262, name: 'Shirali Bus Stop' },
      { lat: 14.0150, lng: 74.5380, name: 'Heading South' },
      { lat: 13.9875, lng: 74.5510, name: 'Bhatkal Bus Stand' },
      { lat: 13.9820, lng: 74.5620, name: 'College Road Turn' },
      { lat: 13.9782, lng: 74.5750, name: 'College Main Gate' },
    ];

    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);

    demoIntervalRef.current = setInterval(() => {
      const point = waypoints[demoStepRef.current % waypoints.length];
      demoStepRef.current++;

      setCurrentCoords({ lat: point.lat, lng: point.lng });
      setCurrentSpeed(42);
      setCurrentHeading(165);
      setCurrentAccuracy(3);
      setLastUpdateTime(new Date().toLocaleTimeString());

      api.tracking.sendLocation({
        busId: selectedBusId,
        latitude: point.lat,
        longitude: point.lng,
        speed: 42,
        heading: 165,
        accuracy: 3,
        isDemo: true,
      }).catch((e) => console.warn('[Demo GPS Send Error]:', e.message));
    }, 4000);
  };

  // Handle Delay Report
  const handleReportDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTripId) {
      alert('Start a trip first to report a delay.');
      return;
    }

    try {
      await api.trips.reportDelay(activeTripId, delayMinutes, delayReason);
      setDelaySuccessMsg(`Delay of ${delayMinutes} minutes broadcasted to connected students!`);
      setTimeout(() => {
        setDelaySuccessMsg(null);
        setShowDelayModal(false);
      }, 2500);
    } catch (e: any) {
      alert(`Error reporting delay: ${e.message}`);
    }
  };

  const selectedBus = buses.find((b) => b.id === selectedBusId);
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Driver Header */}
      <div className="bg-white rounded-3xl p-6 border border-brand-primary shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#263746] text-white flex items-center justify-center font-bold text-xl shadow-md">
              <BusIcon className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-brand-accent tracking-wider uppercase">Driver GPS Portal</span>
              <h1 className="text-xl font-extrabold text-brand-navy">Bus Telemetry Dashboard</h1>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isTripActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isTripActive ? 'Trip Active' : 'Trip Idle'}
            </span>
          </div>
        </div>

        {/* Bus & Route Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-brand-secondary">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-brand-navy uppercase">Vehicle</label>
              {user?.role === 'driver' && user.assignedBusId && (
                <span className="text-[10px] bg-brand-secondary text-brand-navy px-1.5 py-0.5 rounded font-bold border border-brand-primary/50">
                  Assigned
                </span>
              )}
            </div>
            <select
              value={selectedBusId}
              disabled={isTripActive || user?.role === 'driver'}
              onChange={(e) => setSelectedBusId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs border border-brand-primary rounded-xl bg-brand-cream/40 font-bold text-brand-navy disabled:opacity-85 disabled:cursor-not-allowed"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bus_number} — {b.bus_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Assigned Route</label>
            <select
              value={selectedRouteId}
              disabled={isTripActive}
              onChange={(e) => setSelectedRouteId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs border border-brand-primary rounded-xl bg-brand-cream/40 font-bold text-brand-navy"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.route_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary Trip Control Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {!isTripActive ? (
          <button
            onClick={handleStartTrip}
            className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-base tracking-wide transition-all active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START TRIP & ACTIVATE GPS</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowDelayModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Report Delay</span>
            </button>

            <button
              onClick={handleEndTrip}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition-all"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>End Trip</span>
            </button>
          </>
        )}
      </div>

      {/* GPS Status & Telemetry Card */}
      <div className="bg-white rounded-3xl p-6 border border-brand-primary shadow-card space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand-accent animate-pulse" />
            <h3 className="font-bold text-brand-navy text-sm">Real-Time GPS Transmitter</h3>
          </div>

          <div className="flex items-center gap-2">
            {queuedCount > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                Offline Queue: {queuedCount}
              </span>
            )}
            {/* Connection status pill */}
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                gpsStatus === 'active'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : gpsStatus === 'acquiring'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : gpsStatus === 'denied'
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {gpsStatus === 'active'
                ? 'GPS Broadcasting'
                : gpsStatus === 'acquiring'
                ? 'Acquiring GPS...'
                : gpsStatus === 'denied'
                ? 'Permission Denied'
                : 'GPS Inactive'}
            </span>
          </div>
        </div>

        {gpsErrorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{gpsErrorMsg}</span>
          </div>
        )}

        {/* Live Gauges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-secondary text-center">
            <Gauge className="w-4 h-4 text-brand-accent mx-auto mb-1" />
            <span className="text-[10px] uppercase font-bold text-brand-gray">Speed</span>
            <div className="text-xl font-extrabold text-brand-navy mt-0.5">{currentSpeed} <span className="text-xs font-normal">km/h</span></div>
          </div>

          <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-secondary text-center">
            <Compass className="w-4 h-4 text-brand-accent mx-auto mb-1" />
            <span className="text-[10px] uppercase font-bold text-brand-gray">Heading</span>
            <div className="text-xl font-extrabold text-brand-navy mt-0.5">{currentHeading}°</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-secondary text-center">
            <MapPin className="w-4 h-4 text-brand-accent mx-auto mb-1" />
            <span className="text-[10px] uppercase font-bold text-brand-gray">Accuracy</span>
            <div className="text-xl font-extrabold text-brand-navy mt-0.5">{currentAccuracy} <span className="text-xs font-normal">m</span></div>
          </div>

          <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-secondary text-center">
            <Radio className="w-4 h-4 text-brand-accent mx-auto mb-1" />
            <span className="text-[10px] uppercase font-bold text-brand-gray">Last Sent</span>
            <div className="text-sm font-bold text-brand-navy mt-1 truncate">{lastUpdateTime || 'N/A'}</div>
          </div>
        </div>

        {/* Live Coordinates Readout */}
        <div className="p-3 bg-brand-cream/30 rounded-xl border border-brand-secondary text-xs text-brand-navy flex items-center justify-between">
          <span className="text-brand-gray font-medium">Transmitted Coordinates:</span>
          <span className="font-mono font-bold">
            {currentCoords
              ? `${currentCoords.lat.toFixed(6)}°, ${currentCoords.lng.toFixed(6)}°`
              : 'Waiting for device signal'}
          </span>
        </div>

        {/* Demo GPS Simulation Toggle (Clearly Labeled) */}
        <div className="p-4 bg-brand-secondary/30 rounded-2xl border border-brand-primary/50 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-brand-navy">Demo GPS Simulation Mode</span>
              <p className="text-[11px] text-brand-gray">Clearly labeled testing mode when stationary or inside classroom.</p>
            </div>
            <input
              type="checkbox"
              id="demo-toggle"
              checked={isDemoMode}
              onChange={(e) => {
                setIsDemoMode(e.target.checked);
                if (isGpsTracking) {
                  stopGpsTracking();
                }
              }}
              className="w-5 h-5 rounded text-brand-accent focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Delay Reporting Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-secondary animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-brand-navy text-lg mb-1 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Report Trip Delay</span>
            </h3>
            <p className="text-xs text-brand-gray mb-4">
              Broadcasting a delay will notify subscribed students and update live arrival ETAs immediately.
            </p>

            <form onSubmit={handleReportDelay} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">
                  Estimated Delay: {delayMinutes} minutes
                </label>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-accent cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-brand-gray">
                  <span>5 mins</span>
                  <span>30 mins</span>
                  <span>60 mins</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Reason for Delay</label>
                <select
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-brand-secondary rounded-xl bg-brand-cream/30 text-brand-navy font-semibold"
                >
                  <option value="Heavy traffic along NH 66 highway">Heavy traffic along NH 66 highway</option>
                  <option value="Mechanical issue / tire replacement">Mechanical issue / tire replacement</option>
                  <option value="Heavy rain / reduced visibility">Heavy rain / reduced visibility</option>
                  <option value="Road construction / diversion">Road construction / diversion</option>
                  <option value="Temporary railway crossing closure">Temporary railway crossing closure</option>
                  <option value="Other reason">Other reason</option>
                </select>
              </div>

              {delaySuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                  {delaySuccessMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDelayModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-brand-navy font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Broadcast Delay Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
