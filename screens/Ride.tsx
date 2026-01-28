
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin as MapPinFilled, Plus, X, Car, Bike, Star, Phone, MessageSquare, Navigation, Info, Locate, User } from 'lucide-react';
import { Theme, Screen, RideStatus, Activity, UserData, AppSettings } from '../types';
import { triggerHaptic, sendPushNotification } from '../index';
import { CONFIG } from '../config';
import { supabase } from '../supabaseClient';

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    goBack: () => void;
    setRecentActivity: React.Dispatch<React.SetStateAction<Activity[]>>;
    user: UserData;
    prefilledDestination?: string | null;
    clearPrefilled?: () => void;
    active?: boolean;
    handleScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    settings: AppSettings;
}

export const RideScreen = ({ theme, navigate, goBack, setRecentActivity, user, prefilledDestination, clearPrefilled, active, handleScroll, settings }: Props) => {
    const [status, setStatus] = useState<RideStatus>('idle');
    const [rideType, setRideType] = useState<'ride' | 'delivery'>('ride');
    const [destinations, setDestinations] = useState<string[]>(['']);
    const [selectedTier, setSelectedTier] = useState('eco');
    const [ridePayMethod, setRidePayMethod] = useState<'cash' | 'wave'>('wave');
    const [etaSeconds, setEtaSeconds] = useState(300);
    const [rating, setRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [bookingStep, setBookingStep] = useState<'planning' | 'selecting'>('planning');
    const [mapPins, setMapPins] = useState<{ x: number, y: number, label?: string }[]>([]);
    const [loading, setLoading] = useState(false);

    // Animation States
    const [driverPos, setDriverPos] = useState({ x: 80, y: 10 }); // Start top-right
    const animationRef = useRef<number | null>(null);

    // --- GOOGLE MAPS REFS & STATE ---
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [markers, setMarkers] = useState<any[]>([]);
    const [driverMarkers, setDriverMarkers] = useState<Map<string, any>>(new Map());
    const [assignedDriverId, setAssignedDriverId] = useState<string | null>(null);
    const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
    const autocompleteService = useRef<any>(null);
    const sessionToken = useRef<any>(null);
    const [predictions, setPredictions] = useState<any[]>([]);
    const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [realDistanceKm, setRealDistanceKm] = useState<number>(0);
    const [assignedDriver, setAssignedDriver] = useState<any>(null);
    const [searchRadius, setSearchRadius] = useState(5); // Default 5km
    const [searchInterval, setSearchInterval] = useState<any>(null);

    // Drag Sheet State
    const [sheetOffset, setSheetOffset] = useState(0);
    const [isSheetMinimized, setIsSheetMinimized] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const sheetStartY = useRef(0);
    const sheetCurrentY = useRef(0);

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const initMap = () => {
            if (!(window as any).google) {
                console.error("Google Maps script not loaded");
                return;
            }

            const defaultCenter = { lat: 13.4432, lng: -16.5916 }; // Banjul
            const newMap = new (window as any).google.maps.Map(mapContainerRef.current, {
                center: defaultCenter,
                zoom: 14,
                disableDefaultUI: true,
                styles: theme === 'dark' ? darkMapStyle : []
            });

            setMap(newMap);
            setDirectionsRenderer(new (window as any).google.maps.DirectionsRenderer({
                map: newMap,
                suppressMarkers: true,
                polylineOptions: {
                    strokeColor: '#00D68F',
                    strokeWeight: 5,
                    strokeOpacity: 0.8
                }
            }));

            autocompleteService.current = new (window as any).google.maps.places.AutocompleteService();
            // Start with no session token; generate on focus
            sessionToken.current = null;

            // 1. Center on User Location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const pos = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        newMap.setCenter(pos);
                        setUserLocation(pos);
                        // Add marker for user
                        new (window as any).google.maps.Marker({
                            position: pos,
                            map: newMap,
                            icon: {
                                path: "M12,2A5,5 0 0,1 17,7A5,5 0 0,1 12,12A5,5 0 0,1 7,7A5,5 0 0,1 12,2M12,14C17.5,14 22,16.24 22,19V22H2V19C2,16.24 6.5,14 12,14Z",
                                scale: 1.2,
                                fillOpacity: 1,
                                fillColor: '#00D68F',
                                strokeColor: 'white',
                                strokeWeight: 2,
                                anchor: new (window as any).google.maps.Point(12, 12)
                            }
                        });
                    },
                    (error) => console.log("Geolocation error:", error)
                );
            }
        };

        if ((window as any).google) {
            initMap();
        } else {
            const checkInterval = setInterval(() => {
                if ((window as any).google) {
                    initMap();
                    clearInterval(checkInterval);
                }
            }, 100);
        }
    }, []);

    // Handle Prefilled Destination from Dashboard
    useEffect(() => {
        if (prefilledDestination && map && directionsRenderer) {
            console.log("Applying prefilled destination:", prefilledDestination);
            updateDestination(0, prefilledDestination);

            // Geocode and show route immediately
            const geocoder = new (window as any).google.maps.Geocoder();
            geocoder.geocode({ address: prefilledDestination }, (results: any, status: string) => {
                if (status === 'OK' && results[0]) {
                    const loc = results[0].geometry.location;
                    map.panTo(loc);

                    new (window as any).google.maps.Marker({
                        position: loc,
                        map: map,
                        label: '1'
                    });

                    calculateRouteAndPrice();
                    setBookingStep('selecting');
                    if (clearPrefilled) clearPrefilled();
                }
            });
        }
    }, [prefilledDestination, map, directionsRenderer]);

    // Re-center Map when screen becomes active
    useEffect(() => {
        if (active && map && userLocation) {
            console.log("Ride screen active, re-centering map...");
            map.panTo(userLocation);
        }
    }, [active, map, userLocation]);

    // --- REAL-TIME DRIVER TRACKING ---
    useEffect(() => {
        if (!map) return;

        const getVehicleIcon = (vType: string) => {
            const iconRoot = '/assets/drivers%20vehicle%20types/';
            let iconName = 'car_economic_3d_backup.png';
            let markerClass = 'driver-marker';

            if (vType === 'prem') {
                iconName = 'car_premium_3d_backup.png';
                markerClass = 'driver-marker driver-marker-prem';
            }
            if (vType === 'moto') {
                iconName = 'car_scooter_3d_backup.png';
                markerClass = 'driver-marker driver-marker-moto';
            }

            return {
                url: `${iconRoot}${iconName}`,
                scaledSize: new (window as any).google.maps.Size(50, 50),
                anchor: new (window as any).google.maps.Point(25, 25),
                className: markerClass // Custom property to apply CSS via OverlayView if needed, or just standard marker
            };
        };

        const fetchInitialDrivers = async () => {
            const { data, error } = await supabase
                .from('drivers')
                .select('*')
                .eq('is_online', true);

            if (data) {
                const newDriverMarkers = new Map();
                data.forEach(d => {
                    const icon = getVehicleIcon(d.vehicle_type || 'eco');
                    const marker = new (window as any).google.maps.Marker({
                        position: { lat: d.current_lat, lng: d.current_lng },
                        map: map,
                        icon: {
                            url: icon.url,
                            scaledSize: icon.scaledSize,
                            anchor: icon.anchor
                        },
                        title: `Driver ${d.id}`,
                        // Note: Standard Google Maps Marker doesn't easily support className for animation
                        // BUT we can use the 'optimized: false' flag to ensure they are rendered as DOM elements
                        optimized: false
                    });
                    newDriverMarkers.set(d.id, marker);
                });
                setDriverMarkers(newDriverMarkers);
            }
        };

        fetchInitialDrivers();

        const channel = supabase
            .channel('driver-locations')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'drivers' },
                (payload) => {
                    console.log('Driver change detected:', payload);
                    const updatedDriver = payload.new as any;
                    const oldDriver = payload.old as any;

                    setDriverMarkers(prev => {
                        const next = new Map(prev);

                        // Handle deletion or going offline
                        if (payload.eventType === 'DELETE' || (updatedDriver && !updatedDriver.is_online)) {
                            const marker = next.get(updatedDriver?.id || oldDriver?.id) as any;
                            if (marker) {
                                marker.setMap(null);
                                next.delete(updatedDriver?.id || oldDriver?.id);
                            }
                        }
                        // Handle insertion or update
                        else if (updatedDriver && updatedDriver.is_online) {
                            let marker = next.get(updatedDriver.id) as any;
                            const position = { lat: updatedDriver.current_lat, lng: updatedDriver.current_lng };

                            if (marker) {
                                marker.setPosition(position);
                            } else {
                                const icon = getVehicleIcon(updatedDriver.vehicle_type || 'eco');
                                marker = new (window as any).google.maps.Marker({
                                    position: position,
                                    map: map,
                                    icon: {
                                        url: icon.url,
                                        scaledSize: icon.scaledSize,
                                        anchor: icon.anchor
                                    },
                                    title: `Driver ${updatedDriver.id}`,
                                    optimized: false
                                });
                                next.set(updatedDriver.id, marker);
                            }

                            // Update local assignedDriver if this is our match
                            if (updatedDriver.id === assignedDriverId) {
                                setAssignedDriver(updatedDriver);

                                // Calculate real ETA based on proximity
                                if (userLocation) {
                                    const dist = calculateProximity(
                                        updatedDriver.current_lat,
                                        updatedDriver.current_lng,
                                        userLocation.lat,
                                        userLocation.lng
                                    );

                                    // Average speed 30km/h = 0.5km/min
                                    const newEta = Math.round((dist / 0.5) * 60);
                                    setEtaSeconds(newEta);

                                    // Auto-arrive if very close (< 0.1km = 100m)
                                    if (dist < 0.1 && status === 'accepted') {
                                        setStatus('arrived');
                                        sendPush("Driver Arrived", `${updatedDriver.vehicle_model || 'Your driver'} has arrived and is waiting!`);
                                    }
                                }
                            }
                        }
                        return next;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [map, assignedDriverId, userLocation, status]);

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
    useEffect(() => {
        const isRequestActive = ['accepted', 'arrived', 'in-progress'].includes(status);

        driverMarkers.forEach((marker: any, id) => {
            if (isRequestActive) {
                // Only show the assigned driver
                if (id === assignedDriverId) {
                    marker.setVisible(true);
                } else {
                    marker.setVisible(false);
                }
            } else {
                // Show all online drivers when searching or idle
                marker.setVisible(true);
            }
        });
    }, [status, driverMarkers, assignedDriverId]);

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

    const calculateRouteAndPrice = async () => {
        if (!map || directionsRenderer === null || destinations.every(d => !d)) return;

        const directionsService = new (window as any).google.maps.DirectionsService();

        const validDestinations = destinations.filter(d => d.trim() !== '');
        if (validDestinations.length === 0) return;

        console.log("Requesting Directions for:", validDestinations);

        const request: any = {
            origin: userLocation || { lat: 13.4432, lng: -16.5916 },
            destination: validDestinations[validDestinations.length - 1],
            waypoints: validDestinations.length > 1
                ? validDestinations.slice(0, -1).map(d => ({ location: d, stopover: true }))
                : [],
            travelMode: (window as any).google.maps.TravelMode.DRIVING
        };

        directionsService.route(request, (result: any, status: string) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(result);

                // Calculate total distance
                let totalDist = 0;
                const legs = result.routes[0].legs;
                for (let j = 0; j < legs.length; j++) {
                    totalDist += legs[j].distance.value;
                }
                const km = totalDist / 1000;
                setRealDistanceKm(km);
                console.log("Route calculated! Distance:", km, "km");
            } else {
                console.error("Directions request failed due to " + status);
            }
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
    };

    const addDestination = () => {
        setDestinations([...destinations, '']);
    };

    const removeDestination = (index: number) => {
        if (destinations.length > 1) {
            const newDestinations = destinations.filter((_, i) => i !== index);
            setDestinations(newDestinations);

            // Remove corresponding pin if it exists
            if (index < mapPins.length) {
                const newPins = mapPins.filter((_, i) => i !== index);
                setMapPins(newPins);
            }
        } else {
            updateDestination(0, '');
            setMapPins([]);
        }
    };

    const handleSearch = (val: string, index: number) => {
        updateDestination(index, val);
        setActiveInputIndex(index);

        if (!val || val.length < 2) {
            setPredictions([]);
            return;
        }

        if (autocompleteService.current) {
            // Start session if not exists
            if (!sessionToken.current) {
                sessionToken.current = generateUUID();
                console.log("Maps Ride: Started new session");
            }

            autocompleteService.current.getPlacePredictions({
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

        updateDestination(activeInputIndex, prediction.description);
        setPredictions([]);
        setActiveInputIndex(null);

        // Clear session token to save cost
        sessionToken.current = null;

        // Geocode and update map
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: prediction.description }, (results: any, status: string) => {
            if (status === 'OK' && results[0] && map) {
                const loc = results[0].geometry.location;
                map.panTo(loc);

                // Add marker
                const marker = new (window as any).google.maps.Marker({
                    position: loc,
                    map: map,
                    label: (activeInputIndex + 1).toString()
                });
                setMarkers([...markers, marker]);

                // Removed immediate routing call to allow manual control via 'Next' button
                // calculateRouteAndPrice();
            }
        });
    };

    const handleNextStep = () => {
        if (destinations[0]) {
            calculateRouteAndPrice();
            setBookingStep('selecting');
            triggerHaptic();
        }
    };

    const handleBookRide = async (existingRideId?: string, expandedMaxRadius?: number, startSearchRadius?: number) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert("Please login to book a ride!");
            return;
        }

        setStatus('searching');
        const startRadius = startSearchRadius || 2; // Start with 2km increment
        const maxRadius = expandedMaxRadius || (Number(settings.driver_search_radius_km) || 10);
        setSearchRadius(startRadius);
        triggerHaptic();

        let ride = null;
        if (existingRideId) {
            // Use existing ride record
            const { data } = await supabase.from('rides').select('*').eq('id', existingRideId).single();
            ride = data;
        } else {
            // 1. Create the Ride Request in 'searching' status
            const { data, error: insertError } = await supabase.from('rides').insert({
                customer_id: session.user.id,
                pickup_address: 'Current Location',
                pickup_lat: userLocation?.lat,
                pickup_lng: userLocation?.lng,
                dropoff_address: destinations[destinations.length - 1],
                price: calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1).finalPrice,
                status: 'searching',
                ride_type: rideType
            }).select().single();

            if (insertError) {
                console.error("Ride Insert Error:", insertError);
                if (insertError.message.includes('safety_lock_no_self_riding')) {
                    alert("Safety Lock: You cannot book your own ride!");
                } else {
                    alert("Failed to create ride request. Please try again.");
                }
                setStatus('idle');
                return;
            }
            ride = data;
        }

        if (!ride) return;

        // 2. Setup Realtime Subscription for this specific ride (only if not already subscribed)
        // Note: In a production app, we'd manage this subscription more carefully to avoid duplicates.
        const rideSubscription = supabase
            .channel(`ride-${ride.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${ride.id}` },
                async (payload) => {
                    console.log('Ride update received:', payload);
                    const updatedRide = payload.new as any;

                    if (updatedRide.status === 'accepted' && updatedRide.driver_id) {
                        // Driver accepted!
                        rideSubscription.unsubscribe();
                        if (searchInterval) clearInterval(searchInterval);

                        // Fetch driver details
                        const { data: driver } = await supabase
                            .from('drivers')
                            .select('*')
                            .eq('id', updatedRide.driver_id)
                            .single();

                        setAssignedDriverId(updatedRide.driver_id);
                        setAssignedDriver(driver);
                        setStatus('accepted');
                        sendPush("Ride Accepted", `Your ride with ${driver?.vehicle_model || 'a driver'} has been accepted!`);
                        triggerHaptic();
                    } else if (updatedRide.status === 'cancelled') {
                        rideSubscription.unsubscribe();
                        if (searchInterval) clearInterval(searchInterval);
                        setStatus('idle');
                        alert("Your ride request was cancelled.");
                    }
                }
            )
            .subscribe();

        // 3. Start Search Loop (Simulating broadcasting to nearby drivers)
        let currentRadius = startRadius;
        const interval = setInterval(async () => {
            console.log(`Searching for drivers in ${currentRadius}km radius... (Up to ${maxRadius}km)`);

            // Check if any drivers are even nearby to justify the search state
            const { data: nearby } = await supabase.rpc('get_nearby_drivers', {
                user_lat: userLocation?.lat,
                user_lng: userLocation?.lng,
                radius_km: currentRadius,
                required_category: selectedTier === 'prem' ? 'AC' : (selectedTier === 'moto' ? 'tuktuk' : 'economic')
            });

            if (nearby && nearby.length > 0) {
                console.log(`${nearby.length} nearby drivers notified.`);
                // In a real app, we might trigger push notifications to these driver IDs here
            }

            if (currentRadius >= maxRadius) {
                clearInterval(interval);

                // Ask user if they want to continue
                const shouldContinue = window.confirm(`No drivers found within ${maxRadius}km. Would you like to expand the search radius by another 10km?`);

                if (shouldContinue) {
                    // Start a new loop with a higher limit
                    const newMax = maxRadius + 10;
                    console.log(`User chose to continue. Expanding search to ${newMax}km.`);

                    // We need to trigger the loop again.
                    // To keep it simple, we can just call handleBookRide again with an optional 'existingRideId' and 'expandedRadius'
                    // but it might be cleaner to just restart the search loop here if we refactor slightly.
                    // For now, let's just use a recursive-like call or a new interval.

                    // Better approach: Update the loop logic to handle this internally if we change how the interval is managed.
                    // But since we are already in the interval, we can just NOT clear it and just update maxRadius.
                    // However, maxRadius is a local const. I should change it to a let or refactor.

                    // Let's refactor the search loop to be more robust.
                    rideSubscription.unsubscribe(); // Cleanup before restart
                    handleBookRide(ride.id, maxRadius + 10, currentRadius + 2);
                } else {
                    rideSubscription.unsubscribe();
                    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', ride.id);
                    setStatus('idle');
                }
            } else {
                currentRadius += 2;
                setSearchRadius(currentRadius);
            }
        }, 4000);

        setSearchInterval(interval);
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
        if (status === 'accepted') {
            // Phase 1: Driver moving to User
            // COMMENTED OUT: Use real database values instead of simulation
            /*
            const start = { x: 80, y: 10 };
            const end = { x: 45, y: 50 }; // Center-ish for mock animation
            const duration = 10000; // 10 seconds for demo
            let startTime = Date.now();

            const animate = () => {
                const now = Date.now();
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Linear Interpolation
                const currentX = start.x + (end.x - start.x) * progress;
                const currentY = start.y + (end.y - start.y) * progress;

                setDriverPos({ x: currentX, y: currentY });

                // Update ETA text simulation
                setEtaSeconds(Math.ceil((1 - progress) * 300)); // Map progress to 5 mins

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    setStatus('arrived');
                }
            };
            animationRef.current = requestAnimationFrame(animate);
            */

        } else if (status === 'in-progress') {
            // Phase 2: Driver moving to Destination (or first pin)
            // COMMENTED OUT: Use real database values
            /*
            if (mapPins.length === 0) return;

            const start = { x: 45, y: 50 };
            const end = mapPins[0]; // First destination
            const duration = 15000;
            let startTime = Date.now();

            const animate = () => {
                const now = Date.now();
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const currentX = start.x + (end.x - start.x) * progress;
                const currentY = start.y + (end.y - start.y) * progress;

                setDriverPos({ x: currentX, y: currentY });

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    // Arrived at destination
                }
            };
            animationRef.current = requestAnimationFrame(animate);
            */
        }
    }, [status, mapPins]);

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

    const distanceToUse = realDistanceKm || (5.2 * destinations.length);
    const baseRate = 40;
    const minFare = rideType === 'delivery' ? (Number(settings.min_delivery_fee) || 100) : (Number(settings.min_ride_price) || 300);

    const calculatePrice = (multiplier: number) => {
        const basePrice = distanceToUse * baseRate * multiplier;
        const originalPrice = Math.max(minFare, Math.ceil(basePrice));
        const balance = user.referralBalance || 0;
        const finalPrice = Math.max(0, originalPrice - balance);
        const amountUsed = originalPrice - finalPrice;
        return { originalPrice, finalPrice, amountUsed };
    };

    const tiers = [
        { id: 'eco', label: 'Economy', mult: 1, time: '3 min', icon: Car, img: '/assets/white_yaris_side.png', desc: '4 seats' },
        { id: 'prem', label: 'AC', mult: 1.8, time: '5 min', icon: Car, img: '/assets/black_luxury_side.png', desc: 'Premium • 4 seats' },
        { id: 'moto', label: 'Bike', mult: 0.6, time: '2 min', icon: Bike, img: '/assets/scooter_side_view.png', desc: 'Fast • 1 seat' }
    ];

    const confirmRide = () => {
        if (!destinations[destinations.length - 1]) return;
        if (destinations[destinations.length - 1].toLowerCase().trim() === user.location?.toLowerCase().trim()) {
            alert("Destination cannot be your current location!");
            return;
        }
        handleBookRide();
    };

    const startTrip = () => {
        setStatus('in-progress');
    };

    const completeTrip = () => {
        setStatus('review');
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
                    comment: reviewComment || "No comment provided",
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
            setReviewComment('');
            setRating(5);
            setStatus('idle');
            setAssignedDriverId(null);
            setAssignedDriver(null);
            navigate('dashboard');
        } catch (err: any) {
            console.error("Submit Review Error:", err);
            alert(`Error submitting feedback: ${err.message}`);
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
                setSheetOffset(Math.max(0, 500 + deltaY));
            }
        } else {
            if (deltaY > 0) {
                setSheetOffset(deltaY);
            }
        }
    };

    const handleSheetTouchEnd = () => {
        setIsDragging(false);
        if (isSheetMinimized) {
            if (sheetOffset < 400) {
                setIsSheetMinimized(false);
                setSheetOffset(0);
            } else {
                setSheetOffset(500);
            }
        } else {
            if (sheetOffset > 150) {
                setIsSheetMinimized(true);
                setSheetOffset(500);
            } else {
                setSheetOffset(0);
            }
        }
    };

    const sheetTransform = `translateY(${sheetOffset}px)`;
    const currentPrice = calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1);

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} relative`}>
            {/* Real Interactive Map Area */}
            <div ref={mapContainerRef} className="absolute inset-0 z-0 overflow-hidden" />



            {(status === 'accepted' || status === 'arrived' || status === 'in-progress') && (
                <div
                    className="absolute z-20 transition-all duration-75 ease-linear pointer-events-none"
                    style={{ left: `${driverPos.x}%`, top: `${driverPos.y}%` }}
                >
                    <div className="relative -translate-x-1/2 -translate-y-1/2">
                        {status === 'accepted' && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap shadow-lg animate-bounce">
                                {formatTime(etaSeconds)}
                            </div>
                        )}
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-[#00D68F] transform -rotate-90">
                            <Car size={18} className="text-black" fill="currentColor" />
                        </div>
                    </div>
                </div>
            )}

            {mapPins.map((pin, i) => (
                <div key={`pin-${i}`} className="absolute z-10 animate-scale-in" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                    <div className="relative -translate-x-1/2 -translate-y-full">
                        <MapPinFilled size={36} className="text-red-600 drop-shadow-lg filter" />
                        <div className="w-2 h-2 bg-black/20 rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 blur-[1px]"></div>
                        {pin.label && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-black px-2 py-1 rounded shadow-md text-[10px] font-bold border border-gray-100 dark:border-gray-800">
                                {pin.label}
                            </div>
                        )}
                    </div>
                    <div className="absolute -translate-x-1/2 -translate-y-full top-[-28px] left-0 w-full text-center text-[10px] font-bold text-white pointer-events-none">
                        {i + 1}
                    </div>
                </div>
            ))}

            {/* Back Button & Locate Me */}
            <div className="z-10 px-6 pt-safe flex items-center justify-between pointer-events-none">
                <button onClick={goBack} className={`w-10 h-10 rounded-full ${bgCard} shadow-lg flex items-center justify-center pointer-events-auto active:scale-90 transition-transform`}>
                    <ArrowLeft size={20} />
                </button>
                {status === 'idle' && (
                    <button
                        onClick={() => { triggerHaptic(); alert("Centering on location..."); }}
                        className={`w-10 h-10 rounded-full ${bgCard} shadow-lg flex items-center justify-center pointer-events-auto active:scale-90 transition-transform`}
                    >
                        <Locate size={20} />
                    </button>
                )}
            </div>

            {/* Bottom Card / Draggable Sheet */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-20 ${bgCard} rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col max-h-[85vh] transition-transform duration-300 ease-out`}
                style={{
                    transform: sheetTransform,
                    transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
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
                        <div className="space-y-6">
                            {bookingStep === 'planning' ? (
                                <div className="space-y-6 animate-scale-in">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-bold">Plan your {rideType}</h2>
                                        <div className={`p-1 rounded-xl ${inputBg} flex gap-1`}>
                                            <button
                                                onClick={() => { triggerHaptic(); setRideType('ride'); }}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${rideType === 'ride' ? 'bg-[#00D68F] text-black shadow-md' : 'text-gray-500'}`}
                                            >
                                                Ride
                                            </button>
                                            <button
                                                onClick={() => { triggerHaptic(); setRideType('delivery'); setSelectedTier('moto'); }}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${rideType === 'delivery' ? 'bg-[#00D68F] text-black shadow-md' : 'text-gray-500'}`}
                                            >
                                                Delivery
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative pl-4 space-y-4">
                                        <div className="absolute left-[23px] top-4 bottom-8 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

                                        <div className="relative flex items-center gap-3">
                                            <div className="w-4 h-4 rounded-full border-[3px] border-blue-500 bg-white dark:bg-black z-10 flex-shrink-0 shadow-sm"></div>
                                            <div className={`flex-1 p-3.5 rounded-xl ${inputBg} font-medium text-sm ${textSec} flex items-center justify-between`}>
                                                <span>Current Location</span>
                                                <Locate size={14} className="opacity-50" />
                                            </div>
                                        </div>

                                        {destinations.map((dest, idx) => (
                                            <div key={idx} className="relative flex flex-col gap-1">
                                                <div className="relative flex items-center gap-3 animate-scale-in">
                                                    <div className="w-4 h-4 rounded-full border-[3px] border-red-500 bg-white dark:bg-black z-10 flex-shrink-0 shadow-sm"></div>
                                                    <div className={`flex-1 flex items-center gap-2 p-3.5 rounded-xl ${inputBg} focus-within:ring-2 ring-[#00D68F] transition-all`}>
                                                        <input
                                                            placeholder={idx === 0 ? "Where to?" : "Add a stop"}
                                                            className="bg-transparent outline-none flex-1 font-bold text-sm"
                                                            value={dest}
                                                            onChange={(e) => handleSearch(e.target.value, idx)}
                                                            onFocus={() => {
                                                                setActiveInputIndex(idx);
                                                                if (!sessionToken.current) {
                                                                    sessionToken.current = generateUUID();
                                                                }
                                                            }}
                                                        />
                                                        {destinations.length > 1 && (
                                                            <button onClick={() => removeDestination(idx)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                                                                <X size={14} className="opacity-50" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {activeInputIndex === idx && predictions.length > 0 && (
                                                    <div className={`absolute top-full left-7 right-0 z-50 ${bgCard} mt-2 rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden`}>
                                                        {predictions.map((p: any) => (
                                                            <button
                                                                key={p.place_id}
                                                                onClick={() => selectPrediction(p)}
                                                                className={`w-full p-4 text-left hover:bg-[#00D68F]/10 border-b border-black/5 dark:border-white/5 last:border-0 flex items-start gap-3`}
                                                            >
                                                                <MapPinFilled size={18} className="text-[#00D68F] flex-shrink-0 mt-0.5" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-sm">{p.structured_formatting?.main_text || p.description}</span>
                                                                    <span className="text-[10px] opacity-50 truncate">{p.structured_formatting?.secondary_text || ''}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        <div className="relative flex items-center gap-3 pl-0.5">
                                            <div className="w-3.5 flex justify-center"><Plus size={14} className="text-[#00D68F]" /></div>
                                            <button onClick={addDestination} className="text-sm font-bold text-[#00D68F] active:opacity-60">Add Stop</button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleNextStep}
                                        disabled={!destinations[0]}
                                        className="w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
                                    >
                                        Next
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-scale-in">
                                    <div className="flex items-center justify-between px-1">
                                        <button
                                            onClick={() => setBookingStep('planning')}
                                            className="text-[#00D68F] font-bold text-sm flex items-center gap-1 active:opacity-60"
                                        >
                                            <ArrowLeft size={16} /> Back
                                        </button>
                                        <h2 className="text-xl font-bold">Choose your ride</h2>
                                        <div className="w-10"></div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <h3 className="font-bold text-sm">Available Tiers</h3>
                                            <div className={`flex items-center gap-1 text-[10px] ${textSec}`}>
                                                <Info size={12} /> Min. fare D{minFare}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 px-1 snap-x">
                                            {tiers.map(t => {
                                                const isSelected = selectedTier === t.id;
                                                const price = calculatePrice(t.mult);
                                                return (
                                                    <div
                                                        key={t.id}
                                                        onClick={() => { triggerHaptic(); setSelectedTier(t.id); }}
                                                        className={`
                                                    relative min-w-[200px] h-[160px] p-5 rounded-3xl border-2 cursor-pointer transition-all duration-300 snap-start flex flex-col overflow-hidden
                                                    ${isSelected
                                                                ? 'border-[#00D68F] bg-[#00D68F]/10 scale-[1.02] shadow-xl ring-4 ring-[#00D68F]/20'
                                                                : 'border-transparent bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                            }
                                                `}
                                                    >
                                                        {/* Large Background Vehicle Image */}
                                                        <div className={`absolute -right-8 -bottom-4 w-40 h-40 transition-all duration-500 opacity-40 ${isSelected ? 'scale-125 opacity-100 translate-x-4' : 'scale-110'}`}>
                                                            {t.img ? (
                                                                <img
                                                                    src={t.img}
                                                                    className={`w-full h-full object-contain ${theme === 'light' ? 'mix-blend-multiply' : ''}`}
                                                                    alt={t.label}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                        const parent = (e.target as HTMLImageElement).parentElement;
                                                                        if (parent) {
                                                                            const iconPlaceholder = parent.querySelector('.icon-placeholder');
                                                                            if (iconPlaceholder) iconPlaceholder.classList.remove('hidden');
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                                                                    <t.icon size={80} strokeWidth={1} />
                                                                </div>
                                                            )}
                                                            <div className="icon-placeholder hidden w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                                                                <t.icon size={80} strokeWidth={1} />
                                                            </div>
                                                        </div>

                                                        {/* Text Content - Positioned Above Image */}
                                                        <div className="relative z-10 flex flex-col h-full pointer-events-none">
                                                            {isSelected && (
                                                                <div className="bg-[#00D68F] text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md self-start mb-2">
                                                                    SELECTED
                                                                </div>
                                                            )}
                                                            <div className={`font-black text-xl mb-0.5 ${isSelected ? (theme === 'light' ? 'text-black' : 'text-white') : 'text-gray-900 dark:text-white'}`}>{t.label}</div>
                                                            <div className={`text-xs font-bold mb-auto ${isSelected ? (theme === 'light' ? 'text-black/60' : 'text-white/60') : 'text-gray-500 dark:text-gray-400'}`}>{t.desc} • {t.time}</div>

                                                            <div className={`flex flex-col ${isSelected ? 'text-[#00D68F]' : 'text-gray-900 dark:text-white'}`}>
                                                                {user.referralBalance && user.referralBalance > 0 ? (
                                                                    <>
                                                                        <div className="text-[10px] line-through opacity-50 font-medium">D{calculatePrice(t.mult).originalPrice}</div>
                                                                        <div className="font-black text-2xl flex items-center gap-1 drop-shadow-sm">
                                                                            D{calculatePrice(t.mult).finalPrice}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="font-black text-2xl drop-shadow-sm">D{calculatePrice(t.mult).finalPrice}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className={`flex p-1 rounded-xl ${inputBg}`}>
                                            <button onClick={() => setRidePayMethod('wave')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${ridePayMethod === 'wave' ? 'bg-[#1E88E5] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Wave</button>
                                            <button onClick={() => setRidePayMethod('cash')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${ridePayMethod === 'cash' ? 'bg-[#00D68F] text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Cash</button>
                                        </div>

                                        <button
                                            onClick={confirmRide}
                                            disabled={!destinations[0]}
                                            className={`w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-xl disabled:opacity-50 disabled:shadow-none flex items-center justify-between px-6 active:scale-[0.98] transition-transform`}
                                        >
                                            <span>Book {tiers.find(t => t.id === selectedTier)?.label}</span>
                                            <div className="flex flex-col items-end">
                                                {user.referralBalance && user.referralBalance > 0 ? (
                                                    <>
                                                        <span className="text-xs line-through opacity-60">D{calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1).originalPrice}</span>
                                                        <span className="text-xl leading-none">D{calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1).finalPrice}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-xl">D{calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1).finalPrice}</span>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {(status === 'searching' || status === 'accepted' || status === 'arrived' || status === 'in-progress') && (
                        <div className="text-center py-4">
                            {status === 'searching' && <div className="w-16 h-16 border-4 border-[#00D68F] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>}

                            {(status === 'accepted' || status === 'arrived' || status === 'in-progress') && (
                                <div className="animate-scale-in px-2">
                                    <div className={`p-5 rounded-[24px] ${inputBg} shadow-sm mb-6`}>
                                        <div className="flex justify-between items-start mb-5">
                                            <div className="text-left">
                                                <div className="text-[#00D68F] font-bold text-3xl mb-1 tabular-nums">
                                                    {status === 'in-progress' ? 'On Trip' : (status === 'arrived' ? 'Arrived' : formatTime(etaSeconds))}
                                                </div>
                                                <div className={`${textSec} text-sm font-medium`}>
                                                    {status === 'in-progress' ? `Heading to ${destinations[0]}` : (status === 'arrived' ? 'Driver is waiting' : 'Estimated arrival')}
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <div className="w-16 h-16 rounded-full bg-[#00D68F]/10 flex items-center justify-center border-4 border-white dark:border-[#1C1C1E] shadow-md">
                                                    <User size={32} className="text-[#00D68F] opacity-50" />
                                                </div>
                                                <div className={`absolute -bottom-2 right-1 px-1.5 py-0.5 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-1 ${3.8 >= 4.5 ? 'bg-[#00D68F]/10 text-[#00D68F]' :
                                                    3.8 >= 3.0 ? 'bg-orange-500/10 text-orange-500' :
                                                        'bg-red-500/10 text-red-500'
                                                    }`}>
                                                    <Star size={10} fill="currentColor" />
                                                    <span className="text-[10px] font-black">3.8</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-px w-full bg-black/5 dark:bg-white/10 my-4"></div>
                                        {/* Searching State */}
                                        {status === 'searching' && (
                                            <div className="flex flex-col items-center py-6">
                                                <div className="w-20 h-20 relative mb-4">
                                                    <div className="absolute inset-0 bg-[#00D68F]/20 rounded-full animate-ping"></div>
                                                    <div className="absolute inset-0 bg-[#00D68F]/10 rounded-full animate-pulse"></div>
                                                    <div className="relative w-full h-full rounded-full border-4 border-white dark:border-gray-800 bg-cover bg-center overflow-hidden flex items-center justify-center">
                                                        {user.photo ? (
                                                            <img src={user.photo} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-2xl font-black text-[#00D68F]">{user.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <h3 className="text-xl font-bold mb-1">Finding your {rideType === 'delivery' ? 'courier' : 'driver'}...</h3>
                                                <p className={`${textSec} text-sm mb-6`}>What nearby {rideType === 'delivery' ? 'scooters' : 'drivers'} see:</p>

                                                <div className={`w-full ${inputBg} p-4 rounded-2xl flex items-center justify-between`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                                            <User size={18} className="text-[#00D68F]" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold">{user.name}</p>
                                                            <p className="text-[10px] uppercase font-black text-[#00D68F] tracking-widest">Customer</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20">
                                                        <Star size={14} fill="#FF9500" className="text-[#FF9500]" />
                                                        <span className="font-black">{user.rating.toFixed(1)}</span>
                                                    </div>
                                                </div>

                                                <div className="w-full mt-6 py-4 bg-white/5 rounded-2xl border border-dashed border-white/10 flex items-center justify-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#00D68F] animate-pulse"></div>
                                                    <span className="text-xs font-medium opacity-50">Broadcasting your request accurately</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#00D68F]/10 flex items-center justify-center text-[#00D68F]">
                                                    <Car size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold text-base">Toyota Prius</div>
                                                    <div className={`${textSec} text-xs font-medium`}>Silver • Sedan</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5">Plate</div>
                                                <div className="font-mono font-bold text-lg bg-white dark:bg-black/40 px-2 py-1 rounded-lg border border-black/5 dark:border-white/10">BJL 4229</div>
                                            </div>
                                        </div>
                                    </div>

                                    {status !== 'in-progress' && (
                                        <div className="flex gap-3">
                                            <a
                                                href={`tel:${assignedDriver?.phone || '+2201234567'}`}
                                                className={`flex-1 py-4 rounded-2xl ${theme === 'light' ? 'bg-white border border-gray-100' : 'bg-[#2C2C2E] border border-white/5'} font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all text-inherit no-underline`}
                                            >
                                                <Phone size={20} className="text-[#00D68F]" /> <span>Call</span>
                                            </a>
                                            <a
                                                href={`sms:${assignedDriver?.phone || '+2201234567'}`}
                                                className={`flex-1 py-4 rounded-2xl ${theme === 'light' ? 'bg-white border border-gray-100' : 'bg-[#2C2C2E] border border-white/5'} font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all text-inherit no-underline`}
                                            >
                                                <MessageSquare size={20} className="text-[#00D68F]" /> <span>Message</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {status === 'arrived' && <button onClick={startTrip} className="w-full bg-[#00D68F] text-black py-4 rounded-full font-bold shadow-lg mt-6">Start Trip</button>}

                            {status === 'in-progress' && (
                                <div className="mt-6 space-y-4">
                                    <div className="bg-[#00D68F]/10 p-4 rounded-xl flex items-center justify-center gap-2 text-[#00D68F] font-bold text-sm">
                                        <Navigation size={18} /> You are on your way
                                    </div>
                                    <button onClick={completeTrip} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-full font-bold shadow-lg">Complete Ride</button>
                                </div>
                            )}

                            {status === 'searching' && (
                                <>
                                    <h3 className="text-xl font-bold mb-1">Finding {rideType === 'delivery' ? 'courier' : 'driver'}...</h3>
                                    <p className={`${textSec} mb-6`}>Searching within {searchRadius}km radius</p>
                                    <button onClick={() => {
                                        if (searchInterval) clearInterval(searchInterval);
                                        setStatus('idle');
                                    }} className="text-red-500 font-bold">Cancel</button>
                                </>
                            )}

                            {(status === 'accepted' || status === 'arrived') && (
                                <button
                                    onClick={async () => {
                                        if (confirm("Are you sure you want to cancel? The driver is already on the way.")) {
                                            setStatus('idle');
                                            // Optional: update supabase if needed
                                            triggerHaptic();
                                        }
                                    }}
                                    className="w-full py-4 text-red-500 font-bold opacity-50 hover:opacity-100 transition-opacity"
                                >
                                    Cancel Ride
                                </button>
                            )}
                        </div>
                    )}

                    {status === 'review' && (
                        <div className="text-center animate-scale-in">
                            <h3 className="text-xl font-bold mb-4">How was your ride?</h3>
                            <p className={`${textSec} mb-6`}>Your feedback helps us improve.</p>
                            <div className="flex justify-center gap-3 mb-8">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button key={s} onClick={() => setRating(s)} className="active:scale-90 transition-transform">
                                        <Star size={40} className={s <= rating ? "text-orange-400 fill-orange-400" : "text-gray-300 dark:text-gray-700"} strokeWidth={s <= rating ? 0 : 2} />
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Leave a comment (optional)..."
                                className={`w-full p-4 rounded-2xl ${inputBg} mb-6 outline-none resize-none h-32 focus:ring-2 focus:ring-[#00D68F] transition-all`}
                            />
                            <button onClick={submitReview} className="w-full bg-[#00D68F] text-black py-4 rounded-full font-bold shadow-lg">Submit Review</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const darkMapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
    { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b1b1b" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
    { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
    { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
    { "featureType": "road.local", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];
