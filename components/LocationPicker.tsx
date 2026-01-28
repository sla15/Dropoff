
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Map as MapIcon, Locate, X, ArrowRight, Loader2 } from 'lucide-react';
import { Theme } from '../types';
import { triggerHaptic } from '../index';

// Helper for generating standard UUID tokens
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface Props {
    theme: Theme;
    onConfirm: (location: { address: string; lat: number; lng: number }) => void;
    onClose: () => void;
    title?: string;
    initialLocation?: { lat: number; lng: number };
}

export const LocationPicker = ({ theme, onConfirm, onClose, title = "Select Location", initialLocation }: Props) => {
    const [address, setAddress] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [map, setMap] = useState<any>(null);
    const [marker, setMarker] = useState<any>(null);
    const [sessionToken, setSessionToken] = useState<any>(null);
    const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(initialLocation || null);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const searchTimeout = useRef<any>(null);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    useEffect(() => {
        if ((window as any).google && mapContainerRef.current) {
            initMap();
        } else {
            const checkInterval = setInterval(() => {
                if ((window as any).google && mapContainerRef.current) {
                    initMap();
                    clearInterval(checkInterval);
                }
            }, 100);
        }
        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, []);

    const initMap = () => {
        const google = (window as any).google;
        const center = initialLocation || { lat: 13.4432, lng: -16.6322 }; // Banjul default

        const newMap = new google.maps.Map(mapContainerRef.current, {
            center,
            zoom: 15,
            disableDefaultUI: true,
            styles: theme === 'dark' ? darkMapStyle : []
        });

        const newMarker = new google.maps.Marker({
            position: center,
            map: newMap,
            draggable: true,
            icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 8,
                fillColor: "#00D68F",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#FFFFFF",
            }
        });

        newMarker.addListener('dragend', () => {
            const pos = newMarker.getPosition();
            const coords = { lat: pos.lat(), lng: pos.lng() };
            setSelectedCoords(coords);
            reverseGeocode(coords);
        });

        newMap.addListener('click', (e: any) => {
            const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            newMarker.setPosition(coords);
            setSelectedCoords(coords);
            reverseGeocode(coords);
        });

        setMap(newMap);
        setMarker(newMarker);
    };

    const startNewSession = () => {
        if (!sessionToken) {
            setSessionToken(generateUUID());
            console.log("Maps: Started new search session");
        }
    };

    const reverseGeocode = (coords: { lat: number; lng: number }) => {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: coords }, (results: any, status: string) => {
            if (status === 'OK' && results[0]) {
                setAddress(results[0].formatted_address);
            }
        });
    };

    const handleSearch = (val: string) => {
        setAddress(val);
        if (!val || val.length < 3) {
            setPredictions([]);
            return;
        }

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            const google = (window as any).google;
            if (!google) return;

            const service = new google.maps.places.AutocompleteService();
            service.getPlacePredictions({
                input: val,
                sessionToken,
                componentRestrictions: { country: 'gm' } // Restrict to Gambia
            }, (preds: any) => {
                setPredictions(preds || []);
            });
        }, 500); // Increased debounce to 500ms
    };

    const selectPrediction = (pred: any) => {
        const google = (window as any).google;
        if (!google) return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ placeId: pred.place_id }, (results: any, status: string) => {
            if (status === 'OK' && results[0]) {
                const loc = results[0].geometry.location;
                const coords = { lat: loc.lat(), lng: loc.lng() };

                map.panTo(loc);
                marker.setPosition(loc);
                setSelectedCoords(coords);
                setAddress(results[0].formatted_address);
                setPredictions([]);

                // Discard session token after successful selection to save cost
                setSessionToken(null);
            }
        });
    };

    const useCurrentLocation = () => {
        setLoading(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                map.panTo(coords);
                marker.setPosition(coords);
                setSelectedCoords(coords);
                reverseGeocode(coords);
                setLoading(false);
            }, () => setLoading(false));
        } else {
            setLoading(false);
        }
    };

    const darkMapStyle = [
        { elementType: 'geometry', stylers: [{ color: '#212121' }] },
        { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
        { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
        { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
        { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
        { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
        { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
        { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
        { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
        { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
        { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
        { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
    ];

    return (
        <div className={`fixed inset-0 z-50 flex flex-col ${bgMain} animate-slide-up`}>
            <div className={`pt-safe px-6 pb-4 flex items-center justify-between z-10 ${bgCard} border-b border-gray-100 dark:border-gray-800`}>
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className={`w-10 h-10 rounded-full ${inputBg} flex items-center justify-center`}>
                        <X size={20} />
                    </button>
                    <h2 className="text-xl font-bold">{title}</h2>
                </div>
                <button
                    disabled={!selectedCoords || !address}
                    onClick={() => selectedCoords && onConfirm({ address, ...selectedCoords })}
                    className="text-[#00D68F] font-bold disabled:opacity-30"
                >
                    Confirm
                </button>
            </div>

            <div className="relative flex-1">
                <div ref={mapContainerRef} className="absolute inset-0 z-0" />

                <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
                    <div className={`flex items-center gap-3 p-4 rounded-2xl ${bgCard} shadow-xl border border-gray-100 dark:border-gray-800`}>
                        <Search size={20} className={textSec} />
                        <input
                            placeholder="Search address..."
                            value={address}
                            onFocus={startNewSession}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="flex-1 bg-transparent outline-none font-medium text-sm"
                        />
                        {loading && <Loader2 size={16} className="animate-spin text-[#00D68F]" />}
                    </div>

                    {predictions.length > 0 && (
                        <div className={`rounded-2xl ${bgCard} shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800`}>
                            {predictions.map(p => (
                                <div
                                    key={p.place_id}
                                    onClick={() => selectPrediction(p)}
                                    className="p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 active:bg-gray-50 dark:active:bg-white/5 cursor-pointer"
                                >
                                    <div className="font-bold text-sm">{p.structured_formatting.main_text}</div>
                                    <div className={`text-xs ${textSec} truncate`}>{p.structured_formatting.secondary_text}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    onClick={useCurrentLocation}
                    className="absolute bottom-24 right-6 w-14 h-14 bg-[#00D68F] text-black rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-10"
                >
                    <Locate size={24} />
                </button>

                <div className="absolute bottom-10 left-6 right-6 z-10 pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full text-xs font-medium inline-flex items-center gap-2 shadow-2xl">
                        <MapPin size={14} className="text-[#00D68F]" />
                        Drag the marker to pick the exact spot
                    </div>
                </div>
            </div>
        </div>
    );
};
