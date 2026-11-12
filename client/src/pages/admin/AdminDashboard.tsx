import React, { useState, useEffect } from 'react';
import {
  Shield,
  Bus as BusIcon,
  Users,
  Route as RouteIcon,
  MapPin,
  AlertTriangle,
  MessageSquare,
  Radio,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  Trash2,
  Play,
  Square,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Send,
  Eye,
  Check,
  ArrowUp,
  ArrowDown,
  X,
  Navigation,
  Calendar,
  AlertCircle,
  HelpCircle,
  Filter,
  Database,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { LiveBusMap } from '../../components/map/LiveBusMap';
import { MapLocationPicker } from '../../components/map/MapLocationPicker';
import {
  Bus,
  Driver,
  Route,
  RouteStop,
  PickupPoint,
  Trip,
  Complaint,
  StudentUser,
} from '../../types';

export const AdminDashboard: React.FC = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  // Active Management Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'buses' | 'drivers' | 'stops' | 'routes' | 'trips' | 'gps' | 'students' | 'complaints' | 'broadcast' | 'history'
  >('overview');

  // Core Data
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Search filters for tables
  const [busSearch, setBusSearch] = useState<string>('');
  const [driverSearch, setDriverSearch] = useState<string>('');
  const [stopSearch, setStopSearch] = useState<string>('');
  const [routeSearch, setRouteSearch] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Toast Feedback State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Reusable Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // ================= BUS MANAGEMENT MODALS =================
  const [showAddBusModal, setShowAddBusModal] = useState<boolean>(false);
  const [newBusNumber, setNewBusNumber] = useState<string>('');
  const [newBusName, setNewBusName] = useState<string>('');
  const [newBusRegNumber, setNewBusRegNumber] = useState<string>('');
  const [newBusCapacity, setNewBusCapacity] = useState<number>(50);
  const [newBusDriverId, setNewBusDriverId] = useState<number | ''>('');
  const [newBusRouteId, setNewBusRouteId] = useState<number | ''>('');

  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [editBusNumber, setEditBusNumber] = useState<string>('');
  const [editBusName, setEditBusName] = useState<string>('');
  const [editBusRegNumber, setEditBusRegNumber] = useState<string>('');
  const [editBusCapacity, setEditBusCapacity] = useState<number>(50);
  const [editBusDriverId, setEditBusDriverId] = useState<number | ''>('');
  const [editBusRouteId, setEditBusRouteId] = useState<number | ''>('');
  const [editBusStatus, setEditBusStatus] = useState<Bus['status']>('not_started');
  const [editBusIsActive, setEditBusIsActive] = useState<number>(1);

  // ================= DRIVER MANAGEMENT MODALS =================
  const [showAddDriverModal, setShowAddDriverModal] = useState<boolean>(false);
  const [newDriverName, setNewDriverName] = useState<string>('');
  const [newDriverPhone, setNewDriverPhone] = useState<string>('');
  const [newDriverEmpId, setNewDriverEmpId] = useState<string>('');
  const [newDriverLicense, setNewDriverLicense] = useState<string>('');
  const [newDriverAssignedBusId, setNewDriverAssignedBusId] = useState<number | ''>('');

  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editDriverName, setEditDriverName] = useState<string>('');
  const [editDriverPhone, setEditDriverPhone] = useState<string>('');
  const [editDriverEmpId, setEditDriverEmpId] = useState<string>('');
  const [editDriverLicense, setEditDriverLicense] = useState<string>('');
  const [editDriverStatus, setEditDriverStatus] = useState<Driver['status']>('active');
  const [editDriverAssignedBusId, setEditDriverAssignedBusId] = useState<number | ''>('');

  // ================= PICKUP POINT MANAGEMENT MODALS =================
  const [showAddStopModal, setShowAddStopModal] = useState<boolean>(false);
  const [newStopName, setNewStopName] = useState<string>('');
  const [newStopLat, setNewStopLat] = useState<string>('14.05');
  const [newStopLng, setNewStopLng] = useState<string>('74.52');
  const [newStopLandmark, setNewStopLandmark] = useState<string>('');
  const [newStopAddress, setNewStopAddress] = useState<string>('');

  const [editingStop, setEditingStop] = useState<PickupPoint | null>(null);
  const [editStopName, setEditStopName] = useState<string>('');
  const [editStopLat, setEditStopLat] = useState<string>('');
  const [editStopLng, setEditStopLng] = useState<string>('');
  const [editStopLandmark, setEditStopLandmark] = useState<string>('');
  const [editStopAddress, setEditStopAddress] = useState<string>('');

  // ================= ROUTE BUILDER & MANAGEMENT =================
  interface BuilderStopItem {
    pickup_point_id: number;
    stop_name: string;
    landmark: string;
    latitude: number;
    longitude: number;
    scheduled_arrival_time: string;
    scheduled_departure_time: string;
    distance_from_prev_km: number;
  }

  const [showRouteBuilder, setShowRouteBuilder] = useState<boolean>(false);
  const [builderRouteId, setBuilderRouteId] = useState<number | null>(null);
  const [builderRouteName, setBuilderRouteName] = useState<string>('');
  const [builderStartPoint, setBuilderStartPoint] = useState<string>('');
  const [builderDestination, setBuilderDestination] = useState<string>('');
  const [builderOperatingDays, setBuilderOperatingDays] = useState<string>('Monday,Tuesday,Wednesday,Thursday,Friday,Saturday');
  const [builderDistanceKm, setBuilderDistanceKm] = useState<number>(25);
  const [builderDurationMins, setBuilderDurationMins] = useState<number>(45);
  const [builderStops, setBuilderStops] = useState<BuilderStopItem[]>([]);
  const [builderRoadGeometry, setBuilderRoadGeometry] = useState<[number, number][] | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [selectedAddStopId, setSelectedAddStopId] = useState<number | ''>('');

  // ================= SUPABASE SYNC STATE =================
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);

  // ================= BROADCAST & COMPLAINTS =================
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastCategory, setBroadcastCategory] = useState<string>('announcement');
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [complaintStatusInput, setComplaintStatusInput] = useState<Complaint['status']>('In Progress');
  const [complaintNotesInput, setComplaintNotesInput] = useState<string>('');
  const [complaintFilter, setComplaintFilter] = useState<string>('All');

  // ================= TRIP HISTORY FILTERS & STOP EVENTS =================
  const [tripFilterDate, setTripFilterDate] = useState<string>('');
  const [tripFilterBus, setTripFilterBus] = useState<string>('all');
  const [tripFilterDriver, setTripFilterDriver] = useState<string>('all');
  const [tripFilterRoute, setTripFilterRoute] = useState<string>('all');
  const [tripFilterStatus, setTripFilterStatus] = useState<string>('all');
  const [selectedTripForEvents, setSelectedTripForEvents] = useState<Trip | null>(null);
  const [tripStopEvents, setTripStopEvents] = useState<any[]>([]);
  const [loadingStopEvents, setLoadingStopEvents] = useState<boolean>(false);

  const openTripEventsModal = async (trip: Trip) => {
    setSelectedTripForEvents(trip);
    setLoadingStopEvents(true);
    try {
      const events = await api.trips.getStopEvents(trip.id);
      setTripStopEvents(events);
    } catch (err: any) {
      console.warn('Failed to load trip stop events:', err.message);
      setTripStopEvents([]);
    } finally {
      setLoadingStopEvents(false);
    }
  };

  // Load All Dashboard Data
  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [busList, driverList, routeList, pointsList, complaintList, tripList, studentList, sbStatus] = await Promise.all([
        api.buses.getAll(),
        api.drivers.getAll(),
        api.routes.getAll(),
        api.pickupPoints.getAll(),
        api.complaints.getAll(),
        api.trips.getAll(),
        api.auth.getStudents().catch(() => []),
        api.admin.getSupabaseStatus().catch(() => null),
      ]);

      setBuses(busList);
      setDrivers(driverList);
      setRoutes(routeList);
      setPickupPoints(pointsList);
      setComplaints(complaintList);
      setTrips(tripList);
      setStudents(studentList || []);
      if (sbStatus && sbStatus.supabase) {
        setSupabaseStatus(sbStatus.supabase);
      }
    } catch (e: any) {
      console.error('[Admin] Load data error:', e.message);
      showToast('error', `Failed loading dashboard data: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await api.admin.syncSupabase();
      showToast('success', res.message || 'All records successfully synchronized to Supabase PostgreSQL!');
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Supabase sync error: ${e.message}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadDashboardData();
    }
  }, [isAuthenticated, isAdmin]);

  // ================= BUS CRUD HANDLERS =================
  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusNumber.trim() || !newBusName.trim()) {
      showToast('error', 'Bus number and bus name are required');
      return;
    }

    try {
      await api.buses.create({
        bus_number: newBusNumber.trim(),
        bus_name: newBusName.trim(),
        registration_number: newBusRegNumber.trim() || newBusNumber.trim().replace(/-/g, ''),
        capacity: Number(newBusCapacity) || 50,
        assigned_driver_id: newBusDriverId ? Number(newBusDriverId) : null,
        assigned_route_id: newBusRouteId ? Number(newBusRouteId) : null,
      });
      setShowAddBusModal(false);
      setNewBusNumber('');
      setNewBusName('');
      setNewBusRegNumber('');
      setNewBusCapacity(50);
      setNewBusDriverId('');
      setNewBusRouteId('');
      showToast('success', 'New bus registered successfully in fleet!');
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Error creating bus: ${e.message}`);
    }
  };

  const openEditBusModal = (bus: Bus) => {
    setEditingBus(bus);
    setEditBusNumber(bus.bus_number);
    setEditBusName(bus.bus_name);
    setEditBusRegNumber(bus.registration_number || '');
    setEditBusCapacity(bus.capacity || 50);
    setEditBusDriverId(bus.assigned_driver_id || '');
    setEditBusRouteId(bus.assigned_route_id || '');
    setEditBusStatus(bus.status);
    setEditBusIsActive(bus.is_active);
  };

  const handleUpdateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBus) return;

    try {
      await api.buses.update(editingBus.id, {
        bus_number: editBusNumber.trim(),
        bus_name: editBusName.trim(),
        registration_number: editBusRegNumber.trim(),
        capacity: Number(editBusCapacity),
        assigned_driver_id: editBusDriverId ? Number(editBusDriverId) : null,
        assigned_route_id: editBusRouteId ? Number(editBusRouteId) : null,
        status: editBusStatus,
        is_active: editBusIsActive,
      });
      setEditingBus(null);
      showToast('success', `Bus ${editBusNumber} updated successfully!`);
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Error updating bus: ${e.message}`);
    }
  };

  const confirmDeactivateBus = (bus: Bus) => {
    setConfirmModal({
      title: 'Deactivate College Bus',
      message: `Are you sure you want to deactivate bus ${bus.bus_number} (${bus.bus_name})? It will be removed from student view and future trip assignments.`,
      confirmText: 'Deactivate Bus',
      onConfirm: async () => {
        try {
          await api.buses.delete(bus.id);
          showToast('success', `Bus ${bus.bus_number} deactivated successfully`);
          loadDashboardData();
        } catch (e: any) {
          showToast('error', `Failed deactivating bus: ${e.message}`);
        }
      },
    });
  };

  // ================= DRIVER CRUD HANDLERS =================
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim() || !newDriverPhone.trim()) {
      showToast('error', 'Full Name and Phone are required');
      return;
    }

    try {
      await api.drivers.create({
        full_name: newDriverName.trim(),
        phone: newDriverPhone.trim(),
        employee_id: newDriverEmpId.trim() || `DRV-${Date.now().toString().slice(-4)}`,
        license_number: newDriverLicense.trim(),
        assigned_bus_id: newDriverAssignedBusId ? Number(newDriverAssignedBusId) : null,
      });
      setShowAddDriverModal(false);
      setNewDriverName('');
      setNewDriverPhone('');
      setNewDriverEmpId('');
      setNewDriverLicense('');
      setNewDriverAssignedBusId('');
      showToast('success', 'Driver registered and assigned successfully!');
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Error creating driver: ${e.message}`);
    }
  };

  const openEditDriverModal = (driver: Driver) => {
    setEditingDriver(driver);
    setEditDriverName(driver.full_name);
    setEditDriverPhone(driver.phone);
    setEditDriverEmpId(driver.employee_id || '');
    setEditDriverLicense(driver.license_number || '');
    setEditDriverStatus(driver.status);
    setEditDriverAssignedBusId(driver.bus_id || '');
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    try {
      await api.drivers.update(editingDriver.id, {
        full_name: editDriverName.trim(),
        phone: editDriverPhone.trim(),
        employee_id: editDriverEmpId.trim(),
        license_number: editDriverLicense.trim(),
        status: editDriverStatus,
        assigned_bus_id: editDriverAssignedBusId ? Number(editDriverAssignedBusId) : null,
      });
      setEditingDriver(null);
      showToast('success', `Driver ${editDriverName} updated successfully!`);
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Error updating driver: ${e.message}`);
    }
  };

  const confirmDeactivateDriver = (driver: Driver) => {
    setConfirmModal({
      title: 'Deactivate Driver Account',
      message: `Are you sure you want to deactivate driver ${driver.full_name}? Any assigned bus will be unlinked.`,
      confirmText: 'Deactivate Driver',
      onConfirm: async () => {
        try {
          await api.drivers.delete(driver.id);
          showToast('success', `Driver ${driver.full_name} deactivated successfully`);
          loadDashboardData();
        } catch (e: any) {
          showToast('error', `Failed deactivating driver: ${e.message}`);
        }
      },
    });
  };

  // ================= PICKUP POINT CRUD HANDLERS =================
  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStopName.trim()) {
      showToast('error', 'Pickup point name is required');
      return;
    }

    try {
      await api.pickupPoints.create({
        name: newStopName.trim(),
        latitude: parseFloat(newStopLat) || 14.05,
        longitude: parseFloat(newStopLng) || 74.52,
        landmark: newStopLandmark.trim(),
        address: newStopAddress.trim(),
      });
      setShowAddStopModal(false);
      setNewStopName('');
      setNewStopLat('14.05');
      setNewStopLng('74.52');
      setNewStopLandmark('');
      setNewStopAddress('');
      showToast('success', 'New pickup point with exact map coordinates saved to Supabase!');
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Error adding stop: ${e.message}`);
    }
  };

  const openEditStopModal = (point: PickupPoint) => {
    setEditingStop(point);
    setEditStopName(point.name);
    setEditStopLat(point.latitude.toString());
    setEditStopLng(point.longitude.toString());
    setEditStopLandmark(point.landmark || '');
    setEditStopAddress((point as any).address || '');
  };

  const handleUpdateStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStop) return;

    try {
      await api.pickupPoints.update(editingStop.id, {
        name: editStopName.trim(),
        latitude: parseFloat(editStopLat) || editingStop.latitude,
        longitude: parseFloat(editStopLng) || editingStop.longitude,
        landmark: editStopLandmark.trim(),
        address: editStopAddress.trim(),
      });
      setEditingStop(null);
      showToast('success', `Pickup point "${editStopName}" updated in Supabase!`);
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Error updating pickup point: ${e.message}`);
    }
  };

  const confirmDeleteStop = (point: PickupPoint) => {
    setConfirmModal({
      title: 'Remove Pickup Point',
      message: `Are you sure you want to remove "${point.name}" from active pickup stops?`,
      confirmText: 'Remove Stop',
      onConfirm: async () => {
        try {
          await api.pickupPoints.delete(point.id);
          showToast('success', `Pickup point "${point.name}" removed successfully`);
          loadDashboardData();
        } catch (e: any) {
          showToast('error', `Failed removing pickup point: ${e.message}`);
        }
      },
    });
  };

  // ================= ROUTE BUILDER HANDLERS =================
  const recalculateRoadPath = async (stops: BuilderStopItem[]) => {
    if (stops.length < 2) {
      setBuilderRoadGeometry(null);
      return;
    }
    setIsCalculatingRoute(true);
    try {
      const roadData = await api.routes.calculateRoadPath(
        stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }))
      );
      if (roadData && roadData.coordinates && roadData.coordinates.length > 0) {
        setBuilderRoadGeometry(roadData.coordinates);
        setBuilderDistanceKm(roadData.totalDistanceKm);
        setBuilderDurationMins(roadData.estimatedDurationMins);
        if (roadData.legs && roadData.legs.length === stops.length - 1) {
          setBuilderStops((prev) =>
            prev.map((stop, idx) => {
              if (idx === 0) return { ...stop, distance_from_prev_km: 0 };
              const leg = roadData.legs[idx - 1];
              return leg ? { ...stop, distance_from_prev_km: leg.distanceKm } : stop;
            })
          );
        }
      }
    } catch (e) {
      // Keep existing linear calculation
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const openCreateRouteBuilder = () => {
    setBuilderRouteId(null);
    setBuilderRouteName('');
    setBuilderStartPoint(pickupPoints[0]?.name || '');
    setBuilderDestination(pickupPoints[pickupPoints.length - 1]?.name || 'College Main Gate');
    setBuilderOperatingDays('Monday,Tuesday,Wednesday,Thursday,Friday,Saturday');
    setBuilderDistanceKm(28);
    setBuilderDurationMins(50);
    setBuilderRoadGeometry(null);

    // Initialize with 2 default stops if available
    if (pickupPoints.length >= 2) {
      const p1 = pickupPoints[0];
      const p2 = pickupPoints[1];
      const initialStops = [
        {
          pickup_point_id: p1.id,
          stop_name: p1.name,
          landmark: p1.landmark || '',
          latitude: p1.latitude,
          longitude: p1.longitude,
          scheduled_arrival_time: '07:30:00',
          scheduled_departure_time: '07:35:00',
          distance_from_prev_km: 0,
        },
        {
          pickup_point_id: p2.id,
          stop_name: p2.name,
          landmark: p2.landmark || '',
          latitude: p2.latitude,
          longitude: p2.longitude,
          scheduled_arrival_time: '07:50:00',
          scheduled_departure_time: '07:55:00',
          distance_from_prev_km: 12.5,
        },
      ];
      setBuilderStops(initialStops);
      recalculateRoadPath(initialStops);
    } else {
      setBuilderStops([]);
    }
    setShowRouteBuilder(true);
  };

  const openEditRouteBuilder = (route: Route) => {
    setBuilderRouteId(route.id);
    setBuilderRouteName(route.route_name);
    setBuilderStartPoint(route.start_point);
    setBuilderDestination(route.destination);
    setBuilderOperatingDays(route.operating_days);
    setBuilderDistanceKm(route.total_distance_km);
    setBuilderDurationMins(route.estimated_duration_mins);
    setBuilderRoadGeometry(route.road_geometry || null);

    const ordered = (route.stops || []).map((s) => ({
      pickup_point_id: s.pickup_point_id,
      stop_name: s.stop_name,
      landmark: s.landmark,
      latitude: s.latitude,
      longitude: s.longitude,
      scheduled_arrival_time: s.scheduled_arrival_time,
      scheduled_departure_time: s.scheduled_departure_time,
      distance_from_prev_km: s.distance_from_prev_km || 0,
    }));
    setBuilderStops(ordered);
    if (!route.road_geometry) {
      recalculateRoadPath(ordered);
    }
    setShowRouteBuilder(true);
  };

  const handleAddStopToBuilder = () => {
    if (!selectedAddStopId) return;
    const point = pickupPoints.find((p) => p.id === Number(selectedAddStopId));
    if (!point) return;

    // Check if already in stops
    if (builderStops.some((s) => s.pickup_point_id === point.id)) {
      showToast('error', `Stop "${point.name}" is already in this route sequence.`);
      return;
    }

    const lastStop = builderStops[builderStops.length - 1];
    let defaultArrival = '08:00:00';
    let defaultDeparture = '08:05:00';
    if (lastStop && lastStop.scheduled_departure_time) {
      const parts = lastStop.scheduled_departure_time.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) + 15;
      const newH = h + Math.floor(m / 60);
      const newM = m % 60;
      defaultArrival = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`;
      defaultDeparture = `${String(newH).padStart(2, '0')}:${String(newM + 5).padStart(2, '0')}:00`;
    }

    const updated = [
      ...builderStops,
      {
        pickup_point_id: point.id,
        stop_name: point.name,
        landmark: point.landmark || '',
        latitude: point.latitude,
        longitude: point.longitude,
        scheduled_arrival_time: defaultArrival,
        scheduled_departure_time: defaultDeparture,
        distance_from_prev_km: 10.0,
      },
    ];
    setBuilderStops(updated);
    setSelectedAddStopId('');
    recalculateRoadPath(updated);
  };

  const handleMoveStopUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...builderStops];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setBuilderStops(updated);
    recalculateRoadPath(updated);
  };

  const handleMoveStopDown = (index: number) => {
    if (index >= builderStops.length - 1) return;
    const updated = [...builderStops];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setBuilderStops(updated);
    recalculateRoadPath(updated);
  };

  const handleRemoveBuilderStop = (index: number) => {
    const updated = builderStops.filter((_, i) => i !== index);
    setBuilderStops(updated);
    recalculateRoadPath(updated);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderRouteName.trim()) {
      showToast('error', 'Route name is required');
      return;
    }
    if (builderStops.length < 2) {
      showToast('error', 'A route requires at least 2 stops (Origin and Destination)');
      return;
    }

    const payloadStops = builderStops.map((s, idx) => ({
      pickup_point_id: s.pickup_point_id,
      stop_sequence: idx + 1,
      scheduled_arrival_time: s.scheduled_arrival_time || '07:30:00',
      scheduled_departure_time: s.scheduled_departure_time || '07:35:00',
      distance_from_prev_km: Number(s.distance_from_prev_km) || 0,
    }));

    const payload = {
      route_name: builderRouteName.trim(),
      start_point: builderStartPoint || builderStops[0]?.stop_name || 'Origin',
      destination: builderDestination || builderStops[builderStops.length - 1]?.stop_name || 'Destination',
      operating_days: builderOperatingDays,
      total_distance_km: Number(builderDistanceKm) || 25,
      estimated_duration_mins: Number(builderDurationMins) || 45,
      road_geometry: builderRoadGeometry,
      stops: payloadStops,
    };

    try {
      if (builderRouteId) {
        await api.routes.update(builderRouteId, payload);
        showToast('success', `Route "${builderRouteName}" updated with road path in Supabase!`);
      } else {
        await api.routes.create(payload);
        showToast('success', `New route "${builderRouteName}" created with ${builderStops.length} stops in Supabase!`);
      }
      setShowRouteBuilder(false);
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Failed saving route: ${e.message}`);
    }
  };

  const confirmDeleteRoute = (route: Route) => {
    setConfirmModal({
      title: 'Delete Bus Route',
      message: `Are you sure you want to delete route "${route.route_name}"? All assigned route stop sequences will be cleared.`,
      confirmText: 'Delete Route',
      onConfirm: async () => {
        try {
          await api.routes.delete(route.id);
          showToast('success', `Route "${route.route_name}" deleted successfully`);
          loadDashboardData();
        } catch (e: any) {
          showToast('error', `Failed deleting route: ${e.message}`);
        }
      },
    });
  };

  // Build synthetic route object for live map preview in Route Builder
  const previewSyntheticRoute: Route | null = builderStops.length > 0 ? {
    id: builderRouteId || 999,
    route_name: builderRouteName || 'New Route Preview',
    start_point: builderStartPoint || builderStops[0]?.stop_name || '',
    destination: builderDestination || builderStops[builderStops.length - 1]?.stop_name || '',
    operating_days: builderOperatingDays,
    status: 'active',
    total_distance_km: builderDistanceKm,
    estimated_duration_mins: builderDurationMins,
    stops: builderStops.map((s, idx) => ({
      id: idx + 1,
      route_id: builderRouteId || 999,
      pickup_point_id: s.pickup_point_id,
      stop_sequence: idx + 1,
      scheduled_arrival_time: s.scheduled_arrival_time,
      scheduled_departure_time: s.scheduled_departure_time,
      distance_from_prev_km: s.distance_from_prev_km,
      stop_name: s.stop_name,
      latitude: s.latitude,
      longitude: s.longitude,
      landmark: s.landmark,
    })),
    road_geometry: builderRoadGeometry || undefined,
  } : null;

  // Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.notifications.sendAnnouncement({
        title: broadcastTitle,
        message: broadcastMessage,
        category: broadcastCategory,
      });
      setBroadcastResult('Announcement broadcasted successfully to all devices!');
      setTimeout(() => {
        setBroadcastResult(null);
        setShowBroadcastModal(false);
        setBroadcastTitle('');
        setBroadcastMessage('');
      }, 2000);
      showToast('success', 'Announcement broadcasted to student & driver apps!');
    } catch (e: any) {
      setBroadcastResult(`Error: ${e.message}`);
      showToast('error', `Broadcast failed: ${e.message}`);
    }
  };

  // Complaint Update
  const handleUpdateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    try {
      await api.complaints.updateStatus(
        selectedComplaint.id,
        complaintStatusInput,
        complaintNotesInput,
        user?.fullName || 'System Administrator'
      );
      setSelectedComplaint(null);
      showToast('success', `Complaint ${selectedComplaint.reference_no} updated to ${complaintStatusInput}`);
      loadDashboardData();
    } catch (e: any) {
      showToast('error', `Error updating complaint: ${e.message}`);
    }
  };

  // Filters for Data Lists
  const filteredBuses = buses.filter(
    (b) =>
      b.bus_number.toLowerCase().includes(busSearch.toLowerCase()) ||
      b.bus_name.toLowerCase().includes(busSearch.toLowerCase()) ||
      (b.driver_name && b.driver_name.toLowerCase().includes(busSearch.toLowerCase())) ||
      (b.route_name && b.route_name.toLowerCase().includes(busSearch.toLowerCase()))
  );

  const filteredDrivers = drivers.filter(
    (d) =>
      d.full_name.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.phone.includes(driverSearch) ||
      (d.employee_id && d.employee_id.toLowerCase().includes(driverSearch.toLowerCase())) ||
      (d.bus_number && d.bus_number.toLowerCase().includes(driverSearch.toLowerCase()))
  );

  const filteredStops = pickupPoints.filter(
    (p) =>
      p.name.toLowerCase().includes(stopSearch.toLowerCase()) ||
      (p.landmark && p.landmark.toLowerCase().includes(stopSearch.toLowerCase()))
  );

  const filteredRoutes = routes.filter(
    (r) =>
      r.route_name.toLowerCase().includes(routeSearch.toLowerCase()) ||
      r.start_point.toLowerCase().includes(routeSearch.toLowerCase()) ||
      r.destination.toLowerCase().includes(routeSearch.toLowerCase())
  );

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.student_id.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  const filteredComplaints = complaints.filter(
    (c) => complaintFilter === 'All' || c.status === complaintFilter
  );

  // Metrics
  const activeBusesCount = buses.filter((b) => b.is_active === 1).length;
  const runningBusesCount = buses.filter((b) => b.status === 'running_on_time' || b.status === 'approaching_pickup').length;
  const delayedBusesCount = buses.filter((b) => b.status === 'delayed').length;
  const openComplaintsCount = complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected').length;
  const gpsConnectedCount = buses.filter((b) => b.gps_status === 'active').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Feedback Banner */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl shadow-elevated border flex items-center gap-2.5 text-xs font-bold animate-slideDown ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-brand-primary rounded-lg text-brand-navy shadow-subtle">
              <Shield className="w-5 h-5 text-brand-navy" />
            </span>
            <span className="text-xs uppercase font-extrabold text-brand-accent tracking-wider">
              Fleet Administration Center
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">
            Smart Transportation Fleet Management
          </h1>
          <p className="text-xs text-brand-gray mt-0.5">
            Full administrative control: configure buses, drivers, pickup stops, routes, GPS tracking, and student feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-navy hover:bg-brand-navy/90 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Radio className="w-4 h-4 text-brand-primary" />
            <span>Broadcast Alert</span>
          </button>

          <button
            onClick={loadDashboardData}
            className="p-2 bg-brand-secondary hover:bg-brand-primary text-brand-navy rounded-xl transition-colors border border-brand-primary/40"
            title="Refresh Fleet Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={logout}
            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors border border-red-200"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">Total Buses</span>
          <span className="text-xl font-extrabold text-brand-navy mt-1 block">{buses.length}</span>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">Active Fleet</span>
          <span className="text-xl font-extrabold text-brand-navy mt-1 block">{activeBusesCount}</span>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">In Transit</span>
          <span className="text-xl font-extrabold text-emerald-700 mt-1 block">{runningBusesCount}</span>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">GPS Streaming</span>
          <span className="text-xl font-extrabold text-brand-accent mt-1 block">{gpsConnectedCount}</span>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">Delayed</span>
          <span className="text-xl font-extrabold text-amber-600 mt-1 block">{delayedBusesCount}</span>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">Routes</span>
          <span className="text-xl font-extrabold text-brand-navy mt-1 block">{routes.length}</span>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">Drivers</span>
          <span className="text-xl font-extrabold text-brand-navy mt-1 block">{drivers.length}</span>
        </div>
        <div className="p-3.5 bg-white rounded-2xl border border-brand-secondary shadow-subtle text-center">
          <span className="text-[10px] uppercase font-bold text-brand-gray block">Complaints</span>
          <span className="text-xl font-extrabold text-red-600 mt-1 block">{openComplaintsCount}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-brand-primary/50 rounded-2xl shadow-subtle text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('buses')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'buses' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Bus Management ({buses.length})
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'drivers' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Driver Management ({drivers.length})
        </button>
        <button
          onClick={() => setActiveTab('stops')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'stops' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Pickup Points ({pickupPoints.length})
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'routes' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Route Builder ({routes.length})
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'trips' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Trips ({trips.length})
        </button>
        <button
          onClick={() => setActiveTab('gps')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'gps' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Live Telemetry
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'students' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Student Management ({students.length})
        </button>
        <button
          onClick={() => setActiveTab('complaints')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'complaints' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Complaints ({complaints.length})
        </button>
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'broadcast' ? 'bg-[#263746] text-white shadow-sm' : 'text-brand-gray hover:text-brand-navy'
          }`}
        >
          Broadcast Center
        </button>
      </div>

      {/* ================= TAB 1: FLEET OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Supabase Database Integration Status & Control Banner */}
          <div className="bg-gradient-to-r from-brand-secondary/40 via-white to-brand-primary/20 rounded-3xl p-5 border border-brand-primary/60 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-brand-navy rounded-2xl text-white shadow-subtle shrink-0">
                  <Database className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-brand-navy text-sm sm:text-base">
                      Supabase PostgreSQL Database Management
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        supabaseStatus?.isConnected
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          supabaseStatus?.isConnected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                        }`}
                      />
                      <span>
                        {supabaseStatus?.isConnected
                          ? 'Connected to Supabase PostgreSQL'
                          : 'Persistent Storage (Ready to Sync)'}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-brand-gray mt-1 leading-relaxed">
                    All administrative updates, bus assignments, exact map pickup stops, live GPS telemetry, notifications, and automated trip histories are permanently stored in Supabase PostgreSQL.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-semibold text-brand-navy">
                    <span className="px-2 py-0.5 bg-white border border-brand-primary/40 rounded-md">
                      🚌 {buses.length} Buses
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-brand-primary/40 rounded-md">
                      🛣️ {routes.length} Routes
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-brand-primary/40 rounded-md">
                      📍 {pickupPoints.length} Pickup Points
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-brand-primary/40 rounded-md">
                      📅 {trips.length} Trip Histories
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={handleSyncSupabase}
                  disabled={isSyncingSupabase}
                  className="px-4 py-2 bg-brand-accent hover:bg-[#5b95c3] text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  <UploadCloud className={`w-4 h-4 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSupabase ? 'Syncing to Supabase...' : 'Sync Database to Supabase'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-brand-accent" />
                  <span>Real-Time Fleet Live Map</span>
                </h3>
                <p className="text-xs text-brand-gray">
                  Displaying coastal college routes with active bus telemetry and stop locations.
                </p>
              </div>
              <span className="text-xs font-bold text-brand-navy bg-brand-secondary/60 px-3 py-1 rounded-lg self-start">
                {buses.length} Fleet Vehicles
              </span>
            </div>

            <LiveBusMap
              bus={buses[0] || null}
              route={routes[0] || null}
              className="h-[480px]"
            />
          </div>
        </div>
      )}

      {/* ================= TAB 2: BUS MANAGEMENT ================= */}
      {activeTab === 'buses' && (
        <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                <BusIcon className="w-5 h-5 text-brand-accent" />
                <span>Bus Fleet Management</span>
              </h3>
              <p className="text-xs text-brand-gray">
                Add, edit, reassign, or deactivate college buses. Changes automatically sync across student and driver apps.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-brand-gray absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search buses..."
                  value={busSearch}
                  onChange={(e) => setBusSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <button
                onClick={() => setShowAddBusModal(true)}
                className="bg-brand-accent hover:bg-[#5b95c3] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bus</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-secondary">
            <table className="w-full text-left text-xs text-brand-navy">
              <thead className="bg-brand-secondary/60 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Bus ID</th>
                  <th className="p-3.5">Bus Number / Name</th>
                  <th className="p-3.5">Assigned Driver</th>
                  <th className="p-3.5">Assigned Route</th>
                  <th className="p-3.5">Capacity</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Active</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBuses.map((b) => (
                  <tr key={b.id} className="hover:bg-brand-cream/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-gray">#{b.id}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-brand-navy">{b.bus_number}</p>
                      <p className="text-[10px] text-brand-gray">{b.bus_name}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-brand-navy">{b.driver_name || 'Unassigned'}</p>
                      {b.driver_phone && <p className="text-[10px] font-mono text-brand-gray">{b.driver_phone}</p>}
                    </td>
                    <td className="p-3.5 font-medium">{b.route_name || 'Unassigned'}</td>
                    <td className="p-3.5 font-mono">{b.capacity} seats</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize bg-brand-cream text-brand-navy border border-brand-primary/40">
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.is_active === 1
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.is_active === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditBusModal(b)}
                        className="p-1.5 text-brand-accent hover:text-brand-navy hover:bg-brand-secondary rounded-lg transition-colors mr-1"
                        title="Edit Bus"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {b.is_active === 1 && (
                        <button
                          onClick={() => confirmDeactivateBus(b)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate Bus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredBuses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-brand-gray italic">
                      No matching buses found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: DRIVER MANAGEMENT ================= */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-accent" />
                <span>Driver Fleet Directory</span>
              </h3>
              <p className="text-xs text-brand-gray">
                Add new drivers, update contact details, and manage bus assignments.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-brand-gray absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search drivers..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <button
                onClick={() => setShowAddDriverModal(true)}
                className="bg-brand-accent hover:bg-[#5b95c3] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Driver</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-secondary">
            <table className="w-full text-left text-xs text-brand-navy">
              <thead className="bg-brand-secondary/60 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Emp ID</th>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Phone Number</th>
                  <th className="p-3.5">License Number</th>
                  <th className="p-3.5">Assigned Bus</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-brand-cream/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-gray">{d.employee_id || `DRV-${d.id}`}</td>
                    <td className="p-3.5 font-bold text-brand-navy">{d.full_name}</td>
                    <td className="p-3.5 font-mono">{d.phone}</td>
                    <td className="p-3.5 font-mono">{d.license_number || 'N/A'}</td>
                    <td className="p-3.5 font-semibold">
                      {d.bus_number ? (
                        <span className="px-2 py-0.5 bg-brand-secondary text-brand-navy rounded-lg font-bold">
                          {d.bus_number}
                        </span>
                      ) : (
                        <span className="text-brand-gray italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          d.status === 'active' || d.status === 'on_duty'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditDriverModal(d)}
                        className="p-1.5 text-brand-accent hover:text-brand-navy hover:bg-brand-secondary rounded-lg transition-colors mr-1"
                        title="Edit Driver"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {d.status !== 'inactive' && (
                        <button
                          onClick={() => confirmDeactivateDriver(d)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate Driver"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-brand-gray italic">
                      No matching drivers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: PICKUP POINT MANAGEMENT ================= */}
      {activeTab === 'stops' && (
        <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-accent" />
                <span>Pickup Points Master List</span>
              </h3>
              <p className="text-xs text-brand-gray">
                Configure bus stops and landmarks. Renaming a stop automatically propagates across the student stop selector, ETA calculation, and map markers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-brand-gray absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search pickup points..."
                  value={stopSearch}
                  onChange={(e) => setStopSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <button
                onClick={() => setShowAddStopModal(true)}
                className="bg-brand-accent hover:bg-[#5b95c3] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Pickup Point</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-secondary">
            <table className="w-full text-left text-xs text-brand-navy">
              <thead className="bg-brand-secondary/60 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Stop ID</th>
                  <th className="p-3.5">Stop Name</th>
                  <th className="p-3.5">Geographical Coordinates</th>
                  <th className="p-3.5">Landmark Description</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStops.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-cream/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-gray">#{p.id}</td>
                    <td className="p-3.5 font-bold text-brand-navy">{p.name}</td>
                    <td className="p-3.5 font-mono text-[11px]">
                      {p.latitude.toFixed(6)}°, {p.longitude.toFixed(6)}°
                    </td>
                    <td className="p-3.5 text-brand-gray">{p.landmark || 'None specified'}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                        Active
                      </span>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditStopModal(p)}
                        className="p-1.5 text-brand-accent hover:text-brand-navy hover:bg-brand-secondary rounded-lg transition-colors mr-1"
                        title="Rename or Edit Coordinates"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => confirmDeleteStop(p)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove Stop"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStops.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-brand-gray italic">
                      No matching pickup points found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 5: ROUTE MANAGEMENT & ROUTE BUILDER ================= */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                <RouteIcon className="w-5 h-5 text-brand-accent" />
                <span>Interactive Route Management & Route Builder</span>
              </h3>
              <p className="text-xs text-brand-gray mt-0.5">
                Define college bus routes independently. Add, remove, and reorder stops along the exact transit sequence.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-brand-gray absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search routes..."
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <button
                onClick={openCreateRouteBuilder}
                className="bg-brand-accent hover:bg-[#5b95c3] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Route</span>
              </button>
            </div>
          </div>

          {/* Route Cards */}
          <div className="space-y-4">
            {filteredRoutes.map((r) => (
              <div key={r.id} className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-brand-accent uppercase">Route #{r.id}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                        {r.status}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-brand-navy mt-0.5">{r.route_name}</h4>
                    <p className="text-xs text-brand-gray">
                      {r.start_point} ➔ {r.destination} • {r.total_distance_km} km ({r.estimated_duration_mins} mins)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => openEditRouteBuilder(r)}
                      className="px-3 py-1.5 bg-brand-secondary hover:bg-brand-primary text-brand-navy text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 border border-brand-primary/40"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Route & Stops</span>
                    </button>
                    <button
                      onClick={() => confirmDeleteRoute(r)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors border border-red-200"
                      title="Delete Route"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Ordered Stops Along Route */}
                <div className="border-t border-brand-secondary/70 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-[11px] font-bold text-brand-navy uppercase tracking-wider">
                      Ordered Route Stops Sequence ({r.stops?.length || 0} stops)
                    </h5>
                    <span className="text-[10px] text-brand-gray">Progressive Stop Order ➔</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {r.stops?.map((s) => (
                      <div key={s.id} className="p-3 bg-brand-cream/50 rounded-2xl border border-brand-primary/40 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-brand-navy bg-brand-primary/60 px-2 py-0.5 rounded-lg text-[10px]">
                            Stop #{s.stop_sequence}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-emerald-700">
                            {s.scheduled_arrival_time}
                          </span>
                        </div>
                        <h6 className="font-bold text-sm text-brand-navy mt-1.5 truncate">{s.stop_name}</h6>
                        <p className="text-[10px] text-brand-gray mt-0.5 truncate">
                          {s.landmark || `${s.latitude.toFixed(4)}°, ${s.longitude.toFixed(4)}°`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 6: TRIPS MANAGEMENT ================= */}
      {activeTab === 'trips' && (() => {
        const filteredTrips = trips.filter((t) => {
          if (tripFilterDate && t.trip_date !== tripFilterDate) return false;
          if (tripFilterBus !== 'all' && String(t.bus_id) !== tripFilterBus) return false;
          if (tripFilterDriver !== 'all' && String(t.driver_id) !== tripFilterDriver) return false;
          if (tripFilterRoute !== 'all' && String(t.route_id) !== tripFilterRoute) return false;
          if (tripFilterStatus !== 'all' && t.status !== tripFilterStatus) return false;
          return true;
        });

        const completedTripsCount = trips.filter((t) => t.status === 'completed').length;
        const inProgressTripsCount = trips.filter((t) => t.status === 'in_progress').length;
        const onTimeTripsCount = trips.filter((t) => t.status === 'completed' && (!t.delay_mins || t.delay_mins <= 0)).length;
        const onTimePercent = completedTripsCount > 0 ? Math.round((onTimeTripsCount / completedTripsCount) * 100) : 100;
        const avgDelayMins = completedTripsCount > 0
          ? (trips.filter((t) => t.status === 'completed').reduce((acc, curr) => acc + (curr.delay_mins || 0), 0) / completedTripsCount).toFixed(1)
          : '0';

        const isFiltered = Boolean(tripFilterDate || tripFilterBus !== 'all' || tripFilterDriver !== 'all' || tripFilterRoute !== 'all' || tripFilterStatus !== 'all');

        return (
          <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-accent" />
                  <span>Trip Operations & Historical Arrival Analytics</span>
                </h3>
                <p className="text-xs text-brand-gray">
                  Automated GPS trip logging, geofenced stop arrivals, schedule variance, and route version snapshots.
                </p>
              </div>
            </div>

            {/* Daily & Weekly Arrival Analytics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-brand-cream/60 border border-brand-secondary">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-gray">Total Trips</p>
                <p className="text-2xl font-black text-brand-navy mt-1">{trips.length}</p>
                <p className="text-[11px] text-brand-gray mt-0.5">{completedTripsCount} completed • {inProgressTripsCount} live</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">On-Time Performance</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{onTimePercent}%</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">{onTimeTripsCount} on-time arrivals</p>
              </div>
              <div className="p-4 rounded-2xl bg-sky-50 border border-brand-primary/40">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-navy">Active Dispatches</p>
                <p className="text-2xl font-black text-brand-accent mt-1">{inProgressTripsCount}</p>
                <p className="text-[11px] text-brand-gray mt-0.5">Buses streaming GPS</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Avg Schedule Delay</p>
                <p className="text-2xl font-black text-amber-700 mt-1">+{avgDelayMins}m</p>
                <p className="text-[11px] text-amber-800 mt-0.5">Across completed trips</p>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="p-4 rounded-2xl bg-brand-cream/40 border border-brand-secondary space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-navy flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-brand-accent" />
                  <span>Filter Trip Records ({filteredTrips.length} of {trips.length} shown)</span>
                </span>
                {isFiltered && (
                  <button
                    onClick={() => {
                      setTripFilterDate('');
                      setTripFilterBus('all');
                      setTripFilterDriver('all');
                      setTripFilterRoute('all');
                      setTripFilterStatus('all');
                    }}
                    className="text-[11px] font-semibold text-brand-accent hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reset Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-gray mb-1">Date</label>
                  <input
                    type="date"
                    value={tripFilterDate}
                    onChange={(e) => setTripFilterDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-brand-secondary bg-white text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-gray mb-1">Bus</label>
                  <select
                    value={tripFilterBus}
                    onChange={(e) => setTripFilterBus(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-brand-secondary bg-white text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  >
                    <option value="all">All Buses</option>
                    {buses.map((b) => (
                      <option key={b.id} value={String(b.id)}>{b.bus_number} - {b.bus_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-gray mb-1">Driver</label>
                  <select
                    value={tripFilterDriver}
                    onChange={(e) => setTripFilterDriver(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-brand-secondary bg-white text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  >
                    <option value="all">All Drivers</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={String(d.id)}>{d.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-gray mb-1">Route</label>
                  <select
                    value={tripFilterRoute}
                    onChange={(e) => setTripFilterRoute(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-brand-secondary bg-white text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  >
                    <option value="all">All Routes</option>
                    {routes.map((r) => (
                      <option key={r.id} value={String(r.id)}>{r.route_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-gray mb-1">Status</label>
                  <select
                    value={tripFilterStatus}
                    onChange={(e) => setTripFilterStatus(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-brand-secondary bg-white text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  >
                    <option value="all">All Statuses</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Trips Table */}
            <div className="overflow-x-auto rounded-xl border border-brand-secondary">
              <table className="w-full text-left text-xs text-brand-navy">
                <thead className="bg-brand-secondary/60 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="p-3.5">Trip ID</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Bus</th>
                    <th className="p-3.5">Route</th>
                    <th className="p-3.5">Driver</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Start / End</th>
                    <th className="p-3.5">Delay Variance</th>
                    <th className="p-3.5 text-center">Stop Timings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTrips.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-brand-gray">
                        No trips match your selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTrips.map((t) => (
                      <tr key={t.id} className="hover:bg-brand-cream/30 transition-colors">
                        <td className="p-3.5 font-mono font-bold">
                          <div>#{t.id}</div>
                          {t.route_snapshot && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-brand-cream text-brand-navy border border-brand-secondary">
                              Frozen v{t.route_snapshot?.route_version || 1}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono">{t.trip_date}</td>
                        <td className="p-3.5">
                          <div className="font-bold font-mono">{t.bus_number || `Bus #${t.bus_id}`}</div>
                          {t.bus_name && <div className="text-[10px] text-brand-gray">{t.bus_name}</div>}
                        </td>
                        <td className="p-3.5 font-medium">{t.route_name || `Route #${t.route_id}`}</td>
                        <td className="p-3.5 font-medium">{t.driver_name || `Driver #${t.driver_id}`}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              t.status === 'in_progress'
                                ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                                : t.status === 'completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[11px]">
                          <div>{t.start_time ? new Date(t.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                          <div className="text-brand-gray text-[10px]">
                            {t.end_time ? new Date(t.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In transit'}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono">
                          {t.delay_mins > 0 ? (
                            <span className="text-amber-700 font-bold">+{t.delay_mins}m</span>
                          ) : t.delay_mins < 0 ? (
                            <span className="text-blue-700 font-bold">{t.delay_mins}m</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">On time</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => openTripEventsModal(t)}
                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-brand-navy bg-brand-cream hover:bg-brand-secondary border border-brand-secondary inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-accent" />
                            <span>Stop Events</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ================= TAB 7: LIVE GPS TELEMETRY ================= */}
      {activeTab === 'gps' && (
        <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
          <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand-accent" />
            <span>Real-Time Fleet GPS Telemetry & Signal Health</span>
          </h3>
          <p className="text-xs text-brand-gray">
            Live coordinates, speed, heading, and packet freshness streamed from authenticated driver devices.
          </p>

          <div className="overflow-x-auto rounded-xl border border-brand-secondary">
            <table className="w-full text-left text-xs text-brand-navy">
              <thead className="bg-brand-secondary/60 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Bus Number</th>
                  <th className="p-3.5">Assigned Route</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">GPS Health</th>
                  <th className="p-3.5">Live Coordinates</th>
                  <th className="p-3.5">Current Speed</th>
                  <th className="p-3.5">Last Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {buses.map((b) => (
                  <tr key={b.id} className="hover:bg-brand-cream/30 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-sm">{b.bus_number}</td>
                    <td className="p-3.5">{b.route_name || 'N/A'}</td>
                    <td className="p-3.5 capitalize font-semibold">{b.status.replace(/_/g, ' ')}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.gps_status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.gps_status === 'stale'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {b.gps_status}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      {b.last_latitude && b.last_longitude
                        ? `${b.last_latitude.toFixed(5)}°, ${b.last_longitude.toFixed(5)}°`
                        : 'Waiting for signal'}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-800">{b.last_speed} km/h</td>
                    <td className="p-3.5 text-brand-gray text-[11px] font-mono">
                      {b.last_gps_timestamp ? new Date(b.last_gps_timestamp).toLocaleTimeString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 8: STUDENT MANAGEMENT ================= */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-accent" />
                <span>Registered Students & Route Preferences</span>
              </h3>
              <p className="text-xs text-brand-gray">
                Directory of registered student accounts, college IDs, and preferred bus pickup points.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-brand-gray absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-secondary">
            <table className="w-full text-left text-xs text-brand-navy">
              <thead className="bg-brand-secondary/60 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Student ID</th>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">College</th>
                  <th className="p-3.5">Preferred Bus</th>
                  <th className="p-3.5">Pickup Point</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-brand-cream/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-accent">{s.student_id || 'N/A'}</td>
                    <td className="p-3.5 font-bold text-brand-navy">{s.full_name}</td>
                    <td className="p-3.5 text-brand-gray">{s.email || 'N/A'}</td>
                    <td className="p-3.5 font-mono">{s.phone || 'N/A'}</td>
                    <td className="p-3.5 text-brand-gray">{s.college_name || 'Anjuman College'}</td>
                    <td className="p-3.5 font-semibold">{s.bus_number || 'Default'}</td>
                    <td className="p-3.5 font-medium">{s.pickup_point_name || 'Bhatkal Bus Stand'}</td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-brand-gray italic">
                      No matching students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 9: COMPLAINTS & FEEDBACK ================= */}
      {activeTab === 'complaints' && (
        <div className="bg-white rounded-3xl p-6 border border-brand-primary/50 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-accent" />
                <span>Student Complaints & Feedback Triage</span>
              </h3>
              <p className="text-xs text-brand-gray">
                Review submitted student incident reports, investigate issues, and post resolution audit notes.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-brand-gray font-semibold">Filter:</span>
              {(['All', 'New', 'Under Review', 'In Progress', 'Resolved'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setComplaintFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    complaintFilter === status
                      ? 'bg-brand-primary text-brand-navy font-bold'
                      : 'text-brand-gray hover:text-brand-navy'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-secondary">
            <table className="w-full text-left text-xs text-brand-navy">
              <thead className="bg-brand-secondary/60 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Ref No</th>
                  <th className="p-3.5">Student</th>
                  <th className="p-3.5">Bus / Route</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-cream/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-accent">{c.reference_no}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-brand-navy">{c.student_name}</p>
                      <p className="text-[10px] text-brand-gray font-mono">{c.student_id}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-brand-navy">{c.bus_number}</p>
                      <p className="text-[10px] text-brand-gray">{c.route_name}</p>
                    </td>
                    <td className="p-3.5 capitalize">{c.category.replace(/_/g, ' ')}</td>
                    <td className="p-3.5 max-w-xs truncate text-brand-gray" title={c.description}>
                      {c.description}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'Resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : c.status === 'Under Review'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedComplaint(c);
                          setComplaintStatusInput(c.status);
                          setComplaintNotesInput(c.resolution_notes || '');
                        }}
                        className="px-2.5 py-1 bg-brand-secondary hover:bg-brand-primary text-brand-navy rounded-lg font-bold text-xs transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 10: BROADCAST CENTER ================= */}
      {activeTab === 'broadcast' && (
        <div className="max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-brand-primary/50 shadow-card space-y-6">
          <div>
            <h3 className="font-bold text-brand-navy text-xl flex items-center gap-2">
              <Radio className="w-6 h-6 text-brand-accent" />
              <span>Campus Transit Broadcast Center</span>
            </h3>
            <p className="text-xs text-brand-gray mt-1">
              Dispatch urgent notifications, route diversions, or campus weather advisories to all registered student and driver devices in real time.
            </p>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Broadcast Category
              </label>
              <select
                value={broadcastCategory}
                onChange={(e) => setBroadcastCategory(e.target.value)}
                className="w-full p-2.5 bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-xs text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                <option value="announcement">Campus Transportation Announcement</option>
                <option value="delay_alert">Highway Traffic / Route Delay Alert</option>
                <option value="service_interruption">Service Maintenance / Schedule Revision</option>
                <option value="weather_alert">Monsoon / Severe Weather Alert</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Notification Title
              </label>
              <input
                type="text"
                required
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g. NH-66 Coastal Road Repair: 10 Min Expected Delay"
                className="w-full p-2.5 bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-xs text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Broadcast Message
              </label>
              <textarea
                required
                rows={4}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Detailed transit advisory message visible to students on mobile PWA and live dashboard..."
                className="w-full p-2.5 bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-xs text-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-brand-navy hover:bg-brand-navy/90 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-brand-primary" />
              <span>Broadcast Now to All Users</span>
            </button>
          </form>
        </div>
      )}

      {/* ================= MODAL: ADD BUS ================= */}
      {showAddBusModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-brand-primary shadow-elevated animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary">
              <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                <BusIcon className="w-5 h-5 text-brand-accent" />
                <span>Register New Bus</span>
              </h3>
              <button onClick={() => setShowAddBusModal(false)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBus} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Bus Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KA-47-C-9900"
                  value={newBusNumber}
                  onChange={(e) => setNewBusNumber(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Bus Name / Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. College Bus 03 (Express)"
                  value={newBusName}
                  onChange={(e) => setNewBusName(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Capacity (Seats)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={newBusCapacity}
                  onChange={(e) => setNewBusCapacity(Number(e.target.value))}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Assign Driver</label>
                <select
                  value={newBusDriverId}
                  onChange={(e) => setNewBusDriverId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value="">-- No Driver Assigned --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Assign Route</label>
                <select
                  value={newBusRouteId}
                  onChange={(e) => setNewBusRouteId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value="">-- No Route Assigned --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.route_name} ({r.start_point} ➔ {r.destination})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-secondary">
                <button
                  type="button"
                  onClick={() => setShowAddBusModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl shadow-sm"
                >
                  Save Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT BUS ================= */}
      {editingBus && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-brand-primary shadow-elevated animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary">
              <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-brand-accent" />
                <span>Edit Bus #{editingBus.id}</span>
              </h3>
              <button onClick={() => setEditingBus(null)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateBus} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Bus Number</label>
                <input
                  type="text"
                  required
                  value={editBusNumber}
                  onChange={(e) => setEditBusNumber(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Bus Name</label>
                <input
                  type="text"
                  required
                  value={editBusName}
                  onChange={(e) => setEditBusName(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Capacity</label>
                  <input
                    type="number"
                    value={editBusCapacity}
                    onChange={(e) => setEditBusCapacity(Number(e.target.value))}
                    className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Status</label>
                  <select
                    value={editBusStatus}
                    onChange={(e) => setEditBusStatus(e.target.value as any)}
                    className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="running_on_time">Running On Time</option>
                    <option value="approaching_pickup">Approaching Stop</option>
                    <option value="delayed">Delayed</option>
                    <option value="trip_completed">Trip Completed</option>
                    <option value="gps_unavailable">GPS Unavailable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Assign Driver</label>
                <select
                  value={editBusDriverId}
                  onChange={(e) => setEditBusDriverId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value="">-- No Driver Assigned --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Assign Route</label>
                <select
                  value={editBusRouteId}
                  onChange={(e) => setEditBusRouteId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value="">-- No Route Assigned --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.route_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Active State</label>
                <select
                  value={editBusIsActive}
                  onChange={(e) => setEditBusIsActive(Number(e.target.value))}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value={1}>Active (Visible to Students)</option>
                  <option value={0}>Deactivated (Hidden)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-secondary">
                <button
                  type="button"
                  onClick={() => setEditingBus(null)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl shadow-sm"
                >
                  Update Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD DRIVER ================= */}
      {showAddDriverModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-brand-primary shadow-elevated animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary">
              <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-accent" />
                <span>Add New Driver</span>
              </h3>
              <button onClick={() => setShowAddDriverModal(false)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98451 00000"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Employee ID</label>
                <input
                  type="text"
                  placeholder="e.g. DRV-103"
                  value={newDriverEmpId}
                  onChange={(e) => setNewDriverEmpId(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">License Number</label>
                <input
                  type="text"
                  placeholder="e.g. KA-47-2020-00123"
                  value={newDriverLicense}
                  onChange={(e) => setNewDriverLicense(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Assign to Bus</label>
                <select
                  value={newDriverAssignedBusId}
                  onChange={(e) => setNewDriverAssignedBusId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value="">-- No Bus Assigned --</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bus_number} ({b.bus_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-secondary">
                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl shadow-sm"
                >
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT DRIVER ================= */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-brand-primary shadow-elevated animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary">
              <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-brand-accent" />
                <span>Edit Driver: {editingDriver.full_name}</span>
              </h3>
              <button onClick={() => setEditingDriver(null)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateDriver} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={editDriverName}
                  onChange={(e) => setEditDriverName(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={editDriverPhone}
                  onChange={(e) => setEditDriverPhone(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Employee ID</label>
                <input
                  type="text"
                  value={editDriverEmpId}
                  onChange={(e) => setEditDriverEmpId(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">License Number</label>
                <input
                  type="text"
                  value={editDriverLicense}
                  onChange={(e) => setEditDriverLicense(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Assign Bus</label>
                <select
                  value={editDriverAssignedBusId}
                  onChange={(e) => setEditDriverAssignedBusId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value="">-- No Bus Assigned --</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bus_number} ({b.bus_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Status</label>
                <select
                  value={editDriverStatus}
                  onChange={(e) => setEditDriverStatus(e.target.value as any)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                >
                  <option value="active">Active</option>
                  <option value="on_duty">On Duty</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-secondary">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl shadow-sm"
                >
                  Update Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD PICKUP POINT ================= */}
      {showAddStopModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 border border-brand-primary shadow-elevated animate-scaleUp my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary flex-shrink-0">
              <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-accent" />
                <span>Add Pickup Point & Exact Map Coordinates</span>
              </h3>
              <button onClick={() => setShowAddStopModal(false)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStop} className="overflow-y-auto pr-1 flex-1 py-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Pickup Point Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bhatkal Main Bus Stand"
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  className="w-full p-2.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-bold text-brand-navy"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">
                  Select Exact Location on Map (Search or Click & Drag Pin)
                </label>
                <MapLocationPicker
                  latitude={parseFloat(newStopLat) || 14.04}
                  longitude={parseFloat(newStopLng) || 74.52}
                  address={newStopAddress}
                  onChange={(lat, lng, addr) => {
                    setNewStopLat(lat.toString());
                    setNewStopLng(lng.toString());
                    if (addr) setNewStopAddress(addr);
                  }}
                  className="h-[210px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Latitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newStopLat}
                    onChange={(e) => setNewStopLat(e.target.value)}
                    className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Longitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newStopLng}
                    onChange={(e) => setNewStopLng(e.target.value)}
                    className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Landmark / Proximity Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Near Shamsuddin Circle, NH 66"
                  value={newStopLandmark}
                  onChange={(e) => setNewStopLandmark(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              {newStopAddress && (
                <div className="p-2.5 bg-brand-cream/50 border border-brand-primary/40 rounded-xl text-[11px] text-brand-navy">
                  <span className="font-bold text-brand-accent block mb-0.5">Address:</span>
                  <span>📍 {newStopAddress}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-secondary">
                <button
                  type="button"
                  onClick={() => setShowAddStopModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl shadow-sm transition-colors"
                >
                  Save Pickup Point
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / RENAME PICKUP POINT ================= */}
      {editingStop && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 border border-brand-primary shadow-elevated animate-scaleUp my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary flex-shrink-0">
              <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-brand-accent" />
                <span>Edit Pickup Point #{editingStop.id}</span>
              </h3>
              <button onClick={() => setEditingStop(null)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStop} className="overflow-y-auto pr-1 flex-1 py-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">
                  Pickup Point Name (Rename)
                </label>
                <input
                  type="text"
                  required
                  value={editStopName}
                  onChange={(e) => setEditStopName(e.target.value)}
                  placeholder="e.g. Bhatkal Main Bus Stand"
                  className="w-full p-2.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-bold text-brand-navy"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">
                  Adjust Exact Location on Map (Search or Click & Drag Pin)
                </label>
                <MapLocationPicker
                  latitude={parseFloat(editStopLat) || editingStop.latitude}
                  longitude={parseFloat(editStopLng) || editingStop.longitude}
                  address={editStopAddress}
                  onChange={(lat, lng, addr) => {
                    setEditStopLat(lat.toString());
                    setEditStopLng(lng.toString());
                    if (addr) setEditStopAddress(addr);
                  }}
                  className="h-[210px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Latitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editStopLat}
                    onChange={(e) => setEditStopLat(e.target.value)}
                    className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Longitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editStopLng}
                    onChange={(e) => setEditStopLng(e.target.value)}
                    className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Landmark</label>
                <input
                  type="text"
                  value={editStopLandmark}
                  onChange={(e) => setEditStopLandmark(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              {editStopAddress && (
                <div className="p-2.5 bg-brand-cream/50 border border-brand-primary/40 rounded-xl text-[11px] text-brand-navy">
                  <span className="font-bold text-brand-accent block mb-0.5">Address:</span>
                  <span>📍 {editStopAddress}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-secondary">
                <button
                  type="button"
                  onClick={() => setEditingStop(null)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl shadow-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: INTERACTIVE ROUTE BUILDER ================= */}
      {showRouteBuilder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 border border-brand-primary shadow-elevated animate-scaleUp my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary flex-shrink-0">
              <div>
                <h3 className="font-bold text-brand-navy text-lg flex items-center gap-2">
                  <RouteIcon className="w-5 h-5 text-brand-accent" />
                  <span>{builderRouteId ? `Edit Route #${builderRouteId}` : 'Interactive Route Builder'}</span>
                </h3>
                <p className="text-xs text-brand-gray">
                  Customize the route path, reorder stops with Move Up/Down, and define scheduled arrival times.
                </p>
              </div>
              <button onClick={() => setShowRouteBuilder(false)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 py-4 space-y-6">
              {/* Route General Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Route Name</label>
                  <input
                    type="text"
                    required
                    value={builderRouteName}
                    onChange={(e) => setBuilderRouteName(e.target.value)}
                    placeholder="e.g. Murdeshwar – Shirali – College"
                    className="w-full p-2.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl font-bold text-brand-navy"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Starting Point</label>
                  <input
                    type="text"
                    value={builderStartPoint}
                    onChange={(e) => setBuilderStartPoint(e.target.value)}
                    placeholder="e.g. Murdeshwar Bus Stand"
                    className="w-full p-2.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Final Destination</label>
                  <input
                    type="text"
                    value={builderDestination}
                    onChange={(e) => setBuilderDestination(e.target.value)}
                    placeholder="e.g. College Main Gate"
                    className="w-full p-2.5 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                  />
                </div>
              </div>

              {/* Add Stop Controls */}
              <div className="p-4 bg-brand-cream/50 border border-brand-primary/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">
                    Select Pickup Stop to Add:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAddStopId}
                      onChange={(e) => setSelectedAddStopId(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1 p-2 text-xs bg-white border border-brand-primary/60 rounded-xl"
                    >
                      <option value="">-- Choose from Master Pickup Points --</option>
                      {pickupPoints.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.landmark ? `(${p.landmark})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddStopToBuilder}
                      disabled={!selectedAddStopId}
                      className="px-3.5 py-2 bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      + Add Stop to Route
                    </button>
                  </div>
                </div>
              </div>

              {/* Ordered Stops Sequence Table with Move Up / Move Down */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider">
                    Sequential Stops Along Route ({builderStops.length} stops in order)
                  </h4>
                  <span className="text-[10px] text-brand-gray">
                    Use ↑ and ↓ buttons to arrange the precise transit sequence
                  </span>
                </div>

                <div className="border border-brand-secondary rounded-2xl overflow-hidden shadow-subtle">
                  <table className="w-full text-left text-xs text-brand-navy">
                    <thead className="bg-brand-secondary/60 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3 w-14 text-center">Seq</th>
                        <th className="p-3">Stop Name</th>
                        <th className="p-3">Arrival Time</th>
                        <th className="p-3">Departure Time</th>
                        <th className="p-3">Distance (km)</th>
                        <th className="p-3 text-center">Reorder Sequence</th>
                        <th className="p-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {builderStops.map((stop, idx) => (
                        <tr key={`${stop.pickup_point_id}-${idx}`} className="hover:bg-brand-cream/30">
                          <td className="p-3 text-center font-bold text-brand-accent">
                            #{idx + 1}
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-brand-navy">{stop.stop_name}</p>
                            <p className="text-[10px] text-brand-gray truncate max-w-xs">{stop.landmark}</p>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={stop.scheduled_arrival_time}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBuilderStops((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, scheduled_arrival_time: val } : s))
                                );
                              }}
                              className="w-24 p-1 text-xs border border-brand-primary/40 rounded font-mono"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={stop.scheduled_departure_time}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBuilderStops((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, scheduled_departure_time: val } : s))
                                );
                              }}
                              className="w-24 p-1 text-xs border border-brand-primary/40 rounded font-mono"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              step="0.1"
                              value={stop.distance_from_prev_km}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setBuilderStops((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, distance_from_prev_km: val } : s))
                                );
                              }}
                              className="w-16 p-1 text-xs border border-brand-primary/40 rounded font-mono"
                            />
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveStopUp(idx)}
                              className="p-1 rounded bg-brand-secondary/60 hover:bg-brand-primary text-brand-navy mr-1 disabled:opacity-30 disabled:pointer-events-none"
                              title="Move Up in Sequence"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === builderStops.length - 1}
                              onClick={() => handleMoveStopDown(idx)}
                              className="p-1 rounded bg-brand-secondary/60 hover:bg-brand-primary text-brand-navy disabled:opacity-30 disabled:pointer-events-none"
                              title="Move Down in Sequence"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveBuilderStop(idx)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Remove Stop"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {builderStops.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-brand-gray italic">
                            No stops added yet. Choose a pickup stop above and click "+ Add Stop to Route".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Interactive Route Polyline Map Preview */}
              {previewSyntheticRoute && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider flex items-center gap-2">
                      <RouteIcon className="w-4 h-4 text-brand-accent" />
                      <span>Road Network Route Preview ({builderDistanceKm} km • ~{builderDurationMins} mins)</span>
                    </h4>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Real Road Network (OSRM Engine)
                    </span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-brand-primary/50 shadow-card">
                    <LiveBusMap
                      bus={null}
                      route={previewSyntheticRoute}
                      className="h-[300px]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Builder Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-brand-secondary flex-shrink-0">
              <span className="text-xs text-brand-gray">
                Total Sequence: <strong>{builderStops.length} stops</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRouteBuilder(false)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoute}
                  className="px-5 py-2.5 bg-brand-navy hover:bg-brand-navy/90 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {builderRouteId ? 'Update & Save Route' : 'Create & Publish Route'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: REVIEW COMPLAINT ================= */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-brand-primary shadow-elevated animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary">
              <div>
                <span className="text-[10px] font-bold text-brand-accent uppercase font-mono">
                  {selectedComplaint.reference_no}
                </span>
                <h3 className="font-bold text-brand-navy text-base">Student Incident Review</h3>
              </div>
              <button onClick={() => setSelectedComplaint(null)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 bg-brand-cream/50 rounded-xl space-y-1">
                <p>
                  <strong>Student:</strong> {selectedComplaint.student_name} ({selectedComplaint.student_id})
                </p>
                <p>
                  <strong>Contact:</strong> {selectedComplaint.phone} • {selectedComplaint.email}
                </p>
                <p>
                  <strong>Bus & Route:</strong> {selectedComplaint.bus_number} • {selectedComplaint.route_name}
                </p>
                <p>
                  <strong>Incident Date:</strong> {selectedComplaint.date_of_incident}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Complaint Description</label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-brand-navy text-xs leading-relaxed">
                  {selectedComplaint.description}
                </div>
              </div>

              <form onSubmit={handleUpdateComplaint} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Update Status</label>
                  <select
                    value={complaintStatusInput}
                    onChange={(e) => setComplaintStatusInput(e.target.value as any)}
                    className="w-full p-2 bg-brand-cream/50 border border-brand-primary/60 rounded-xl text-xs font-bold text-brand-navy"
                  >
                    <option value="New">New</option>
                    <option value="Under Review">Under Review</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">
                    Resolution / Investigation Notes
                  </label>
                  <textarea
                    rows={3}
                    value={complaintNotesInput}
                    onChange={(e) => setComplaintNotesInput(e.target.value)}
                    placeholder="Enter resolution actions taken with driver or route dispatcher..."
                    className="w-full p-2 bg-brand-cream/50 border border-brand-primary/60 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-secondary">
                  <button
                    type="button"
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2 text-xs font-semibold text-brand-gray"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-brand-navy hover:bg-brand-navy/90 text-white rounded-xl shadow-sm"
                  >
                    Update & Notify Student
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: BROADCAST ALERT ================= */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-brand-primary shadow-elevated animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary">
              <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                <Radio className="w-5 h-5 text-brand-accent" />
                <span>Quick Transit Broadcast</span>
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-brand-gray hover:text-brand-navy">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Alert Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15-Minute Highway Delay"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase">Message Details</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Notification content delivered to all students..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full p-2 text-xs bg-brand-cream/50 border border-brand-primary/60 rounded-xl"
                />
              </div>

              {broadcastResult && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-xl border border-emerald-200">
                  {broadcastResult}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-secondary">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-brand-gray"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-navy hover:bg-brand-navy/90 text-white rounded-xl shadow-sm"
                >
                  Send Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TRIP STOP EVENTS TIMELINE ================= */}
      {selectedTripForEvents && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-brand-primary shadow-elevated animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-brand-secondary">
              <div>
                <h3 className="font-bold text-brand-navy text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-accent" />
                  <span>Trip #{selectedTripForEvents.id} Stop Arrival Timeline</span>
                </h3>
                <p className="text-xs text-brand-gray mt-0.5">
                  {selectedTripForEvents.bus_number || `Bus #${selectedTripForEvents.bus_id}`} • {selectedTripForEvents.route_name} • {selectedTripForEvents.trip_date}
                </p>
              </div>
              <button
                onClick={() => setSelectedTripForEvents(null)}
                className="text-brand-gray hover:text-brand-navy p-1 rounded-lg hover:bg-brand-cream transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedTripForEvents.route_snapshot && (
              <div className="mt-3 p-2.5 rounded-xl bg-brand-cream/60 border border-brand-secondary text-xs text-brand-navy flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-accent shrink-0" />
                <span>
                  <strong>Route Snapshot:</strong> Version {selectedTripForEvents.route_snapshot.route_version || 1} preserved with {selectedTripForEvents.route_snapshot.stops?.length || 0} stops.
                </span>
              </div>
            )}

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {loadingStopEvents ? (
                <div className="p-8 text-center text-xs text-brand-gray">
                  <RefreshCw className="w-6 h-6 text-brand-accent animate-spin mx-auto mb-2" />
                  Loading stop geofence events...
                </div>
              ) : tripStopEvents.length === 0 ? (
                <div className="p-8 text-center bg-brand-cream/30 rounded-2xl border border-dashed border-brand-secondary">
                  <MapPin className="w-8 h-8 text-brand-gray mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-brand-navy">No Stop Events Logged Yet</p>
                  <p className="text-[11px] text-brand-gray mt-1 max-w-sm mx-auto">
                    Events are generated automatically in real time when the driver device comes within 200m of each pickup point.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-brand-secondary">
                    <table className="w-full text-left text-xs text-brand-navy">
                      <thead className="bg-brand-secondary/60 uppercase font-bold text-[10px]">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Stop Name & Landmark</th>
                          <th className="p-2.5">Scheduled</th>
                          <th className="p-2.5">Actual Arrival</th>
                          <th className="p-2.5">Actual Departure</th>
                          <th className="p-2.5">Variance</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tripStopEvents.map((evt, idx) => (
                          <tr key={evt.id || idx} className="hover:bg-brand-cream/30 transition-colors">
                            <td className="p-2.5 font-bold font-mono text-brand-gray">{idx + 1}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-brand-navy">{evt.stop_name}</div>
                              {evt.landmark && <div className="text-[10px] text-brand-gray">{evt.landmark}</div>}
                            </td>
                            <td className="p-2.5 font-mono text-[11px]">
                              {evt.scheduled_time || 'N/A'}
                            </td>
                            <td className="p-2.5 font-mono text-[11px]">
                              {evt.actual_arrival_time
                                ? new Date(evt.actual_arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : <span className="text-brand-gray italic">Pending</span>}
                            </td>
                            <td className="p-2.5 font-mono text-[11px]">
                              {evt.actual_departure_time
                                ? new Date(evt.actual_departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : <span className="text-brand-gray italic">-</span>}
                            </td>
                            <td className="p-2.5 font-mono">
                              {evt.delay_minutes > 0 ? (
                                <span className="text-amber-700 font-bold">+{evt.delay_minutes}m late</span>
                              ) : evt.delay_minutes < 0 ? (
                                <span className="text-blue-700 font-bold">{evt.delay_minutes}m early</span>
                              ) : evt.actual_arrival_time ? (
                                <span className="text-emerald-700 font-bold">On time</span>
                              ) : (
                                <span className="text-brand-gray">-</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  evt.status === 'arrived'
                                    ? 'bg-amber-100 text-amber-800'
                                    : evt.status === 'departed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {evt.status || 'scheduled'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-brand-secondary flex items-center justify-end">
              <button
                onClick={() => setSelectedTripForEvents(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-brand-navy bg-brand-cream hover:bg-brand-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= REUSABLE CONFIRMATION MODAL ================= */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-brand-primary shadow-elevated animate-scaleUp text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-extrabold text-brand-navy">{confirmModal.title}</h4>
            <p className="text-xs text-brand-gray mt-2 leading-relaxed">{confirmModal.message}</p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-brand-gray bg-brand-cream hover:bg-brand-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const act = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await act();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
