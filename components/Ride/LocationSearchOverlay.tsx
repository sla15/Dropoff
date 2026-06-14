import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, MapPin, X, Locate, Plus, Trash } from 'lucide-react';
import { Theme, UserData } from '../../types';
import { triggerHaptic } from '../../utils/helpers';
import { Capacitor } from '@capacitor/core';

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
    onSelectPrediction?: (prediction: any) => void;
    // Pickup
    pickupLocation?: string;
    onPickupSelected?: (address: string, coords: { lat: number; lng: number }) => void;
    // Initial focus
    initialFocus?: 'pickup' | 'destination';
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
    handleLocateMe,
    onSelectPrediction,
    pickupLocation,
    onPickupSelected,
    initialFocus = 'destination',
}) => {
    // Which field is currently active
    const [focusedField, setFocusedField] = useState<'pickup' | 'destination'>(initialFocus);
    const [activeDestIdx, setActiveDestIdx] = useState<number>(0);

    // Destination search
    const [searchQueries, setSearchQueries] = useState<string[]>(destinations);
    const [destPredictions, setDestPredictions] = useState<any[]>([]);
    const [isDestSearching, setIsDestSearching] = useState(false);

    // Pickup search
    const [pickupQuery, setPickupQuery] = useState('');
    const [pickupPredictions, setPickupPredictions] = useState<any[]>([]);
    const [isPickupSearching, setIsPickupSearching] = useState(false);

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const sessionToken = useRef<any>(null);
    const autocompleteService = useRef<any>(null);
    const geocoder = useRef<any>(null);
    const destInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const pickupInputRef = useRef<HTMLInputElement>(null);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-white' : 'bg-[#1C1C1E]';
    const bgHeader = theme === 'light' ? '#FFFFFF' : '#1C1C1E';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    // Sync destinations into local query state when they change externally
    useEffect(() => {
        setSearchQueries(destinations);
    }, [destinations]);

    // Google Maps services
    useEffect(() => {
        const google = (window as any).google;
        if (google) {
            if (!sessionToken.current) sessionToken.current = new google.maps.places.AutocompleteSessionToken();
            if (!autocompleteService.current) autocompleteService.current = new google.maps.places.AutocompleteService();
            if (!geocoder.current) geocoder.current = new google.maps.Geocoder();
        }
    }, []);

    // Auto-focus the right input when focusedField changes
    useEffect(() => {
        setTimeout(() => {
            if (focusedField === 'pickup') {
                pickupInputRef.current?.focus();
            } else {
                destInputRefs.current[activeDestIdx]?.focus();
            }
        }, 80);
    }, [focusedField]);

    // Keyboard height handling
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        let mounted = true;
        import('@capacitor/keyboard').then(({ Keyboard }) => {
            Keyboard.addListener('keyboardWillShow', (info) => {
                if (mounted) setKeyboardHeight(info.keyboardHeight);
            });
            Keyboard.addListener('keyboardWillHide', () => {
                if (mounted) setKeyboardHeight(0);
            });
        }).catch(() => { });
        return () => {
            mounted = false;
            import('@capacitor/keyboard').then(({ Keyboard }) => {
                Keyboard.removeAllListeners();
            }).catch(() => { });
        };
    }, []);

    // ── Destination search ──────────────────────────────────────────
    const handleDestSearch = (val: string, index: number) => {
        const newQueries = [...searchQueries];
        newQueries[index] = val;
        setSearchQueries(newQueries);
        updateDestination(index, val);

        if (!val.trim()) { setDestPredictions([]); return; }

        const isLikelyPlusCode = val.includes('+') && val.length > 5;
        if (autocompleteService.current && sessionToken.current && !isLikelyPlusCode) {
            setIsDestSearching(true);
            autocompleteService.current.getPlacePredictions({
                input: val,
                sessionToken: sessionToken.current,
                componentRestrictions: { country: ['gm', 'sn', 'gw', 'gn'] },
                locationBias: { center: { lat: 13.4432, lng: -15.3101 }, radius: 100000 }
            }, (results: any, status: string) => {
                setIsDestSearching(false);
                setDestPredictions(status === 'OK' && results ? results : []);
            });
        } else {
            setDestPredictions([]);
        }
    };

    const selectDestPrediction = (prediction: any) => {
        triggerHaptic();
        const description = prediction.structured_formatting?.main_text
            ? `${prediction.structured_formatting.main_text}, ${prediction.structured_formatting.secondary_text || ''}`
            : prediction.description;

        const newQueries = [...searchQueries];
        newQueries[activeDestIdx] = description;
        setSearchQueries(newQueries);
        updateDestination(activeDestIdx, description);
        setDestPredictions([]);

        const google = (window as any).google;
        if (google) sessionToken.current = new google.maps.places.AutocompleteSessionToken();

        if (onSelectPrediction) onSelectPrediction(prediction);

        // Move to next empty destination
        const nextEmpty = destinations.findIndex((q, idx) => idx > activeDestIdx && !q.trim());
        if (nextEmpty !== -1) {
            setActiveDestIdx(nextEmpty);
        } else {
            setActiveDestIdx(activeDestIdx);
        }
    };

    // ── Pickup search ───────────────────────────────────────────────
    const handlePickupSearch = (val: string) => {
        setPickupQuery(val);
        if (!val.trim()) { setPickupPredictions([]); return; }
        if (autocompleteService.current && sessionToken.current) {
            setIsPickupSearching(true);
            autocompleteService.current.getPlacePredictions({
                input: val,
                sessionToken: sessionToken.current,
                componentRestrictions: { country: ['gm', 'sn', 'gw', 'gn'] },
                locationBias: { center: { lat: 13.4432, lng: -15.3101 }, radius: 100000 }
            }, (results: any, status: string) => {
                setIsPickupSearching(false);
                setPickupPredictions(status === 'OK' && results ? results : []);
            });
        }
    };

    const selectPickupPrediction = (prediction: any) => {
        triggerHaptic();
        if (!geocoder.current) return;
        const description = prediction.structured_formatting?.main_text
            ? `${prediction.structured_formatting.main_text}, ${prediction.structured_formatting.secondary_text || ''}`
            : prediction.description;
        geocoder.current.geocode({ placeId: prediction.place_id }, (results: any, status: string) => {
            if (status === 'OK' && results[0]) {
                const loc = results[0].geometry.location;
                onPickupSelected?.(description, { lat: loc.lat(), lng: loc.lng() });
                setPickupQuery('');
                setPickupPredictions([]);
                // Switch back to destination focus after picking
                setFocusedField('destination');
            }
        });
    };

    const useCurrentLocationAsPickup = () => {
        triggerHaptic();
        if (!userLocation) return;
        handleLocateMe(false);
        onPickupSelected?.('Current Location', userLocation);
        setPickupQuery('');
        setPickupPredictions([]);
        setFocusedField('destination');
    };

    // ── Confirm ─────────────────────────────────────────────────────
    const handleConfirm = async () => {
        triggerHaptic();
        const valid = destinations.filter(d => d.trim() !== '');
        if (valid.length === 0) return;
        onClose();
        setBookingStep('selecting');
        await calculateRouteAndPrice();
    };

    const hasValidDestination = destinations.some(d => d.trim() !== '');

    const bodyStyle: React.CSSProperties = keyboardHeight > 0
        ? { height: `calc(100vh - 64px - ${keyboardHeight}px)`, overflowY: 'auto' }
        : { flex: 1, overflowY: 'auto' };

    // Which predictions to show in the scrollable area
    const showPickupPreds = focusedField === 'pickup';
    const activePredictions = showPickupPreds ? pickupPredictions : destPredictions;
    const isSearching = showPickupPreds ? isPickupSearching : isDestSearching;
    const activeQuery = showPickupPreds ? pickupQuery : (searchQueries[activeDestIdx] || '');

    return (
        <div
            className={`fixed inset-0 z-[100] flex flex-col ${textMain} animate-slide-in-up`}
            style={{ backgroundColor: bgHeader }}
        >
            {/* ── Header ── */}
            <div
                className="flex-shrink-0 pt-safe flex items-center gap-3 px-4 pb-3 shadow-sm z-10"
                style={{ backgroundColor: bgHeader }}
            >
                <button
                    onClick={() => { triggerHaptic(); onClose(); }}
                    className={`p-2 rounded-full ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/10'} transition-colors flex-shrink-0`}
                >
                    <ArrowLeft size={24} className={theme === 'light' ? 'text-black' : 'text-white'} />
                </button>

                <h1 className={`text-lg font-bold flex-1 ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                    {focusedField === 'pickup' ? 'Set pickup location' : 'Where to?'}
                </h1>

                <button
                    onClick={handleConfirm}
                    disabled={!hasValidDestination}
                    className="bg-[#00D68F] text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
                >
                    Confirm
                </button>
            </div>

            {/* ── Input rows (always visible) ── */}
            <div
                className="flex-shrink-0 px-4 pt-3 pb-3 space-y-2.5 shadow-sm"
                style={{ backgroundColor: bgHeader }}
            >
                {/* ── Pickup row ── */}
                <div className="flex items-center gap-3">
                    {/* GPS locate icon */}
                    <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={useCurrentLocationAsPickup}
                        disabled={!userLocation}
                        className="w-10 h-10 rounded-full bg-[#00D68F]/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform disabled:opacity-40"
                    >
                        <Locate size={18} className="text-[#00D68F]" />
                    </button>
                    {focusedField === 'pickup' ? (
                        /* Expanded pickup search input */
                        <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl ring-2 ring-[#00D68F] transition-all ${theme === 'light' ? 'bg-white' : 'bg-[#2C2C2E]'}`}>
                            <Search size={15} className={`${textSec} flex-shrink-0`} />
                            <input
                                ref={pickupInputRef}
                                placeholder="Search pickup location..."
                                className={`bg-transparent outline-none flex-1 font-bold text-base h-8 ${theme === 'light' ? 'text-black placeholder:text-gray-400' : 'text-white placeholder:text-gray-500'}`}
                                value={pickupQuery}
                                onChange={e => handlePickupSearch(e.target.value)}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                            {pickupQuery.length > 0 && (
                                <button onMouseDown={e => e.preventDefault()} onClick={() => { setPickupQuery(''); setPickupPredictions([]); }}>
                                    <X size={15} className="opacity-50" />
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Collapsed pickup display — tap to focus */
                        <button
                            onClick={() => { triggerHaptic(); setFocusedField('pickup'); }}
                            className={`flex-1 p-3.5 rounded-xl ${inputBg} text-sm text-left flex items-center justify-between active:scale-[0.98] transition-all`}
                        >
                            <span className={`truncate font-medium ${pickupLocation && pickupLocation !== 'Current Location' ? (theme === 'light' ? 'text-black' : 'text-white') : textSec}`}>
                                {pickupLocation || 'Current Location'}
                            </span>
                            <span className="text-xs text-[#00D68F] font-bold ml-2 flex-shrink-0">Change</span>
                        </button>
                    )}
                </div>

                {/* Thin connector line */}
                <div className="ml-[18px] w-0.5 h-3 bg-[#00D68F]/30 rounded-full" />

                {/* ── Destination rows ── */}
                {destinations.map((dest, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                            <MapPin size={20} className="text-red-500" />
                        </div>
                        <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all ${focusedField === 'destination' && activeDestIdx === idx
                                ? `ring-2 ring-[#00D68F] ${theme === 'light' ? 'bg-white' : 'bg-[#2C2C2E]'}`
                                : inputBg
                            }`}>
                            <Search size={15} className={`${textSec} flex-shrink-0`} />
                            <input
                                ref={el => { destInputRefs.current[idx] = el; }}
                                placeholder={idx === destinations.length - 1 ? 'Enter destination or Plus Code' : `Stop ${idx + 1}`}
                                className={`bg-transparent outline-none flex-1 font-bold text-base h-8 ${theme === 'light' ? 'text-black placeholder:text-gray-400' : 'text-white placeholder:text-gray-500'}`}
                                value={searchQueries[idx] || ''}
                                onChange={e => handleDestSearch(e.target.value, idx)}
                                onFocus={() => { setFocusedField('destination'); setActiveDestIdx(idx); }}
                                autoFocus={initialFocus === 'destination' && idx === 0}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                            {dest.length > 0 && (
                                <button
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                        updateDestination(idx, '');
                                        const q = [...searchQueries];
                                        q[idx] = '';
                                        setSearchQueries(q);
                                        setDestPredictions([]);
                                    }}
                                    className={`p-1.5 rounded-full ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'} transition-colors flex-shrink-0`}
                                >
                                    <X size={15} className="opacity-50" />
                                </button>
                            )}
                            {destinations.length > 1 && (
                                <button
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                        removeDestination(idx);
                                        const q = searchQueries.filter((_, i) => i !== idx);
                                        setSearchQueries(q);
                                        if (activeDestIdx === idx) setActiveDestIdx(Math.max(0, idx - 1));
                                    }}
                                    className="p-1.5 ml-1 bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 transition-colors flex-shrink-0"
                                >
                                    <Trash size={15} className="text-red-500 opacity-80" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {/* Add stop */}
                <div className="flex items-center gap-3 pt-0.5 pl-1">
                    <div className="w-10 flex justify-center"><Plus size={18} className="text-[#00D68F]" /></div>
                    <button
                        onClick={() => {
                            addDestination();
                            setSearchQueries([...searchQueries, '']);
                            setActiveDestIdx(destinations.length);
                            setFocusedField('destination');
                        }}
                        className="text-base font-bold text-[#00D68F] active:opacity-60"
                    >
                        Add Stop
                    </button>
                </div>
            </div>

            {/* ── Predictions / results area ── */}
            <div ref={undefined} style={bodyStyle} className={`min-h-0 ${bgMain}`}>
                <div className="px-4 py-3">
                    {/* Current location shortcut — only shown while pickup is focused */}
                    {focusedField === 'pickup' && (
                        <button
                            onClick={useCurrentLocationAsPickup}
                            disabled={!userLocation}
                            className={`w-full flex items-center gap-3 p-3.5 rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-[#1C1C1E]'} mb-3 active:scale-[0.98] transition-all disabled:opacity-40 shadow-sm border ${theme === 'light' ? 'border-black/5' : 'border-white/5'}`}
                        >
                            <div className="w-10 h-10 rounded-full bg-[#00D68F]/10 flex items-center justify-center flex-shrink-0">
                                <Locate size={18} className="text-[#00D68F]" />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className={`font-bold text-sm ${theme === 'light' ? 'text-black' : 'text-white'}`}>Use my current location</span>
                                <span className={`text-xs ${textSec}`}>GPS position</span>
                            </div>
                        </button>
                    )}

                    {activePredictions.length > 0 ? (
                        <div className="space-y-2">
                            {activePredictions.map((p: any) => (
                                <button
                                    key={p.place_id}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => showPickupPreds ? selectPickupPrediction(p) : selectDestPrediction(p)}
                                    className={`w-full p-4 text-left ${bgCard} rounded-2xl shadow-sm border ${theme === 'light' ? 'border-black/5' : 'border-white/5'} flex items-start gap-4 active:scale-[0.98] transition-all`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${showPickupPreds ? 'bg-[#00D68F]/10' : 'bg-red-500/10'}`}>
                                        <MapPin size={20} className={showPickupPreds ? 'text-[#00D68F]' : 'text-red-500'} />
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
                        activeQuery.length > 0 && !isSearching && (
                            <div className={`text-center py-10 ${textSec}`}>
                                <MapPin size={32} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-sm">No results found.</p>
                                {focusedField === 'destination' && (
                                    <p className="text-xs mt-1">Try entering a Plus Code if you have one!</p>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
