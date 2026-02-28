import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { ArrowLeft, MapPin as MapPinFilled, Plus, X, Car, Bike, Star, Phone, MessageSquare, Navigation, Info, Locate, User, Trash, Loader2 } from 'lucide-react';
import { Theme, Screen, RideStatus, Activity, UserData, AppSettings } from '../types';
import { triggerHaptic, sendPushNotification } from '../utils/helpers';

import { CONFIG } from '../config';
import { supabase } from '../supabaseClient';
import { darkMapStyle } from '../utils/mapStyles'; // Ensure this exists or is handled
import { RideMap } from '../components/Ride/RideMap';
import { RideBookingForm } from '../components/Ride/RideBookingForm';
import { RideStatusPanel } from '../components/Ride/RideStatusPanel';
import { RideCancellationSummary } from '../components/Ride/RideCancellationSummary';
import { RidePaymentSummary } from '../components/Ride/RidePaymentSummary';
import { LocationSearchOverlay } from '../components/Ride/LocationSearchOverlay';
interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    goBack: () => void;
    setRecentActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
    user: UserData;
    prefilledDestination?: string | null;
    prefilledTier?: string | null;
    prefilledDistance?: number | null;
    clearPrefilled?: () => void;
    active?: boolean;
    handleScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    settings: AppSettings;
    showAlert: (
        title: string,
        message: string,
        type?: 'success' | 'error' | 'info',
        onConfirm?: () => void,
        showCancel?: boolean,
        confirmText?: string,
        cancelText?: string,
        onCancel?: () => void
    ) => void;
    onSearchingChange?: (searching: boolean) => void;
    indexLocation?: { lat: number, lng: number } | null;
}

export const RideScreen = ({ theme, navigate, goBack, setRecentActivities, user, prefilledDestination, prefilledTier, prefilledDistance, clearPrefilled, active, handleScroll, settings, showAlert, onSearchingChange, indexLocation }: Props) => {
    const [status, setStatus] = useState<RideStatus>('idle');

    useEffect(() => {
        if (onSearchingChange) {
            onSearchingChange(status === 'searching');
        }
    }, [status]);
    const [rideType, setRideType] = useState<'ride' | 'delivery'>('ride');
    const [destinations, setDestinations] = useState<string[]>(['']);
    const [selectedTier, setSelectedTier] = useState('eco');
    const [ridePayMethod, setRidePayMethod] = useState<'cash' | 'wave'>('wave');
    const [etaSeconds, setEtaSeconds] = useState(300);
    const [rating, setRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [bookingStep, setBookingStep] = useState<'planning' | 'selecting'>('planning');
    const mapPinsRef = useRef<{ x: number, y: number, label?: string }[]>([]);
    const mapInteractionRef = useRef(false);
    const initialCenterDoneRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [showPaymentSummary, setShowPaymentSummary] = useState(false);
    const [showCancellationSummary, setShowCancellationSummary] = useState(false);
    const [showSearchOverlay, setShowSearchOverlay] = useState(false);
    const [isMinimalRating, setIsMinimalRating] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [assignedDriverId, setAssignedDriverId] = useState<string | null>(null);
    const [assignedDriver, setAssignedDriver] = useState<any>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [locationMethod, setLocationMethod] = useState<'gps' | 'profile' | null>(null);
    const [currentRideId, setCurrentRideId] = useState<string | null>(null);

    // Tiers Definition
    const tiers = [
        { id: 'eco', label: 'Economy', mult: Number(settings.multiplier_economy) || 1, time: '3 min', icon: Car, img: '/assets/white_yaris_side.png', desc: '4 seats' },
        { id: 'prem', label: 'AC', mult: Number(settings.multiplier_premium) || 1.8, time: '5 min', icon: Car, img: '/assets/black_luxury_side.png', desc: 'Premium • 4 seats' },
        { id: 'moto', label: 'Bike', mult: Number(settings.multiplier_scooter) || 0.6, time: '2 min', icon: Bike, img: '/assets/scooter_side_view.png', desc: 'Fast • 1 seat' }
    ];

    // Animation States
    const [driverPos, setDriverPos] = useState({ x: 80, y: 10 });
    const animationRef = useRef<number | null>(null);

    // --- GOOGLE MAPS REFS ---
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
    const [directionsService, setDirectionsService] = useState<any>(null);
    const [autocompleteService, setAutocompleteService] = useState<any>(null);
    const [geocoder, setGeocoder] = useState<any>(null);
    const sessionToken = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const driverMarkersRef = useRef<Map<string, any>>(new Map());
    const [predictions, setPredictions] = useState<any[]>([]);
    const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [destinationCoords, setDestinationCoords] = useState<({ lat: number, lng: number } | null)[]>([null]);
    const [realDistanceKm, setRealDistanceKm] = useState<number>(prefilledDistance || 0);
    const [searchRadius, setSearchRadius] = useState(5);
    const searchIntervalRef = useRef<any>(null);
    const notifiedDriversRef = useRef<Set<string>>(new Set());

    // Drag Sheet State
    const PEEK_OFFSET = 320; // Reduced from 460 to ensure visibility
    const [sheetOffset, setSheetOffset] = useState(0); // Expanded by default
    const [isSheetMinimized, setIsSheetMinimized] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const sheetStartY = useRef(0);
    const sheetCurrentY = useRef(0);

    const userMarkerRef = useRef<any>(null);

    const updateMarker = (pos: { lat: number, lng: number }, label?: string, targetMapInstance?: any) => {
        const activeMap = targetMapInstance || map;
        if (!activeMap) return;
        const google = (window as any).google;
        if (!google) return;

        const avatarUrlStr = user?.photo;

        let currentIcon: any = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#00D68F',
            fillOpacity: 1,
            strokeWeight: 4,
            strokeColor: 'white'
        };

        if (userMarkerRef.current && userMarkerRef.current.getIcon()?.url?.startsWith('data:image/png')) {
            currentIcon = userMarkerRef.current.getIcon();
        }

        if (userMarkerRef.current) {
            userMarkerRef.current.setPosition(pos);
            // GUARANTEE MARKER VISIBILITY by always re-applying it to the active map
            userMarkerRef.current.setMap(activeMap);
            userMarkerRef.current.setVisible(true);

            if (userMarkerRef.current.getIcon() !== currentIcon) {
                userMarkerRef.current.setIcon(currentIcon);
            }
        } else {
            userMarkerRef.current = new google.maps.Marker({
                position: pos,
                map: activeMap,
                title: label || user.name || 'You',
                icon: currentIcon,
                zIndex: 100,
                optimized: false
            });
        }

        // Asynchronously load and set the custom avatar canvas
        if (avatarUrlStr && (!userMarkerRef.current.getIcon()?.url?.startsWith('data:image/png'))) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 64;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Draw outer border (Brand color or White)
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();

                // Draw image cropped to inner circle
                ctx.save();
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, (size / 2) - 4, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, 0, 0, size, size);
                ctx.restore();

                // Draw brand color stroke ring inside
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, (size / 2) - 4, 0, Math.PI * 2);
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#00D68F';
                ctx.stroke();

                const dataUrl = canvas.toDataURL('image/png');
                if (userMarkerRef.current) {
                    userMarkerRef.current.setIcon({
                        url: dataUrl,
                        scaledSize: new google.maps.Size(48, 48),
                        anchor: new google.maps.Point(24, 24)
                    });
                }
            };
            img.onerror = () => {
                console.warn('Failed to load avatar for map marker, using fallback.');
            };
            img.src = avatarUrlStr;
        }
    };

    const handleLocateMe = async (isInitial = false, manualMap?: any) => {
        const targetMap = manualMap || map;
        setIsLocating(true);
        setLocationMethod(null);
        console.log("RideScreen: handleLocateMe triggered", { isInitial, hasMap: !!targetMap });

        let fallbackApplied = false;
        const fallbackTimeout = setTimeout(() => {
            if (!userLocation && user.last_lat && user.last_lng) {
                console.log("RideScreen: GPS slow, applying profile database fallback as interim center...");
                const pos = { lat: user.last_lat, lng: user.last_lng };
                setUserLocation(pos);
                setLocationMethod('profile');
                if (targetMap) {
                    targetMap.panTo(pos);
                    updateMarker(pos, undefined, targetMap);
                }
                fallbackApplied = true;
            }
        }, 4000);

        try {
            if (Capacitor.isNativePlatform()) {
                const permissions = await Geolocation.checkPermissions();
                if (permissions.location === 'prompt' || permissions.location === 'prompt-with-rationale') {
                    await Geolocation.requestPermissions();
                }
            }

            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            });

            clearTimeout(fallbackTimeout);
            const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
            console.log("RideScreen: Real GPS success:", pos);
            setUserLocation(pos);
            setLocationMethod('gps');
            setIsLocating(false);

            supabase.from('profiles').update({
                last_lat: pos.lat,
                last_lng: pos.lng
            }).eq('id', user.id).then(({ error }) => {
                if (error) console.error("Error persisting location:", error);
            });

            if (targetMap) {
                targetMap.panTo(pos);
                if (isInitial) targetMap.setZoom(14);
                updateMarker(pos, undefined, targetMap);
            }
            if (!isInitial) triggerHaptic();
        } catch (err) {
            clearTimeout(fallbackTimeout);
            console.error("RideScreen: Geolocation error:", err);
            setIsLocating(false);
            if (!isInitial && !fallbackApplied) {
                showAlert("Geolocation Error", "Could not get your current location.", "error");
            }
        }
    };

    // Initialize Map
    useEffect(() => {
        const initMap = () => {
            if (!mapContainerRef.current || !(window as any).google) return;
            const google = (window as any).google;
            const defaultCenter = { lat: 13.4432, lng: -16.5916 };
            const targetCenter = userLocation || (user.last_lat && user.last_lng ? { lat: user.last_lat, lng: user.last_lng } : defaultCenter);

            const newMap = new google.maps.Map(mapContainerRef.current, {
                center: targetCenter,
                zoom: 13,
                disableDefaultUI: true,
                clickableIcons: false,
                gestureHandling: 'greedy',
                styles: theme === 'dark' ? darkMapStyle : []
            });

            newMap.addListener('dragstart', () => {
                mapInteractionRef.current = true;
            });

            setMap(newMap);
            initialCenterDoneRef.current = true;
            updateMarker(targetCenter, user.name || 'You', newMap);

            const directionsRenderer = new google.maps.DirectionsRenderer({
                map: newMap,
                suppressMarkers: true,
                polylineOptions: {
                    strokeColor: '#00D68F',
                    strokeWeight: 5,
                    strokeOpacity: 0.8
                }
            });

            setDirectionsRenderer(directionsRenderer);
            setDirectionsService(new google.maps.DirectionsService());
            setAutocompleteService(new google.maps.places.AutocompleteService());
            setGeocoder(new google.maps.Geocoder());
        };

        if ((window as any).google && mapContainerRef.current) {
            initMap();
        } else {
            const checkInterval = setInterval(() => {
                if ((window as any).google && mapContainerRef.current) {
                    initMap();
                    clearInterval(checkInterval);
                }
            }, 100);
            return () => clearInterval(checkInterval);
        }
    }, [active]);

    // Re-center Map when screen becomes active
    useEffect(() => {
        if (active && map) {
            if (indexLocation) {
                console.log("RideScreen: Using proactive indexLocation:", indexLocation);
                setUserLocation(indexLocation);
                setLocationMethod('gps');
                map.panTo(indexLocation);
                updateMarker(indexLocation, undefined, map);

                // Force a second update verify to ensure pin is visible
                setTimeout(() => updateMarker(indexLocation, undefined, map), 500);
            } else if (!userLocation) {
                console.log("RideScreen: Screen active, no indexLocation, triggering auto-locate in 60s");
                const delayTimer = setTimeout(() => {
                    handleLocateMe(true);
                }, 60000); // Wait 60 seconds
                return () => clearTimeout(delayTimer);
            }
        }
    }, [active, !!map, indexLocation]);

    // Initial Location Capture once Map is ready
    // Removed duplicate useEffect, centering is handled in initMap

    // Theme-aware Map Styles linked in RideMap, but keeping effect here if map instance is managed here

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (status === 'searching') {
                handleCancelRide();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [status]);

    // Restore Active Ride on Mount
    useEffect(() => {
        const restoreActiveRide = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 0. CLEANUP: If there are any previous searching rides, clear them out
            // The user wants searching to "stop as soon as the app is reloaded"
            const { data: staleSearches } = await supabase
                .from('rides')
                .select('*')
                .eq('customer_id', session.user.id) // FIXED: use session.user.id
                .eq('status', 'searching')
                .limit(10); // Find any lingering searches

            if (staleSearches && staleSearches.length > 0) {
                console.log("Cleaning up stale searches on launch:", staleSearches.length);
                const staleIds = staleSearches.map(s => s.id);
                await supabase
                    .from('rides')
                    .update({ status: 'cancelled' })
                    .in('id', staleIds);
            }

            // 1. Restore only actual active bookings
            const { data: activeRide, error } = await supabase
                .from('rides')
                .select('*')
                .eq('customer_id', session.user.id)
                .in('status', ['accepted', 'arrived', 'in-progress']) // EXCLUDED 'searching'
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (activeRide && !error) {
                console.log("Found active ride, restoring state:", activeRide);

                // Restore destinations for UI
                setDestinations([activeRide.dropoff_address]);
                setRealDistanceKm(activeRide.distance_km || 0);

                // Resume tracking
                handleBookRide(activeRide.id);

                // Force navigation to Ride screen
                if (navigate) {
                    navigate('ride');
                }
            }
        };

        if (map) {
            restoreActiveRide();
        }
    }, [map]);

    // Handle Prefilled Destination & Tier from Dashboard
    useEffect(() => {
        if (prefilledDestination && map && directionsRenderer) {
            console.log("Applying prefilled destination:", prefilledDestination);
            setBookingStep('selecting');

            if (prefilledTier) {
                console.log("Applying prefilled tier:", prefilledTier);
                setSelectedTier(prefilledTier);
            }
            if (prefilledDistance) {
                console.log("Applying prefilled distance:", prefilledDistance, "km (using cached value)");
                setRealDistanceKm(prefilledDistance);
            }

            updateDestination(0, prefilledDestination);

            // Geocode and show route immediately
            const geocoder = new (window as any).google.maps.Geocoder();
            geocoder.geocode({ address: prefilledDestination }, (results: any, status: string) => {
                if (status === 'OK' && results[0]) {
                    const loc = results[0].geometry.location;
                    map.panTo(loc);

                    const marker = new (window as any).google.maps.Marker({
                        position: loc,
                        map: map,
                        label: '1'
                    });

                    if (markersRef.current[0]) {
                        markersRef.current[0].setMap(null);
                    }
                    markersRef.current = [marker];

                    // Save coordinate for booking
                    setDestinationCoords([{ lat: loc.lat(), lng: loc.lng() }]);

                    // If we have prefilled distance, just draw the route visually
                    if (prefilledDistance) {
                        const directionsService = new (window as any).google.maps.DirectionsService();
                        directionsService.route({
                            origin: userLocation || { lat: 13.4432, lng: -16.5916 },
                            destination: loc,
                            travelMode: (window as any).google.maps.TravelMode.DRIVING
                        }, (result: any, routeStatus: string) => {
                            if (routeStatus === 'OK') {
                                directionsRenderer.setDirections(result);

                                // Update coords from route legs for accuracy
                                const route = result.routes[0];
                                if (route && route.legs) {
                                    const newCoords = [{ lat: route.legs[0].end_location.lat(), lng: route.legs[0].end_location.lng() }];
                                    setDestinationCoords(newCoords);
                                }
                            }
                        });
                    } else {
                        calculateRouteAndPrice();
                    }

                    if (clearPrefilled) clearPrefilled();
                }
            });
        }
    }, [prefilledDestination, prefilledTier, map, directionsRenderer]);

    // Re-center Map when screen becomes active
    useEffect(() => {
        if (active && map && userLocation && !mapInteractionRef.current) {
            console.log("Ride screen active, initial re-centering map...");
            map.panTo(userLocation);
            // We only auto-pan once or until the user interacts
        }
    }, [active, map, !!userLocation]); // Re-center when location first arrives

    // --- REAL-TIME DRIVER TRACKING ---
    useEffect(() => {
        if (!map) return;

        const getVehicleIcon = (vType: string) => {
            const iconRoot = 'assets/drivers%20vehicle%20types/';
            let iconName = 'car_economic_3d_backup.png';

            if (vType === 'premium') iconName = 'car_premium_3d_backup.png';
            if (vType === 'scooter') iconName = 'car_scooter_3d_backup.png';

            return {
                url: iconRoot + iconName,
                scaledSize: new (window as any).google.maps.Size(48, 48),
                anchor: new (window as any).google.maps.Point(24, 24),
                optimized: false
            };
        };

        const refreshMarkers = (drivers: any[]) => {
            const markersMap = driverMarkersRef.current;
            const isRequestActive = ['accepted', 'arrived', 'in-progress'].includes(status);

            drivers.forEach(d => {
                const position = { lat: d.current_lat, lng: d.current_lng };
                let marker = markersMap.get(d.id);

                if (marker) {
                    marker.setPosition(position);
                    marker.setVisible(!isRequestActive || d.id === assignedDriverId);
                    marker.setMap(map);
                } else {
                    const icon = getVehicleIcon(d.vehicle_category || 'economic');
                    marker = new (window as any).google.maps.Marker({
                        position,
                        map: map,
                        icon,
                        title: `Driver ${d.id}`,
                        optimized: false,
                        visible: !isRequestActive || d.id === assignedDriverId
                    });
                    markersMap.set(d.id, marker);
                }

                // ETA Logic for assigned driver
                if (d.id === assignedDriverId && userLocation) {
                    setAssignedDriver(d);
                    const service = new (window as any).google.maps.DistanceMatrixService();
                    service.getDistanceMatrix({
                        origins: [position],
                        destinations: [userLocation],
                        travelMode: (window as any).google.maps.TravelMode.DRIVING,
                    }, (response: any, status: string) => {
                        if (status === 'OK' && response.rows[0].elements[0].duration) {
                            setEtaSeconds(response.rows[0].elements[0].duration.value);
                        }
                    });
                }
            });

            // Cleanup offline drivers
            const currentIds = new Set(drivers.map(d => d.id));
            markersMap.forEach((m, id) => {
                if (!currentIds.has(id)) {
                    m.setMap(null);
                    markersMap.delete(id);
                }
            });
        };

        const fetchDrivers = async () => {
            const { data } = await supabase.from('drivers').select('*').eq('is_online', true);
            if (data) refreshMarkers(data);
        };

        fetchDrivers();

        const channel = supabase
            .channel('driver-locations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, async (payload) => {
                fetchDrivers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [map, status, assignedDriverId]);

    const calculateProximity = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const sendPush = (title: string, message: string) => {
        sendPushNotification(title, message);
    };

    // Handle Driver Visibility based on Status
    // Removed redundant useEffect, handled in stable effect above

    // Simulated driver movement for dummy data demonstration
    useEffect(() => {
        if (status !== 'accepted' || !assignedDriverId || !userLocation) return;

        console.log("Starting driver movement simulation...");
        const simulationInterval = setInterval(async () => {
            const { data: driver, error } = await supabase
                .from('drivers')
                .select('current_lat, current_lng')
                .eq('id', assignedDriverId)
                .single();

            if (driver && !error) {
                const latDiff = userLocation.lat - driver.current_lat;
                const lngDiff = userLocation.lng - driver.current_lng;

                // Step size roughly 100 meters per 3 seconds
                const step = 0.0008;
                const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

                if (distance > 0.0001) { // Stop when very very close
                    const newLat = driver.current_lat + (latDiff / distance) * Math.min(step, distance);
                    const newLng = driver.current_lng + (lngDiff / distance) * Math.min(step, distance);

                    console.log(`Simulating movement for driver ${assignedDriverId} to ${newLat}, ${newLng}`);
                    await supabase
                        .from('drivers')
                        .update({
                            current_lat: newLat,
                            current_lng: newLng
                        })
                        .eq('id', assignedDriverId);
                }
            }
        }, 3000);

        return () => {
            console.log("Stopping driver movement simulation.");
            clearInterval(simulationInterval);
        };
    }, [status, assignedDriverId, userLocation]);

    const calculateRouteAndPrice = async (): Promise<boolean> => {
        if (!map || directionsRenderer === null || destinations.every(d => !d)) return false;

        if (prefilledDistance) {
            console.log("Using prefilled distance:", prefilledDistance, "km");
            setRealDistanceKm(prefilledDistance);
            return true;
        }

        const google = (window as any).google;
        const directionsService = new google.maps.DirectionsService();
        const distanceMatrixService = new google.maps.DistanceMatrixService();

        const validDestinations = destinations.filter(d => d.trim() !== '');
        if (validDestinations.length === 0) return false;

        setIsCalculating(true);
        console.log("Requesting Accurate Distance for:", validDestinations);

        // --- DISTANCE CACHING (7 DAYS) ---
        const startAddr = userLocation || { lat: 13.4432, lng: -16.5916 };
        const endAddr = validDestinations[validDestinations.length - 1];

        try {
            // 1. Check Supabase distance_cache first
            // Note: Since we don't have destination coordinates yet, 
            // a full coordinate cache hit is only possible if we geocode first.
            // For now, we rely on the Direction service and save to cache.
            // We'll skip the pre-check to avoid incorrect hits until geocoding is integrated.
        } catch (e) {
            console.error("Supabase Cache Read Error:", e);
        }

        return new Promise(async (resolve) => {
            // Premium 1s Wait Experience (starts anyway)
            const minWait = new Promise(resolve => setTimeout(resolve, 1000));

            const defaultCenter = { lat: user.last_lat || 13.4432, lng: user.last_lng || -16.5916 };
            const request: any = {
                origin: userLocation || defaultCenter,
                destination: validDestinations[validDestinations.length - 1],
                waypoints: validDestinations.length > 1
                    ? validDestinations.slice(0, -1).map(d => ({ location: d, stopover: true }))
                    : [],
                travelMode: google.maps.TravelMode.DRIVING
            };

            // 1. Get Visual Route & Calculate total distance from legs
            directionsService.route(request, async (result: any, status: string) => {
                if (status === 'OK') {
                    directionsRenderer.setDirections(result);

                    // Sum up all legs for sequential multi-stop distance
                    let totalMeters = 0;
                    let totalSeconds = 0;
                    const route = result.routes[0];
                    if (route && route.legs) {
                        const newCoords = [...destinationCoords];
                        route.legs.forEach((leg: any, i: number) => {
                            totalMeters += leg.distance.value;
                            totalSeconds += leg.duration.value;

                            // Save coordinates for each destination/waypoint
                            if (i < newCoords.length) {
                                newCoords[i] = {
                                    lat: leg.end_location.lat(),
                                    lng: leg.end_location.lng()
                                };
                            }
                        });
                        setDestinationCoords(newCoords);
                    }
                    const km = totalMeters / 1000;
                    const mins = totalSeconds / 60;
                    setRealDistanceKm(km);
                    console.log("Verified multi-stop distance:", km, "km");

                    // Save to Supabase Cache
                    try {
                        const leg = route.legs[0];
                        await supabase.from('distance_cache').upsert({
                            origin_lat: parseFloat(leg.start_location.lat().toFixed(4)),
                            origin_lng: parseFloat(leg.start_location.lng().toFixed(4)),
                            dest_lat: parseFloat(leg.end_location.lat().toFixed(4)),
                            dest_lng: parseFloat(leg.end_location.lng().toFixed(4)),
                            distance_km: km,
                            duration_mins: mins
                        }, { onConflict: 'origin_lat, origin_lng, dest_lat, dest_lng' });
                    } catch (e) { }

                    setIsCalculating(false);
                    resolve(true);
                } else {
                    console.error("Route calculation failed:", status);
                    setIsCalculating(false);
                    resolve(false);
                }
            });
        });
    };

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    const updateDestination = (index: number, value: string) => {
        const newDestinations = [...destinations];
        newDestinations[index] = value;
        setDestinations(newDestinations);

        // Clear associated coordinates if the value is cleared
        if (!value.trim()) {
            const newCoords = [...destinationCoords];
            newCoords[index] = null;
            setDestinationCoords(newCoords);

            if (markersRef.current[index]) {
                markersRef.current[index].setMap(null);
                markersRef.current[index] = null;
            }
            if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
            setRealDistanceKm(0);
        }
    };


    const addDestination = () => {
        setDestinations([...destinations, '']);
        setDestinationCoords([...destinationCoords, null]);
    };

    const removeDestination = (index: number) => {
        if (destinations.length > 1) {
            const newDestinations = destinations.filter((_, i) => i !== index);
            setDestinations(newDestinations);
            const newCoords = destinationCoords.filter((_, i) => i !== index);
            setDestinationCoords(newCoords);

            // Manage markers ref
            if (markersRef.current[index]) {
                markersRef.current[index].setMap(null);
            }
            markersRef.current = markersRef.current.filter((_, i) => i !== index);

            // Sync labels
            markersRef.current.forEach((m, i) => {
                if (m && typeof m.setLabel === 'function') {
                    m.setLabel((i + 1).toString());
                }
            });
        } else {
            updateDestination(0, '');
            markersRef.current.forEach(m => m?.setMap(null));
            markersRef.current = [];
        }
    };

    // Map Click Listener
    useEffect(() => {
        if (!map || bookingStep !== 'planning') return;

        const listener = map.addListener('click', (e: any) => {
            if (status === 'searching') return;
            const latLng = e.latLng;
            if (!latLng) return;

            // Geocode the location
            const geocoder = new (window as any).google.maps.Geocoder();
            geocoder.geocode({ location: latLng }, (results: any, status: string) => {
                if (status === 'OK' && results[0]) {
                    const address = results[0].formatted_address;
                    // Update the last empty destination or the last one
                    const idx = destinations.findIndex(d => !d);
                    const targetIdx = idx === -1 ? destinations.length - 1 : idx;

                    updateDestination(targetIdx, address);

                    // Visual pin
                    const marker = new (window as any).google.maps.Marker({
                        position: latLng,
                        map: map,
                        label: (targetIdx + 1).toString(),
                        animation: (window as any).google.maps.Animation.DROP,
                        cursor: 'pointer'
                    });

                    // Remove on click
                    marker.addListener('click', () => {
                        marker.setMap(null);
                        const label = marker.getLabel();
                        const currentIdx = typeof label === 'string' ? parseInt(label) - 1 : targetIdx;
                        updateDestination(currentIdx, '');
                        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
                        triggerHaptic();
                    });

                    if (markersRef.current[targetIdx]) {
                        markersRef.current[targetIdx].setMap(null);
                    }
                    markersRef.current[targetIdx] = marker;

                    // Update coordinates for booking
                    const newCoords = [...destinationCoords];
                    newCoords[targetIdx] = { lat: latLng.lat(), lng: latLng.lng() };
                    setDestinationCoords(newCoords);

                    triggerHaptic();
                }
            });
        });

        return () => {
            (window as any).google.maps.event.removeListener(listener);
        };
    }, [map, bookingStep, destinations, directionsRenderer]);

    const handleSearch = (val: string, index: number) => {
        updateDestination(index, val);
        setActiveInputIndex(index);

        // --- PLUS CODE SUPPORT ---
        // Basic check for Plus Code format (e.g. C8HG+266 or 8FVC+C8)
        const plusCodeRegex = /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,3}/i;
        if (plusCodeRegex.test(val.trim())) {
            const geocoder = new (window as any).google.maps.Geocoder();
            geocoder.geocode({ address: val.trim() }, (results: any, status: string) => {
                if (status === 'OK' && results[0]) {
                    setPredictions([{
                        place_id: results[0].place_id,
                        description: results[0].formatted_address,
                        structured_formatting: {
                            main_text: val.trim(),
                            secondary_text: "Plus Code Location"
                        }
                    }]);
                }
            });
            // Don't return here, let autocomplete run too just in case
        }

        if (!val || val.length < 2) {
            setPredictions([]);
            return;
        }

        if (autocompleteService) {
            // Start session if not exists
            if (!sessionToken.current) {
                const google = (window as any).google;
                if (google) {
                    sessionToken.current = new google.maps.places.AutocompleteSessionToken();
                    console.log("Maps Ride: Started new session");
                }
            }

            autocompleteService.getPlacePredictions({
                input: val,
                sessionToken: sessionToken.current,
                componentRestrictions: { country: 'gm' } // Restrict to Gambia
            }, (results: any) => {
                setPredictions(results || []);
            });
        }
    };

    const selectPrediction = (prediction: any) => {
        if (activeInputIndex === null) return;

        const targetIdx = activeInputIndex;
        updateDestination(targetIdx, prediction.description);
        setPredictions([]);
        setActiveInputIndex(null);

        sessionToken.current = null;

        const geocoder = new (window as any).google.maps.Geocoder();
        // Use placeId for 100% accuracy as requested
        geocoder.geocode({ placeId: prediction.place_id }, (results: any, status: string) => {
            if (status === 'OK' && results[0] && map) {
                const loc = results[0].geometry.location;
                map.panTo(loc);

                if (markersRef.current[targetIdx]) {
                    markersRef.current[targetIdx].setMap(null);
                }

                const marker = new (window as any).google.maps.Marker({
                    position: loc,
                    map: map,
                    label: (targetIdx + 1).toString(),
                    cursor: 'pointer'
                });

                marker.addListener('click', () => {
                    marker.setMap(null);
                    const label = marker.getLabel();
                    const currentIdx = typeof label === 'string' ? parseInt(label) - 1 : targetIdx;
                    updateDestination(currentIdx, '');
                    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
                    triggerHaptic();
                });

                markersRef.current[targetIdx] = marker;

                // Persist coordinates for booking
                const newCoords = [...destinationCoords];
                newCoords[targetIdx] = { lat: loc.lat(), lng: loc.lng() };
                setDestinationCoords(newCoords);
            } else {
                showAlert("Location Error", "We couldn't accurately find this place. Please try another search.", "error");
            }
        });
    };

    const handleNextStep = async () => {
        if (destinations[0]) {
            const success = await calculateRouteAndPrice();
            if (success) {
                setBookingStep('selecting');
                triggerHaptic();
            } else {
                showAlert("Route Error", "Could not calculate route. Please check your addresses.", "error");
            }
        }
    };

    const handleBookRide = async (existingRideId?: string, expandedMaxRadius?: number, startSearchRadius?: number) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            showAlert("Login Required", "Please login to book a ride!", "error");
            return;
        }

        let ride = null;
        if (existingRideId) {
            // Use existing ride record
            const { data } = await supabase.from('rides').select('*').eq('id', existingRideId).single();
            ride = data;

            // Only set status to searching if it's actually searching
            if (ride && ride.status === 'searching') {
                setStatus('searching');
            } else if (ride) {
                setStatus(ride.status as RideStatus);
            }
        } else {
            setStatus('searching');
        }

        const startRadius = startSearchRadius || 2; // Start with 2km increment
        const maxRadius = expandedMaxRadius || (Number(settings.driver_search_radius_km) || 10);
        setSearchRadius(startRadius);
        triggerHaptic();

        if (!existingRideId) {
            // 1. Create the Ride Request in 'searching' status
            const categoryMap: Record<string, string> = {
                'eco': 'economic',
                'prem': 'premium',
                'moto': 'scooter'
            };

            const pickup_lat = userLocation?.lat || user.last_lat;
            const pickup_lng = userLocation?.lng || user.last_lng;

            if (!pickup_lat || !pickup_lng) {
                showAlert("Location Missing", "We couldn't determine your pickup location. Please wait a moment or try again.", "error");
                setStatus('idle');
                return;
            }

            const { data, error: insertError } = await supabase.from('rides').insert({
                customer_id: session.user.id,
                pickup_address: 'Current Location',
                pickup_lat,
                pickup_lng,
                dropoff_address: destinations[destinations.length - 1],
                dropoff_lat: destinationCoords[destinationCoords.length - 1]?.lat,
                dropoff_lng: destinationCoords[destinationCoords.length - 1]?.lng,
                price: calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1).finalPrice,
                status: 'searching',
                ride_type: rideType,
                requested_vehicle_type: categoryMap[selectedTier] || 'economic',
                distance_km: realDistanceKm
            }).select().single();

            if (insertError) {
                console.error("Ride Insert Error:", insertError);
                if (insertError.message.includes('safety_lock_no_self_riding')) {
                    showAlert("Safety Lock", "You cannot book your own ride!", "error");
                } else {
                    showAlert("Booking Failed", "Failed to create ride request. Please try again.", "error");
                }
                setStatus('idle');
                return;
            }
            ride = data;
            if (ride) setCurrentRideId(ride.id);
        }

        if (!ride) return;
        setCurrentRideId(ride.id);

        // 2. Setup Realtime Subscription for this specific ride with Auto-Reconnect
        let currentSubscription: any = null;
        let isSubscriptionActive = true;

        const setupRideSubscription = () => {
            if (!isSubscriptionActive) return;

            currentSubscription = supabase
                .channel(`ride-${ride.id}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${ride.id}` },
                    async (payload) => {
                        console.log('Ride update received:', payload);
                        const updatedRide = payload.new as any;

                        if (updatedRide.status === 'accepted' && updatedRide.driver_id) {
                            // Driver accepted!
                            if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);

                            // Fetch driver details with profile info
                            const { data: driverData, error: driverError } = await supabase
                                .from('drivers')
                                .select(`
                                    *,
                                    profile:profiles(
                                        full_name,
                                        phone,
                                        average_rating
                                    )
                                `)
                                .eq('id', updatedRide.driver_id)
                                .single();

                            if (driverData && !driverError) {
                                const formattedDriver = {
                                    ...driverData,
                                    name: (driverData.profile as any)?.full_name || 'Driver',
                                    phone: (driverData.profile as any)?.phone || '',
                                    rating: (driverData.profile as any)?.average_rating || 5.0
                                };
                                setAssignedDriverId(updatedRide.driver_id);
                                setAssignedDriver(formattedDriver);
                                setStatus('accepted');
                                sendPush("DROPOFF: Ride Accepted", `Your ride with ${formattedDriver.name} has been accepted!`);
                                triggerHaptic();
                            }
                        } else if (updatedRide.status === 'arrived') {
                            setStatus('arrived');
                            triggerHaptic();
                        } else if (updatedRide.status === 'in-progress') {
                            setStatus('in-progress');
                            triggerHaptic();
                        } else if (updatedRide.status === 'completed') {
                            isSubscriptionActive = false;
                            if (currentSubscription) currentSubscription.unsubscribe();
                            completeTrip();
                        } else if (updatedRide.status === 'cancelled') {
                            isSubscriptionActive = false;
                            if (currentSubscription) currentSubscription.unsubscribe();
                            if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);

                            // If it was already accepted, show cancellation summary modal
                            if (status === 'accepted' || status === 'arrived' || status === 'in-progress') {
                                setStatus('cancelled_by_driver'); // Internal status to clear UI
                                setShowCancellationSummary(true);
                                setIsMinimalRating(true); // Simplified rating for cancellations
                            } else {
                                // Full Cleanup for pre-acceptance cancellation
                                if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
                                markersRef.current.forEach(m => m?.setMap(null));
                                markersRef.current = [];
                                setDestinations(['']);
                                setBookingStep('planning');
                                setAssignedDriverId(null);
                                setAssignedDriver(null);
                                setStatus('idle');
                                showAlert("Cancelled", "Your ride request was cancelled.", "info");
                            }
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        if (isSubscriptionActive) {
                            console.log('⚠️ Ride subscription lost. Reconnecting in 3s...');
                            setTimeout(() => {
                                if (isSubscriptionActive) setupRideSubscription();
                            }, 3000);
                        }
                    }
                });
        };

        setupRideSubscription();

        // 3. Start Search Loop with Dynamic Radius and Actual Notifications
        let currentRadius = startRadius;
        const HARD_STOP_LIMIT = 120; // Auto-stop at 120km
        const interval = setInterval(async () => {
            // Radial search for drivers
            if (!userLocation) {
                console.log("⚠️ Cannot search: userLocation is null.");
                return;
            }

            const categoryMap: Record<string, string> = {
                'eco': 'economic',
                'prem': 'premium',
                'moto': 'scooter'
            };

            console.log(`📡 Searching for drivers in ${currentRadius}km radius... (Up to ${maxRadius}km)`);
            const { data: nearbyDrivers, error: rpcError } = await supabase.rpc('get_nearby_drivers', {
                user_lat: userLocation.lat,
                user_lng: userLocation.lng,
                radius_km: currentRadius,
                required_category: rideType === 'delivery' ? 'any' : (categoryMap[selectedTier] || 'economic')
            });

            if (nearbyDrivers && nearbyDrivers.length > 0) {
                console.log(`Found ${nearbyDrivers.length} nearby drivers.`);

                // Actually notify drivers who haven't been notified yet
                const driversToNotify = nearbyDrivers
                    .filter(d => !notifiedDriversRef.current.has(d.driver_id))
                    .map(d => d.driver_id);

                if (driversToNotify.length > 0) {
                    driversToNotify.forEach(id => notifiedDriversRef.current.add(id));

                    // Call Edge Function to send notification to all device tokens of these drivers
                    try {
                        await supabase.functions.invoke('send-fcm-notification', {
                            body: {
                                userIds: driversToNotify,
                                title: 'New Ride Request! 🚗',
                                message: 'A new request is waiting near you.',
                                target: 'driver',
                                data: { ride_id: ride.id, type: 'RIDE_REQUEST' }
                            }
                        });
                        console.log(`✅ Requested notifications for ${driversToNotify.length} drivers`);
                    } catch (err) {
                        console.warn(`Failed to notify drivers:`, err);
                    }
                }
            }

            // Hard stop at 120km
            if (currentRadius >= HARD_STOP_LIMIT) {
                clearInterval(interval);
                console.log(`🛑 Auto-stopped at ${HARD_STOP_LIMIT}km limit.`);
                showAlert(
                    "Search Ended",
                    "No drivers found within 120km. Please try again later.",
                    "info",
                    () => handleCancelRide()
                );
                return;
            }

            if (currentRadius >= maxRadius) {
                clearInterval(interval);

                // Ask user if they want to continue
                showAlert(
                    "No Drivers Found",
                    `No drivers found within ${maxRadius}km. Would you like to expand the search by another 20km?`,
                    "info",
                    () => {
                        // User chose to expand
                        const newMax = maxRadius + 20;
                        console.log(`User chose to expand. New max: ${newMax}km.`);
                        if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
                        handleBookRide(ride.id, newMax, currentRadius + 2);
                    },
                    true, // showCancel
                    "Expand Search",
                    "Cancel",
                    () => {
                        // User chose to cancel
                        console.log("User cancelled expansion.");
                        handleCancelRide();
                    }
                );
            } else {
                // Double check status before incrementing
                const { data: latestRide } = await supabase.from('rides').select('status').eq('id', ride.id).single();
                if (latestRide && latestRide.status !== 'searching') {
                    clearInterval(interval);
                    return;
                }
                currentRadius += 2;
                setSearchRadius(currentRadius);
            }
        }, 4000);

        searchIntervalRef.current = interval;
    };

    const handleMapClick = (e: any) => {
        // Real map handles its own clicks if needed, 
        // but for now we rely on Autocomplete
    };

    // --- DRIVER ANIMATION LOGIC ---
    useEffect(() => {
        // Clear interval on cleanup
        return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    }, []);

    useEffect(() => {
        if (status === 'searching') {
            setEtaSeconds(300);
            setDriverPos({ x: 80, y: 10 }); // Reset driver
        }
    }, [status]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0 && secs === 0) return 'Arrived';
        if (mins === 0) return `${secs}s`;
        return `${mins} min`;
    };

    const distanceToUse = realDistanceKm;
    const baseRate = Number(settings.price_per_km) || 40;
    const minFare = rideType === 'delivery' ? (Number(settings.min_delivery_fee) || 100) : (Number(settings.min_ride_price) || 300);

    // DEBUG LOGS FOR PRICING
    useEffect(() => {
        console.log("RideScreen Pricing Context:", {
            settings_id: settings.id,
            price_per_km: settings.price_per_km,
            min_ride_price: settings.min_ride_price,
            rideType,
            baseRate,
            minFare,
            userReferralBalance: user.referralBalance
        });
    }, [settings, rideType]);

    const calculatePrice = (multiplier: number) => {
        const basePrice = distanceToUse * baseRate * multiplier;
        const originalPrice = Math.ceil(minFare + basePrice);
        const balance = user.referralBalance || 0;
        const finalPrice = Math.max(0, originalPrice - balance);
        const amountUsed = originalPrice - finalPrice;
        return { originalPrice, finalPrice, amountUsed };
    };

    const confirmRide = () => {
        if (!destinations[destinations.length - 1]) return;
        if (user.location && destinations[destinations.length - 1].toLowerCase().trim() === user.location.toLowerCase().trim()) {
            showAlert("Invalid Location", "Destination cannot be your current location!", "error");
            return;
        }
        handleBookRide();
    };

    const startTrip = () => {
        setStatus('in-progress');
    };

    const handleCancelRide = async () => {
        const wasActive = status === 'searching' || status === 'accepted' || status === 'arrived' || status === 'in-progress';

        if (status === 'searching') {
            // Explicitly notify parent to unlock navigation immediately
            if (onSearchingChange) onSearchingChange(false);
            triggerHaptic();
        }

        // 1. Mark in DB if possible
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && wasActive) {
                await supabase
                    .from('rides')
                    .update({ status: 'cancelled' })
                    .eq('customer_id', session.user.id)
                    .in('status', ['searching', 'accepted', 'arrived', 'in-progress']);
            }
        } catch (e) {
            console.error("Cancel update error:", e);
        }

        // 2. Clear Interval
        if (searchIntervalRef.current) {
            clearInterval(searchIntervalRef.current);
            searchIntervalRef.current = null;
        }

        // 3. Full Map & State Cleanup
        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
        markersRef.current.forEach(m => m?.setMap(null));
        markersRef.current = [];
        setDestinations(['']);
        setBookingStep('planning');
        setAssignedDriverId(null);
        setAssignedDriver(null);
        setRealDistanceKm(0);
        setEtaSeconds(300);

        // 4. Conditional UI transition
        if (wasActive && status !== 'searching') {
            // Only show summary if it was an actual booking (accepted/etc)
            // If it was just 'searching', just go back to idle
            setStatus('cancelled');
            setShowCancellationSummary(true);
            setIsMinimalRating(true);
        } else {
            setStatus('idle');
            navigate('dashboard');
        }
    };

    const completeTrip = () => {
        setStatus('completed');
        setShowPaymentSummary(true);
    };

    const submitReview = async () => {
        setLoading(true);
        triggerHaptic();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            // 1. Calculate discount usage
            const { originalPrice, amountUsed } = calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1);

            // 2. Save to reviews table
            const { error: reviewError } = await supabase
                .from('reviews')
                .insert({
                    reviewer_id: session.user.id,
                    target_id: assignedDriverId,
                    rating: rating,
                    comment: "Rated via app",
                    role_target: 'driver'
                });

            if (reviewError) throw reviewError;

            // 3. Deduct Referral Balance if used
            if (amountUsed > 0) {
                await supabase.rpc('deduct_referral_balance', {
                    user_id: session.user.id,
                    amount: amountUsed
                });
            }

            // 4. Success - Reset and exit
            setRating(5);
            setReviewComment('');
            setStatus('idle');
            setAssignedDriverId(null);
            setAssignedDriver(null);
            setShowPaymentSummary(false);
            setShowCancellationSummary(false);
            setIsMinimalRating(false);

            // Full Cleanup
            if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
            markersRef.current.forEach(m => m?.setMap(null));
            markersRef.current = [];
            setDestinations(['']);
            setBookingStep('planning');

            navigate('dashboard');
        } catch (err: any) {
            console.error("Submit Review Error:", err);
            showAlert("Error", `Feedback failed: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    // --- SHEET DRAG HANDLERS ---
    const handleSheetTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        sheetStartY.current = e.touches[0].clientY;
        sheetCurrentY.current = e.touches[0].clientY;
    };

    const handleSheetTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - sheetStartY.current;

        if (isSheetMinimized) {
            if (deltaY < 0) {
                // Dragging UP from peek
                setSheetOffset(Math.max(0, PEEK_OFFSET + deltaY));
            }
        } else {
            if (deltaY > 0) {
                // Dragging DOWN from full
                setSheetOffset(Math.min(PEEK_OFFSET, deltaY));
            }
        }
    };


    const handleSheetTouchEnd = () => {
        setIsDragging(false);
        // "Will not full close" - Ensure even minimized state is very visible
        const SNAP_THRESHOLD = 150;

        if (isSheetMinimized) {
            if (sheetOffset < PEEK_OFFSET - SNAP_THRESHOLD) {
                setIsSheetMinimized(false);
                setSheetOffset(0);
            } else {
                setSheetOffset(PEEK_OFFSET);
            }
        } else {
            if (sheetOffset > SNAP_THRESHOLD) {
                setIsSheetMinimized(true);
                setSheetOffset(PEEK_OFFSET);
            } else {
                setSheetOffset(0);
            }
        }
    };

    const sheetTransform = `translateY(${sheetOffset}px)`;
    const currentPrice = calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1);

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} relative overflow-hidden transition-colors duration-500`}>
            {isLocating && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[20] animate-bounce-in">
                    <div className="bg-white dark:bg-[#1C1C1E] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-[#00D68F]/20">
                        <Loader2 className="animate-spin text-[#00D68F]" size={16} />
                        <span className="text-sm font-bold">
                            {locationMethod === 'profile' ? 'Refining position...' : 'Finding you...'}
                        </span>
                    </div>
                </div>
            )}

            {/* Map Component */}
            <RideMap
                mapContainerRef={mapContainerRef}
                map={map}
                theme={theme}
                userLocation={userLocation}
                mapPins={mapPinsRef.current}
                status={status}
            />

            {/* Location Search Full-Screen Overlay */}
            {showSearchOverlay && (
                <LocationSearchOverlay
                    theme={theme}
                    onClose={() => setShowSearchOverlay(false)}
                    user={user}
                    destinations={destinations}
                    updateDestination={updateDestination}
                    addDestination={addDestination}
                    removeDestination={removeDestination}
                    userLocation={userLocation}
                    calculateRouteAndPrice={calculateRouteAndPrice}
                    setBookingStep={setBookingStep}
                    handleLocateMe={handleLocateMe}
                />
            )}

            {/* Back Button & Locate Me */}
            <div className="z-10 px-6 pt-safe flex items-center justify-between pointer-events-none">
                <button
                    onClick={status === 'searching' ? () => handleCancelRide() : goBack}
                    className={`w-10 h-10 rounded-full ${bgCard} shadow-lg flex items-center justify-center pointer-events-auto active:scale-90 transition-transform`}
                >
                    <ArrowLeft size={20} />
                </button>

                <button
                    onClick={() => handleLocateMe()}
                    className={`w-10 h-10 rounded-full ${bgCard} shadow-lg flex items-center justify-center pointer-events-auto active:scale-90 transition-transform`}
                >
                    <Locate size={20} className="text-[#00D68F]" />
                </button>
            </div>

            {/* Bottom Card / Draggable Sheet */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-20 ${theme === 'light' ? 'bg-white/70' : 'bg-[#1C1C1E]/70'} backdrop-blur-3xl rounded-t-[2.5rem] shadow-[0_-10px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_-10px_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[88vh] min-h-[350px] transition-transform duration-300 ease-out`}
                style={{
                    transform: sheetTransform,
                    transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
            >
                {/* Drag Handle */}
                <div
                    className="w-full pt-4 pb-2 flex justify-center cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={handleSheetTouchStart}
                    onTouchMove={handleSheetTouchMove}
                    onTouchEnd={handleSheetTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full flex-shrink-0"></div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-6 pt-2 pb-safe" onScroll={handleScroll}>
                    {status === 'idle' && (
                        <RideBookingForm
                            theme={theme}
                            bookingStep={bookingStep}
                            setBookingStep={setBookingStep}
                            rideType={rideType}
                            setRideType={setRideType}
                            destinations={destinations}
                            updateDestination={updateDestination}
                            addDestination={addDestination}
                            removeDestination={removeDestination}
                            handleSearch={handleSearch}
                            predictions={predictions}
                            selectPrediction={selectPrediction}
                            activeInputIndex={activeInputIndex}
                            setActiveInputIndex={setActiveInputIndex}
                            isCalculating={isCalculating}
                            handleNextStep={handleNextStep}
                            selectedTier={selectedTier}
                            setSelectedTier={setSelectedTier}
                            tiers={tiers}
                            calculatePrice={calculatePrice}
                            ridePayMethod={ridePayMethod}
                            setRidePayMethod={setRidePayMethod}
                            confirmRide={confirmRide}
                            triggerHaptic={triggerHaptic}
                            bgCard={bgCard}
                            inputBg={inputBg}
                            textSec={textSec}
                            sessionToken={sessionToken}
                            user={user}
                            settings={settings}
                            showAlert={showAlert}
                            setShowSearchOverlay={setShowSearchOverlay}
                            expandSheet={() => {
                                setIsSheetMinimized(false);
                                setSheetOffset(0);
                            }}
                        />
                    )}

                    {(status === 'searching' || status === 'accepted' || status === 'arrived' || status === 'in-progress') && (
                        <RideStatusPanel
                            status={status}
                            rideType={rideType}
                            etaSeconds={etaSeconds}
                            assignedDriver={assignedDriver}
                            destinations={destinations}
                            user={user}
                            inputBg={inputBg}
                            textSec={textSec}
                            formatTime={formatTime}
                            selectedTier={selectedTier}
                            handleCancelRide={handleCancelRide}
                            theme={theme}
                        />
                    )}
                </div>
            </div>

            {showCancellationSummary && (
                <RideCancellationSummary
                    onClose={() => { setShowCancellationSummary(false); setStatus('idle'); navigate('dashboard'); }}
                    bgCard={bgCard}
                    textSec={textSec}
                    inputBg={inputBg}
                />
            )}

            {showPaymentSummary && (
                <RidePaymentSummary
                    assignedDriver={assignedDriver}
                    rating={rating}
                    setRating={setRating}
                    reviewComment={reviewComment}
                    setReviewComment={setReviewComment}
                    calculatePrice={calculatePrice}
                    tiers={tiers}
                    selectedTier={selectedTier}
                    loading={loading}
                    submitReview={submitReview}
                    ridePayMethod={ridePayMethod}
                    bgCard={bgCard}
                    inputBg={inputBg}
                    textSec={textSec}
                    user={user}
                />
            )}


        </div>
    );
};
