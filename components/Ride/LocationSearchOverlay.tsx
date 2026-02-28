import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, MapPin, X, Locate, Plus, Trash } from 'lucide-react';
import { Theme, UserData } from '../../types';
import { triggerHaptic } from '../../utils/helpers';

interface LocationSearchOverlayProps {
    theme: Theme;
    onClose: () => void;
    user: UserData;
    destinations: string[];
    updateDestination: (index: number, value: string) => void;
    addDestination: () => void;
    removeDestination: (index: number) => void;
    userLocation: { lat: number, lng: number } | null;
    calculateRouteAndPrice: () => Promise<boolean>;
    setBookingStep: (step: 'planning' | 'selecting') => void;
    handleLocateMe: (isInitial?: boolean, manualMap?: any) => Promise<void>;
}

export const LocationSearchOverlay: React.FC<LocationSearchOverlayProps> = ({
    theme,
    onClose,
    user,
    destinations,
    updateDestination,
    addDestination,
    removeDestination,
    userLocation,
    calculateRouteAndPrice,
    setBookingStep,
    handleLocateMe
}) => {
    const [activeInputIndex, setActiveInputIndex] = useState<number | null>(0);
    const [searchQueries, setSearchQueries] = useState<string[]>(destinations);
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const sessionToken = useRef<any>(null);
    const autocompleteService = useRef<any>(null);
    const geocoder = useRef<any>(null);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    // Sync external destinations to internal search queries if they change externally (mostly on mount)
    useEffect(() => {
        setSearchQueries(destinations);
    }, [destinations]);

    useEffect(() => {
        const google = (window as any).google;
        if (google) {
            if (!sessionToken.current) sessionToken.current = new google.maps.places.AutocompleteSessionToken();
            if (!autocompleteService.current) autocompleteService.current = new google.maps.places.AutocompleteService();
            if (!geocoder.current) geocoder.current = new google.maps.Geocoder();
        }
    }, []);

    const handleSearch = (val: string, index: number) => {
        const newQueries = [...searchQueries];
        newQueries[index] = val;
        setSearchQueries(newQueries);
        updateDestination(index, val);

        if (!val.trim()) {
            setPredictions([]);
            return;
        }

        // --- Plus Code Handling ---
        // Basic check if it looks like a plus code
        const isLikelyPlusCode = val.includes('+') && val.length > 5;

        if (autocompleteService.current && sessionToken.current && !isLikelyPlusCode) {
            setIsSearching(true);
            autocompleteService.current.getPlacePredictions({
                input: val,
                sessionToken: sessionToken.current,
                components: 'country:gm', // Biased to The Gambia
                locationBias: userLocation ? {
                    center: { lat: userLocation.lat, lng: userLocation.lng },
                    radius: 50000 // 50km
                } : undefined
            }, (results: any, status: string) => {
                setIsSearching(false);
                if (status === 'OK' && results) {
                    setPredictions(results);
                } else {
                    setPredictions([]);
                }
            });
        } else if (isLikelyPlusCode && geocoder.current) {
            // It's a plus code, try geocoding directly to give feedback if valid
            // We won't show it in autocomplete dropdown, but we will allow them to just 'Confirm' it later
            setPredictions([]);
        } else {
            setPredictions([]);
        }
    };

    const selectPrediction = (prediction: any) => {
        triggerHaptic();
        if (activeInputIndex === null) return;

        const description = prediction.structured_formatting?.main_text
            ? `${prediction.structured_formatting.main_text}, ${prediction.structured_formatting.secondary_text || ''}`
            : prediction.description;

        const newQueries = [...searchQueries];
        newQueries[activeInputIndex] = description;
        setSearchQueries(newQueries);
        updateDestination(activeInputIndex, description);
        setPredictions([]);

        // Move to next empty input or keep active if it's the last one and filled
        const nextEmptyIndex = searchQueries.findIndex((q, idx) => idx > activeInputIndex && !q.trim());
        if (nextEmptyIndex !== -1) {
            setActiveInputIndex(nextEmptyIndex);
        } else if (activeInputIndex < destinations.length - 1) {
            setActiveInputIndex(activeInputIndex + 1);
        } else {
            // Close predictions if we're on the last input
            setActiveInputIndex(null);
        }

        // Renew token after a selection
        const google = (window as any).google;
        if (google) {
            sessionToken.current = new google.maps.places.AutocompleteSessionToken();
        }
    };

    const handleConfirm = async () => {
        triggerHaptic();

        // Basic validation - check if at least one destination is not empty
        const validDestinations = destinations.filter(d => d.trim() !== '');
        if (validDestinations.length === 0) return;

        // If user typed a Plus Code or an address and didn't select from the dropdown,
        // it's already recorded in `destinations` via `handleSearch` and `updateDestination`.
        // The RideScreen's calculateRouteAndPrice uses the Google Directions API which handles
        // Geocoding (including Plus Codes) automatically under the hood for those string destinations.

        // We close the overlay and let the parent handle calculating the route visually
        onClose();
        setBookingStep('selecting');
        await calculateRouteAndPrice();
    };

    return (
        <div className={`fixed inset-0 z-[100] bg-white/10 dark:bg-black/20 backdrop-blur-md ${textMain} flex flex-col animate-slide-in-up`}>
            {/* Header */}
            <div className={`pt-safe px-4 pb-4 flex items-center gap-4 bg-white/60 dark:bg-black/60 backdrop-blur-xl shadow-sm z-10 sticky top-0`}>
                <button onClick={() => { triggerHaptic(); onClose(); }} className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}>
                    <ArrowLeft size={24} className="text-black dark:text-white" />
                </button>
                <h1 className="text-xl font-bold flex-1 text-center pr-10 text-black dark:text-white">Where to?</h1>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                {/* Inputs Area */}
                <div className="bg-white/40 dark:bg-black/40 backdrop-blur-xl p-6 shadow-sm">
                    <div className="space-y-4">
                        <div className="relative flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#00D68F]/10 flex items-center justify-center flex-shrink-0">
                                <Locate size={18} className="text-[#00D68F]" onClick={() => handleLocateMe(false)} />
                            </div>
                            <div className={`flex-1 p-4 rounded-xl ${inputBg} bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-md font-medium text-sm ${textSec} flex items-center justify-between`}>
                                <span className="text-black dark:text-white/70">Current Location</span>
                            </div>
                        </div>

                        {destinations.map((dest, idx) => (
                            <div key={idx} className="relative flex flex-col gap-1 items-start w-full">
                                <div className="relative flex items-center gap-3 w-full">
                                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                        <MapPin size={20} className="text-red-500" />
                                    </div>
                                    <div className={`flex-1 flex items-center gap-2 p-3 rounded-xl ${inputBg} ${activeInputIndex === idx ? 'ring-2 ring-[#00D68F] bg-white dark:bg-[#1C1C1E]' : 'bg-white/60 dark:bg-[#1C1C1E]/60'} backdrop-blur-md transition-all shadow-sm`}>
                                        <Search size={16} className={`${textSec} ml-1`} />
                                        <input
                                            placeholder={
                                                idx === destinations.length - 1
                                                    ? "Enter destination or Plus Code"
                                                    : `Stop ${idx + 1}`
                                            }
                                            className="bg-transparent outline-none flex-1 font-bold text-base h-8 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                            value={searchQueries[idx] || ''}
                                            onChange={(e) => handleSearch(e.target.value, idx)}
                                            onFocus={() => setActiveInputIndex(idx)}
                                            autoFocus={idx === 0}
                                        />
                                        {dest.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    updateDestination(idx, '');
                                                    const newQueries = [...searchQueries];
                                                    newQueries[idx] = '';
                                                    setSearchQueries(newQueries);
                                                    setPredictions([]);
                                                }}
                                                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                            >
                                                <X size={16} className="opacity-50" />
                                            </button>
                                        )}
                                        {destinations.length > 1 && (
                                            <button onClick={() => {
                                                removeDestination(idx);
                                                const newQueries = searchQueries.filter((_, i) => i !== idx);
                                                setSearchQueries(newQueries);
                                                if (activeInputIndex === idx) setActiveInputIndex(Math.max(0, idx - 1));
                                            }} className="p-1.5 ml-1 bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 transition-colors">
                                                <Trash size={16} className="text-red-500 opacity-80" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="relative flex items-center gap-3 pt-2">
                            <div className="w-10 flex justify-center"><Plus size={18} className="text-[#00D68F]" /></div>
                            <button onClick={() => {
                                addDestination();
                                setSearchQueries([...searchQueries, '']);
                                setActiveInputIndex(destinations.length); // The new one
                            }} className="text-base font-bold text-[#00D68F] active:opacity-60">Add Stop</button>
                        </div>
                    </div>
                </div>

                {/* Predictions Area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 bg-transparent">
                    {activeInputIndex !== null && predictions.length > 0 ? (
                        <div className="space-y-2">
                            {predictions.map((p: any) => (
                                <button
                                    key={p.place_id}
                                    onClick={() => selectPrediction(p)}
                                    className={`w-full p-4 text-left ${bgCard} rounded-2xl shadow-sm hover:shadow-md border border-transparent dark:border-white/5 flex items-start gap-4 active:scale-[0.98] transition-all`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#00D68F]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <MapPin size={20} className="text-[#00D68F]" />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0 justify-center min-h-[40px]">
                                        <span className="font-bold text-base truncate">{p.structured_formatting?.main_text || p.description}</span>
                                        {p.structured_formatting?.secondary_text && (
                                            <span className={`text-xs ${textSec} truncate mt-0.5`}>{p.structured_formatting.secondary_text}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        searchQueries[activeInputIndex ?? 0]?.length > 0 && !isSearching && (
                            <div className={`text-center py-10 ${textSec}`}>
                                <MapPin size={32} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-sm">No results found.</p>
                                <p className="text-xs mt-1">Try entering a Plus Code if you have one!</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Footer Action */}
            <div className={`p-6 bg-white/80 dark:bg-black/80 backdrop-blur-2xl pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-gray-100 dark:border-gray-800`}>
                <button
                    onClick={handleConfirm}
                    disabled={!destinations.some(d => d.trim() !== '')}
                    className="w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                    Confirm Route
                </button>
            </div>
        </div>
    );
};
