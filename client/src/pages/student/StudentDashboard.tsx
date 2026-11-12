import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  Bus as BusIcon,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Mail,
  School,
  Calendar,
  Search,
  MessageSquare,
  Send,
  History,
  TrendingUp,
  Percent,
  Check,
  ChevronRight,
  RefreshCw,
  Bell,
  Smartphone,
  Info,
  ExternalLink,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { LiveBusMap } from '../../components/map/LiveBusMap';
import { PushNotificationService } from '../../services/pushNotification';
import {
  Bus,
  Route,
  PickupPoint,
  RouteStop,
  ETAData,
  HistoricalArrivalRow,
  WeeklySummaryStats,
  Complaint,
} from '../../types';

export const StudentDashboard: React.FC = () => {
  const { studentProfile, updateStudentProfile } = useAuth();
  const mapSectionRef = useRef<HTMLDivElement>(null);

  // Core Data State
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<number>(studentProfile.preferredPickupPointId || 2);
  const [etaData, setEtaData] = useState<ETAData | null>(null);

  // Student Details Form State
  const [studentName, setStudentName] = useState<string>(studentProfile.fullName);
  const [studentId, setStudentId] = useState<string>(studentProfile.studentId);
  const [collegeName, setCollegeName] = useState<string>(studentProfile.collegeName);
  const [phone, setPhone] = useState<string>(studentProfile.phone);
  const [email, setEmail] = useState<string>(studentProfile.email);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  // Stop Search Filter
  const [stopSearch, setStopSearch] = useState<string>('');

  // 7-Day History State
  const [historyRows, setHistoryRows] = useState<HistoricalArrivalRow[]>([]);
  const [historyStats, setHistoryStats] = useState<WeeklySummaryStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Complaint Submission State
  const [complaintCategory, setComplaintCategory] = useState<string>('bus_delay');
  const [complaintDesc, setComplaintDesc] = useState<string>('');
  const [incidentDate, setIncidentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [preferredContact, setPreferredContact] = useState<string>('phone');
  const [complaintResult, setComplaintResult] = useState<string | null>(null);
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState<boolean>(false);
  const [trackingRefInput, setTrackingRefInput] = useState<string>('');
  const [trackedComplaint, setTrackedComplaint] = useState<Complaint | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Web Push Notifications State
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    return PushNotificationService.getPermissionStatus();
  });
  const [isSubscribingPush, setIsSubscribingPush] = useState<boolean>(false);
  const [pushMsg, setPushMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [notif5MinEnabled, setNotif5MinEnabled] = useState<boolean>(true);
  const [notifDelayEnabled, setNotifDelayEnabled] = useState<boolean>(true);

  const handleEnablePush = async () => {
    setIsSubscribingPush(true);
    setPushMsg(null);
    try {
      const studentIdToUse = studentId.trim() || studentProfile.studentId || 'student1';
      const result = await PushNotificationService.requestPermissionAndSubscribe(studentIdToUse);
      setPushPermission(result.permission);

      if (result.success) {
        setPushMsg({
          type: 'success',
          text: '✓ Real device notifications active! You will receive 5-minute arrival and delay alerts directly on your device even if the browser tab is closed.',
        });
      } else {
        setPushMsg({
          type: 'error',
          text: result.error || 'Permission was denied. Please allow notifications in site settings.',
        });
      }
    } catch (e: any) {
      setPushMsg({
        type: 'error',
        text: `Push error: ${e.message}`,
      });
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setPushMsg(null);
    try {
      const studentIdToUse = studentId.trim() || studentProfile.studentId || '*';
      const res = await PushNotificationService.sendTestNotification(studentIdToUse);
      if (res && res.deliveredToDevices > 0) {
        setPushMsg({
          type: 'success',
          text: `Test notification delivered to ${res.deliveredToDevices} device(s)! Check your device lockscreen or notification shade.`,
        });
      } else {
        setPushMsg({
          type: 'info',
          text: 'No active push subscriptions found on server. Please click "Enable Push Notifications" first!',
        });
      }
    } catch (e: any) {
      setPushMsg({
        type: 'error',
        text: `Failed sending test push: ${e.message}`,
      });
    }
  };

  // Dynamic Greeting based on current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // 1. Initial Data Fetch
  useEffect(() => {
    const loadData = async () => {
      try {
        const [busList, routeList, pointsList] = await Promise.all([
          api.buses.getAll(),
          api.routes.getAll(),
          api.pickupPoints.getAll(),
        ]);

        setBuses(busList);
        setRoutes(routeList);
        setPickupPoints(pointsList);

        // Set active selected bus
        const currentBus = busList.find((b) => b.id === studentProfile.selectedBusId) || busList[0] || null;
        setSelectedBus(currentBus);

        if (currentBus?.assigned_route_id) {
          const currentRoute = routeList.find((r) => r.id === currentBus.assigned_route_id) || routeList[0] || null;
          setSelectedRoute(currentRoute);
        } else if (routeList.length > 0) {
          setSelectedRoute(routeList[0]);
        }
      } catch (err: any) {
        console.error('[Student Dashboard] Failed loading initial data:', err.message);
      }
    };

    loadData();
  }, []);

  // 2. Fetch ETA whenever selectedBus or selectedStopId changes
  useEffect(() => {
    if (!selectedBus) return;

    const fetchEta = async () => {
      try {
        const data = await api.eta.getETA(selectedBus.id, selectedStopId);
        setEtaData(data);
      } catch (e: any) {
        console.warn('[Student Dashboard] ETA fetch warning:', e.message);
      }
    };

    fetchEta();
    const interval = setInterval(fetchEta, 5000);
    return () => clearInterval(interval);
  }, [selectedBus?.id, selectedStopId]);

  // 3. Fetch 7-Day History
  useEffect(() => {
    if (!selectedBus) return;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await api.history.getArrivals(selectedBus.id, selectedStopId, 7);
        setHistoryRows(res.rows);
        setHistoryStats(res.stats);
      } catch (err: any) {
        console.error('[Student Dashboard] History load error:', err.message);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedBus?.id, selectedStopId]);

  // 4. Socket.IO Live Telemetry Listener
  useEffect(() => {
    const unsubLocation = socketService.onBusLocation((data) => {
      setBuses((prev) =>
        prev.map((b) => {
          if (b.id === data.busId) {
            return {
              ...b,
              last_latitude: data.latitude,
              last_longitude: data.longitude,
              last_speed: data.speed,
              last_heading: data.heading,
              status: data.status as any,
              gps_status: data.gpsStatus as any,
              last_gps_timestamp: data.timestamp,
            };
          }
          return b;
        })
      );

      setSelectedBus((prev) => {
        if (!prev || prev.id !== data.busId) return prev;
        return {
          ...prev,
          last_latitude: data.latitude,
          last_longitude: data.longitude,
          last_speed: data.speed,
          last_heading: data.heading,
          status: data.status as any,
          gps_status: data.gpsStatus as any,
          last_gps_timestamp: data.timestamp,
        };
      });

      // Update ETA specifically for the student's selected pickup point when telemetry arrives
      if (selectedStopId) {
        api.eta.getETA(data.busId, selectedStopId)
          .then((freshEta) => {
            if (freshEta) setEtaData(freshEta);
          })
          .catch(() => {});
      }
    });

    const unsubStatus = socketService.onBusStatus((data) => {
      setBuses((prev) =>
        prev.map((b) => (b.id === data.busId ? { ...b, status: data.status as any, gps_status: data.gpsStatus as any } : b))
      );
      setSelectedBus((prev) =>
        prev && prev.id === data.busId ? { ...prev, status: data.status as any, gps_status: data.gpsStatus as any } : prev
      );
    });

    const unsubTripStarted = socketService.onTripStarted((trip) => {
      setBuses((prev) =>
        prev.map((b) => (b.id === trip.bus_id ? { ...b, status: 'running_on_time', gps_status: 'waiting_signal' } : b))
      );
      setSelectedBus((prev) =>
        prev && prev.id === trip.bus_id ? { ...prev, status: 'running_on_time', gps_status: 'waiting_signal' } : prev
      );
    });

    const unsubTripEnded = socketService.onTripEnded((trip) => {
      setBuses((prev) =>
        prev.map((b) => (b.id === trip.bus_id ? { ...b, status: 'trip_completed', gps_status: 'offline', last_speed: 0 } : b))
      );
      setSelectedBus((prev) =>
        prev && prev.id === trip.bus_id ? { ...prev, status: 'trip_completed', gps_status: 'offline', last_speed: 0 } : prev
      );
      setEtaData((prev) => (prev ? { ...prev, etaMinutes: null, roadDistanceKm: null, isGpsAvailable: false } : null));
    });

    return () => {
      unsubLocation();
      unsubStatus();
      unsubTripStarted();
      unsubTripEnded();
    };
  }, [selectedStopId]);

  // Handler: Select Bus
  const handleSelectBus = (bus: Bus) => {
    setSelectedBus(bus);
    if (bus.assigned_route_id) {
      const matchRoute = routes.find((r) => r.id === bus.assigned_route_id);
      if (matchRoute) {
        setSelectedRoute(matchRoute);
        // Default stop to first stop of route or keep current if present
        const hasStop = matchRoute.stops.some((s) => s.pickup_point_id === selectedStopId);
        if (!hasStop && matchRoute.stops.length > 0) {
          setSelectedStopId(matchRoute.stops[0].pickup_point_id);
        }
      }
    }
  };

  // Handler: Save Student Details
  const handleSaveStudentDetails = (e: React.FormEvent) => {
    e.preventDefault();
    updateStudentProfile({
      fullName: studentName,
      studentId,
      collegeName,
      phone,
      email,
      selectedBusId: selectedBus?.id || 1,
      preferredPickupPointId: selectedStopId,
    });
    setProfileSavedMsg('Preferences saved successfully! You are now subscribed to this stop.');
    setTimeout(() => setProfileSavedMsg(null), 4000);
  };

  // Handler: Submit Complaint
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintDesc.trim()) return;

    setIsSubmittingComplaint(true);
    setComplaintResult(null);

    try {
      const res = await api.complaints.submit({
        studentName: studentName || 'Mohammed Zaid',
        studentId,
        phone,
        email,
        busNumber: selectedBus?.bus_number || 'KA-47-A-1234',
        routeName: selectedRoute?.route_name || 'Murdeshwar to College',
        category: complaintCategory as any,
        description: complaintDesc,
        dateOfIncident: incidentDate,
        preferredContact,
      });

      setComplaintResult(res.message);
      setComplaintDesc('');
    } catch (err: any) {
      setComplaintResult(`Error: ${err.message}`);
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  // Handler: Track Complaint
  const handleTrackComplaint = async () => {
    if (!trackingRefInput.trim()) return;
    setTrackError(null);
    setTrackedComplaint(null);
    try {
      const cmp = await api.complaints.getByRef(trackingRefInput.trim());
      setTrackedComplaint(cmp);
    } catch (err: any) {
      setTrackError(err.message || 'Complaint not found.');
    }
  };

  const scrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectedStopObj = pickupPoints.find((p) => p.id === selectedStopId);

  return (
    <div className="space-y-8 pb-16">
      {/* SECTION A: WELCOME HERO */}
      <section className="bg-gradient-to-r from-brand-secondary/60 via-white to-brand-primary/30 rounded-3xl p-6 sm:p-8 lg:p-10 border border-brand-primary/60 shadow-subtle relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/90 border border-brand-primary rounded-full text-xs font-bold text-brand-navy mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-Time College Fleet Tracking</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-navy tracking-tight leading-tight">
            {getGreeting()}, <span className="text-brand-accent">{studentName.split(' ')[0] || 'Student'}!</span>
          </h1>

          <p className="text-sm sm:text-base text-brand-gray mt-2 leading-relaxed">
            Welcome to the Smart College Bus Tracking System. Monitor your bus in real time, view route-aware ETAs at your pickup stop, and get 5-minute automated arrival notifications.
          </p>

          {/* Quick Status Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-brand-primary/40">
            <div className="bg-white/80 p-3 rounded-xl border border-brand-secondary">
              <span className="text-[11px] font-semibold text-brand-gray uppercase block">Selected Bus</span>
              <span className="font-bold text-brand-navy text-sm truncate block mt-0.5">
                {selectedBus?.bus_number || 'KA-47-A-1234'}
              </span>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-brand-secondary">
              <span className="text-[11px] font-semibold text-brand-gray uppercase block">Your Stop</span>
              <span className="font-bold text-brand-navy text-sm truncate block mt-0.5">
                {selectedStopObj?.name || 'Selected Stop'}
              </span>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-brand-secondary">
              <span className="text-[11px] font-semibold text-brand-gray uppercase block">Live ETA</span>
              <span className="font-bold text-emerald-700 text-sm block mt-0.5">
                {etaData?.isGpsAvailable && etaData?.etaMinutes !== null && etaData?.etaMinutes !== undefined
                  ? `${etaData.etaMinutes} mins`
                  : etaData?.busDeparted
                  ? 'Departed'
                  : etaData?.isStale
                  ? 'Signal Lost'
                  : 'Waiting signal'}
              </span>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-brand-secondary">
              <span className="text-[11px] font-semibold text-brand-gray uppercase block">Bus Status</span>
              <span className="font-bold text-brand-navy text-sm capitalize block mt-0.5 truncate">
                {selectedBus?.status.replace(/_/g, ' ') || 'Running on time'}
              </span>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={scrollToMap}
              className="bg-[#263746] hover:bg-[#1a2632] text-white font-bold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm tracking-wide active:scale-95"
            >
              <Navigation className="w-4 h-4 text-brand-primary" />
              <span>TRACK MY BUS NOW</span>
            </button>

            <a
              href="#student-details"
              className="bg-white hover:bg-brand-secondary text-brand-navy font-semibold px-4 py-3.5 rounded-xl border border-brand-primary/80 transition-colors text-sm"
            >
              Update My Stop
            </a>
          </div>
        </div>

        {/* Decorative Bus Graphic watermark */}
        <div className="hidden lg:block absolute -right-6 -bottom-8 opacity-10 pointer-events-none">
          <BusIcon className="w-80 h-80 text-brand-navy" />
        </div>
      </section>

      {/* SECTION C: AVAILABLE BUSES */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-navy flex items-center gap-2">
              <BusIcon className="w-5 h-5 text-brand-accent" />
              <span>Available College Buses</span>
            </h2>
            <p className="text-xs text-brand-gray">Select an active bus to track its route and arrival time</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-brand-secondary text-brand-navy rounded-lg border border-brand-primary/50">
            {buses.length} Fleet Vehicles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buses.map((bus) => {
            const isSelected = selectedBus?.id === bus.id;
            const isOffline = bus.gps_status === 'offline' || bus.status === 'trip_completed' || bus.status === 'not_started';
            const isStale = bus.gps_status === 'stale';
            const isLive = bus.gps_status === 'active' && !isStale && !isOffline;

            return (
              <div
                key={bus.id}
                onClick={() => handleSelectBus(bus)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white relative ${
                  isSelected
                    ? 'border-brand-navy ring-2 ring-brand-primary shadow-elevated'
                    : 'border-brand-primary/40 hover:border-brand-accent hover:shadow-card'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-brand-accent tracking-wider uppercase">
                      {bus.bus_name}
                    </span>
                    <h3 className="text-lg font-extrabold text-brand-navy mt-0.5">{bus.bus_number}</h3>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      bus.status === 'delayed'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : bus.status === 'running_on_time'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-brand-secondary text-brand-navy'
                    }`}
                  >
                    {bus.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Route & Driver details */}
                <div className="mt-4 space-y-2 text-xs text-brand-navy">
                  <div className="flex items-center gap-2 text-brand-gray">
                    <MapPin className="w-4 h-4 text-brand-accent flex-shrink-0" />
                    <span className="truncate">Route: <strong>{bus.route_name || 'Murdeshwar to College'}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 text-brand-gray">
                    <User className="w-4 h-4 text-brand-accent flex-shrink-0" />
                    <span>Driver: <strong>{bus.driver_name || 'Ramesh Kumar'}</strong></span>
                    {bus.driver_phone && <span className="text-[11px] text-gray-500">({bus.driver_phone})</span>}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isLive
                            ? 'bg-emerald-500 animate-pulse'
                            : isStale
                            ? 'bg-amber-500'
                            : isOffline
                            ? 'bg-gray-400'
                            : 'bg-blue-400'
                        }`}
                      ></span>
                      <span>
                        {isLive
                          ? 'Live GPS'
                          : isStale
                          ? 'Signal Lost'
                          : isOffline
                          ? 'Offline'
                          : 'Waiting GPS'}
                      </span>
                    </span>

                    <span className="font-bold text-brand-navy">
                      {isSelected ? '✓ Selected Bus' : 'Click to Track'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION D: REAL-TIME GPS TRACKING & LIVE MAP */}
      <section ref={mapSectionRef} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-brand-navy flex items-center gap-2">
              <Navigation className="w-5 h-5 text-brand-accent" />
              <span>Real-Time GPS Tracking Map</span>
            </h2>
            <p className="text-xs text-brand-gray">
              Tracking <strong>{selectedBus?.bus_name || 'College Bus 01'}</strong> along route <strong>{selectedRoute?.route_name || 'Murdeshwar to College'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-white border border-brand-primary px-3 py-1 rounded-lg font-semibold text-brand-navy">
              Pickup Point: <strong>{selectedStopObj?.name || 'Selected Stop'}</strong>
            </span>
          </div>
        </div>

        {/* Live Leaflet Map Container */}
        <LiveBusMap
          bus={selectedBus}
          route={selectedRoute}
          selectedStopId={selectedStopId}
          etaMinutes={etaData?.etaMinutes}
          distanceKm={etaData?.roadDistanceKm}
          onSelectStop={(stop) => setSelectedStopId(stop.pickup_point_id)}
          className="h-[520px] sm:h-[580px]"
        />
      </section>

      {/* SECTION E: PICKUP POINT SELECTION */}
      <section className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-accent" />
              <span>Select Your Pickup Point</span>
            </h2>
            <p className="text-xs text-brand-gray">Choose your bus stop to receive accurate arrival countdowns & alerts</p>
          </div>

          {/* Stop Search Input */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-brand-gray" />
            <input
              type="text"
              placeholder="Search pickup point..."
              value={stopSearch}
              onChange={(e) => setStopSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-brand-primary rounded-xl bg-brand-cream/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent text-brand-navy font-medium"
            />
          </div>
        </div>

        {/* Stop Cards List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {selectedRoute?.stops
            .filter((stop) => stop.stop_name.toLowerCase().includes(stopSearch.toLowerCase()))
            .map((stop) => {
              const isSelected = selectedStopId === stop.pickup_point_id;
              return (
                <div
                  key={stop.id}
                  onClick={() => setSelectedStopId(stop.pickup_point_id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand-secondary/60 border-brand-navy ring-1 ring-brand-navy font-semibold shadow-sm'
                      : 'bg-white border-brand-secondary hover:border-brand-primary hover:bg-brand-cream/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-brand-primary text-brand-navy font-bold flex items-center justify-center text-[11px]">
                      {stop.stop_sequence}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-brand-navy mt-2 text-sm truncate">{stop.stop_name}</h4>
                  <p className="text-[11px] text-brand-gray mt-0.5">Scheduled: {stop.scheduled_arrival_time}</p>
                  {stop.landmark && <p className="text-[10px] text-brand-accent mt-1 truncate">📍 {stop.landmark}</p>}
                </div>
              );
            })}
        </div>
      </section>

      {/* SECTION B: STUDENT DETAILS FORM */}
      <section id="student-details" className="bg-white rounded-3xl p-6 sm:p-8 border border-brand-primary/50 shadow-card">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold text-brand-navy flex items-center gap-2">
            <User className="w-5 h-5 text-brand-accent" />
            <span>Student Transportation Profile</span>
          </h2>
          <p className="text-xs text-brand-gray mt-1">
            Save your details and preferred bus stop. Only essential information needed for transportation alerts is stored.
          </p>

          {profileSavedMsg && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{profileSavedMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveStudentDetails} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Student ID (Optional)</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">College Name</label>
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>

            <button
              type="submit"
              className="mt-2 bg-brand-accent hover:bg-[#5b95c3] text-white font-bold px-6 py-2.5 rounded-xl shadow-sm text-sm transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save Details & Preferences</span>
            </button>
          </form>
        </div>
      </section>

      {/* SECTION: REAL DEVICE PUSH NOTIFICATIONS */}
      <section className="bg-gradient-to-r from-brand-secondary/40 via-white to-brand-primary/20 rounded-3xl p-6 sm:p-8 border border-brand-primary/60 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-brand-navy rounded-2xl text-white shadow-subtle shrink-0">
              <Bell className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-brand-navy">
                  Real Device Push Notifications
                </h2>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    pushPermission === 'granted'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : pushPermission === 'denied'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pushPermission === 'granted'
                        ? 'bg-emerald-600 animate-pulse'
                        : pushPermission === 'denied'
                        ? 'bg-red-600'
                        : 'bg-amber-600'
                    }`}
                  />
                  <span>
                    {pushPermission === 'granted'
                      ? 'Active on Device'
                      : pushPermission === 'denied'
                      ? 'Permission Denied'
                      : 'Not Enabled'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-brand-gray mt-1 leading-relaxed max-w-2xl">
                Receive instant notifications on your phone, tablet, or laptop when your bus is approximately 5 minutes away from <strong>{selectedStopObj?.name || 'your stop'}</strong> and when there are highway traffic delays — delivered even when this website is closed.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            {pushPermission !== 'granted' && (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isSubscribingPush}
                className="px-4 py-2.5 bg-brand-navy hover:bg-[#1a2632] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                <Bell className="w-4 h-4 text-brand-primary" />
                <span>{isSubscribingPush ? 'Registering...' : 'Enable Notifications'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendTestPush}
              className="px-3.5 py-2.5 bg-brand-secondary hover:bg-brand-primary text-brand-navy rounded-xl text-xs font-bold border border-brand-primary/60 transition-colors flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4 text-brand-accent" />
              <span>Test Push</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIosGuide(!showIosGuide)}
              className="px-3 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy flex items-center gap-1 rounded-xl hover:bg-white/60 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-brand-accent" />
              <span>iPhone Guide</span>
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {pushMsg && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
              pushMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : pushMsg.type === 'error'
                ? 'bg-red-50 text-red-900 border-red-300'
                : 'bg-blue-50 text-blue-900 border-blue-300'
            }`}
          >
            {pushMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : pushMsg.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{pushMsg.text}</span>
          </div>
        )}

        {/* iOS PWA Instructions Collapsible */}
        {showIosGuide && (
          <div className="p-4 bg-white/90 border border-brand-primary/60 rounded-2xl text-xs text-brand-navy space-y-2 animate-scaleUp">
            <h4 className="font-bold flex items-center gap-1.5 text-brand-accent">
              <Smartphone className="w-4 h-4" />
              <span>How to Enable Push Notifications on iPhone / iPad (iOS 16.4+)</span>
            </h4>
            <ol className="list-decimal pl-5 space-y-1 text-brand-gray">
              <li>Open this website in <strong>Safari</strong> on your iPhone or iPad.</li>
              <li>Tap the <strong>Share</strong> button (the square with an arrow pointing up) at the bottom.</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
              <li>Open the newly installed <strong>Smart Bus</strong> app from your Home Screen.</li>
              <li>Tap <strong>"Enable Notifications"</strong> and tap <strong>"Allow"</strong> when prompted.</li>
            </ol>
            <p className="text-[10px] text-brand-gray italic">
              Note: Apple iOS delivers web push notifications exclusively through Home Screen Web Apps.
            </p>
          </div>
        )}

        {/* Notification preferences checkboxes */}
        <div className="pt-3 border-t border-brand-primary/30 flex flex-wrap items-center gap-6 text-xs text-brand-navy">
          <label className="flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={notif5MinEnabled}
              onChange={(e) => setNotif5MinEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-brand-accent focus:ring-brand-primary border-brand-primary/60"
            />
            <span>5-Minute Proximity Arrival Alert</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={notifDelayEnabled}
              onChange={(e) => setNotifDelayEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-brand-accent focus:ring-brand-primary border-brand-primary/60"
            />
            <span>Traffic Delay Variance Alert</span>
          </label>

          <span className="text-[11px] text-brand-gray ml-auto">
            Configured for: <strong>{selectedStopObj?.name || 'Selected Pickup Point'}</strong>
          </span>
        </div>
      </section>

      {/* SECTION F: 7-DAY HISTORICAL TIMINGS & ANALYSIS */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-brand-primary/50 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand-navy flex items-center gap-2">
              <History className="w-5 h-5 text-brand-accent" />
              <span>7-Day Trip History & Arrival Analysis</span>
            </h2>
            <p className="text-xs text-brand-gray mt-0.5">
              Previous 7-day arrival timings for stop: <strong>{selectedStopObj?.name || 'Selected Stop'}</strong>
            </p>
          </div>

          <span className="text-xs font-semibold text-brand-navy bg-brand-secondary/60 px-3 py-1 rounded-lg">
            Actual vs Scheduled Arrival
          </span>
        </div>

        {/* Weekly Summary Metric Cards */}
        {historyStats && historyStats.hasSufficientData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-primary/40">
              <div className="flex items-center gap-1.5 text-brand-gray text-xs font-medium">
                <Clock className="w-3.5 h-3.5 text-brand-navy" />
                <span>Average Arrival</span>
              </div>
              <div className="text-lg font-bold text-brand-navy mt-1">
                {historyStats.averageArrivalTime}
              </div>
              <span className="text-[10px] text-brand-gray">Over recorded operating days</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-primary/40">
              <div className="flex items-center gap-1.5 text-brand-gray text-xs font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span>Average Delay</span>
              </div>
              <div className="text-lg font-bold text-brand-navy mt-1">
                {historyStats.averageDelayMinutes} mins
              </div>
              <span className="text-[10px] text-brand-gray">Average departure variance</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-primary/40">
              <div className="flex items-center gap-1.5 text-brand-gray text-xs font-medium">
                <Percent className="w-3.5 h-3.5 text-emerald-600" />
                <span>On-Time Arrival</span>
              </div>
              <div className="text-lg font-bold text-emerald-700 mt-1">
                {historyStats.onTimePercentage}%
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">High punctuality rate</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-primary/40">
              <div className="flex items-center gap-1.5 text-brand-gray text-xs font-medium">
                <Calendar className="w-3.5 h-3.5 text-brand-navy" />
                <span>Earliest / Latest</span>
              </div>
              <div className="text-sm font-bold text-brand-navy mt-1">
                {historyStats.earliestArrival} / {historyStats.latestArrival}
              </div>
              <span className="text-[10px] text-brand-gray">{historyStats.totalTripsRecorded} verified records</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-brand-cream/60 text-xs text-brand-gray italic border border-brand-primary/40">
            {historyStats?.message || 'Not enough historical data is available to calculate an average.'}
          </div>
        )}

        {/* 7-Day Table */}
        <div className="overflow-x-auto rounded-xl border border-brand-secondary">
          <table className="w-full text-left text-xs text-brand-navy">
            <thead className="bg-brand-secondary/60 text-brand-navy font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Day of Week</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Scheduled Arrival</th>
                <th className="p-3.5">Actual Arrival</th>
                <th className="p-3.5">Delay / Punctuality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-brand-cream/30 transition-colors">
                  <td className="p-3.5 font-bold">{row.dayOfWeek}</td>
                  <td className="p-3.5 text-brand-gray">{row.date}</td>
                  <td className="p-3.5 font-mono">{row.scheduledArrival}</td>
                  <td className="p-3.5 font-mono font-semibold">
                    {row.actualArrival === 'No recorded arrival' ? (
                      <span className="text-amber-700 italic">No recorded arrival</span>
                    ) : (
                      row.actualArrival
                    )}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        row.statusText === 'On time' || row.statusText === 'Early'
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.statusText === 'Delayed'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {row.delayText}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION G: FEEDBACK AND COMPLAINT SYSTEM */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-brand-primary/50 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand-navy flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-accent" />
              <span>Transportation Feedback & Complaints</span>
            </h2>
            <p className="text-xs text-brand-gray mt-0.5">
              Report bus delays, driver issues, or tracking discrepancies directly to the fleet administration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
          {/* Complaint Form */}
          <form onSubmit={handleSubmitComplaint} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Complaint Category</label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent text-brand-navy font-semibold"
                >
                  <option value="bus_delay">Bus Delay</option>
                  <option value="driver_related">Driver-related Issue</option>
                  <option value="missed_pickup">Missed Pickup Stop</option>
                  <option value="incorrect_eta">Incorrect Arrival Time (ETA)</option>
                  <option value="gps_issue">GPS Tracking Problem</option>
                  <option value="route_problem">Route Problem</option>
                  <option value="vehicle_condition">Vehicle Condition</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Date of Incident</label>
                <input
                  type="date"
                  required
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent text-brand-navy font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy uppercase mb-1">Detailed Description</label>
              <textarea
                rows={4}
                required
                placeholder="Please describe what happened, time of incident, and any other relevant details..."
                value={complaintDesc}
                onChange={(e) => setComplaintDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-brand-secondary rounded-xl bg-brand-cream/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>

            {complaintResult && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  complaintResult.includes('Error')
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {complaintResult}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingComplaint}
              className="bg-brand-accent hover:bg-[#5b95c3] text-white font-bold px-6 py-2.5 rounded-xl shadow-sm text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmittingComplaint ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Submit Complaint</span>
            </button>
          </form>

          {/* Track Complaint Progress */}
          <div className="bg-brand-cream/50 rounded-2xl p-5 border border-brand-primary/40 space-y-4">
            <h3 className="font-bold text-brand-navy text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-accent" />
              <span>Track Complaint Status</span>
            </h3>
            <p className="text-xs text-brand-gray">
              Enter your complaint Reference ID (e.g. <code>CMP-1001</code>) to check review progress and resolution notes.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Reference ID..."
                value={trackingRefInput}
                onChange={(e) => setTrackingRefInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-brand-primary rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent uppercase font-bold"
              />
              <button
                type="button"
                onClick={handleTrackComplaint}
                className="bg-brand-navy text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1a2632] transition-colors"
              >
                Track
              </button>
            </div>

            {trackError && <p className="text-xs text-red-600 font-semibold">{trackError}</p>}

            {trackedComplaint && (
              <div className="bg-white rounded-xl p-4 border border-brand-secondary space-y-2 text-xs animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-accent">{trackedComplaint.reference_no}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      trackedComplaint.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : trackedComplaint.status === 'Under Review'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {trackedComplaint.status}
                  </span>
                </div>

                <p className="text-brand-gray text-[11px]">Category: <strong className="text-brand-navy capitalize">{trackedComplaint.category.replace('_', ' ')}</strong></p>
                <p className="text-brand-navy text-[11px] leading-relaxed italic">"{trackedComplaint.description}"</p>

                {trackedComplaint.resolution_notes && (
                  <div className="mt-2 pt-2 border-t border-gray-100 bg-emerald-50/50 p-2 rounded-lg">
                    <span className="font-bold text-emerald-800 block text-[11px]">Administrator Response:</span>
                    <p className="text-emerald-900 text-[11px] mt-0.5">{trackedComplaint.resolution_notes}</p>
                    {trackedComplaint.resolved_by && (
                      <span className="text-[10px] text-emerald-700 block mt-1">— {trackedComplaint.resolved_by}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
