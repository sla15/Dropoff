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
    onSelectPrediction
}) => {
    const [activeInputIndex, setActiveInputIndex] = useState<number | null>(0);
    const [searchQueries, setSearchQueries] = useState<string[]>(destinations);
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const sessionToken = useRef<any>(null);
    const autocompleteService = useRef<any>(null);
    const geocoder = useRef<any>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const scrollBodyRef = useRef<HTMLDivElement>(null);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-white' : 'bg-[#1C1C1E]';
    const bgHeader = theme === 'light' ? '#FFFFFF' : '#1C1C1E';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    useEffect(() => {
        setSearchQueries(destinations);
    }, [destinations]);

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
        }).catch(() => {});
        return () => {
            mounted = false;
            import('@capacitor/keyboard').then(({ Keyboard }) => {
                Keyboard.removeAllListeners();
            }).catch(() => {});
        };
    }, []);

    useEffect(() => {
        if (keyboardHeight > 0 && activeInputIndex !== null) {
            const input = inputRefs.current[activeInputIndex];
            if (input) {
                setTimeout(() => {
                    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            }
        }
    }, [keyboardHeight, activeInputIndex]);

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

        const isLikelyPlusCode = val.includes('+') && val.length > 5;

        if (autocompleteService.current && sessionToken.current && !isLikelyPlusCode) {
            setIsSearching(true);
            autocompleteService.current.getPlacePredictions({
                input: val,
                sessionToken: sessionToken.current,
                componentRestrictions: { country: ['gm', 'sn', 'gw', 'gn'] },
                locationBias: {
                    center: { lat: 13.4432, lng: -15.3101 },
                    radius: 100000
                }
            }, (results: any, status: string) => {
                setIsSearching(false);
                if (status === 'OK' && results) {
                    setPredictions(results);
                } else {
                    setPredictions([]);
                }
            });
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

        const nextEmptyIndex = searchQueries.findIndex((q, idx) => idx > activeInputIndex && !q.trim());
        if (nextEmptyIndex !== -1) {
            setActiveInputIndex(nextEmptyIndex);
        } else if (activeInputIndex < destinations.length - 1) {
            setActiveInputIndex(activeInputIndex + 1);
        } else {
            setActiveInputIndex(null);
        }

        const google = (window as any).google;
        if (google) {
            sessionToken.current = new google.maps.places.AutocompleteSessionToken();
        }

        if (onSelectPrediction) {
            onSelectPrediction(prediction);
        }
    };

    const handleConfirm = async () => {
        triggerHaptic();
        const validDestinations = destinations.filter(d => d.trim() !== '');
        if (validDestinations.length === 0) return;
        onClose();
        setBookingStep('selecting');
        await calculateRouteAndPrice();
    };

    const hasValidDestination = destinations.some(d => d.trim() !== '');
    const bodyStyle: React.CSSProperties = keyboardHeight > 0
        ? { height: `calc(100vh - 64px - ${keyboardHeight}px)`, overflowY: 'auto' }
        : { flex: 1, overflowY: 'auto' };

    return (
        <div
            className={`fixed inset-0 z-[100] flex flex-col ${textMain} animate-slide-in-up`}
            style={{ backgroundColor: bgHeader }}
        >
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

                <h1 className={`text-lg font-bold flex-1 ${theme === 'light' ? 'text-black' : 'text-white'}`}>Where to?</h1>

                <button
                    onClick={handleConfirm}
                    disabled={!hasValidDestination}
                    className="bg-[#00D68F] text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
                >
                    Confirm
                </button>
            </div>

            <div
                ref={scrollBodyRef}
                style={bodyStyle}
                className="min-h-0"
            >
                <div
                    className="p-5 pb-3 shadow-sm"
                    style={{ backgroundColor: bgHeader }}
                >
                    <div className="space-y-3">
                        <div className="relative flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#00D68F]/10 flex items-center justify-center flex-shrink-0">
                                <Locate size={18} className="text-[#00D68F]" onClick={() => handleLocateMe(false)} />
                            </div>
                            <div className={`flex-1 p-3.5 rounded-xl ${inputBg} font-medium text-sm ${textSec} flex items-center`}>
                                <span className={theme === 'light' ? 'text-black/70' : 'text-white/60'}>Current Location</span>
                            </div>
                        </div>

                        {destinations.map((dest, idx) => (
                            <div key={idx} className="relative flex items-center gap-3 w-full">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                    <MapPin size={20} className="text-red-500" />
                                </div>
                                <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all shadow-sm ${
                                    activeInputIndex === idx
                                        ? `ring-2 ring-[#00D68F] ${theme === 'light' ? 'bg-white' : 'bg-[#2C2C2E]'}`
                                        : inputBg
                                }`}>
                                    <Search size={15} className={`${textSec} ml-1 flex-shrink-0`} />
                                    <input
                                        ref={el => { inputRefs.current[idx] = el; }}
                                        placeholder={idx === destinations.length - 1 ? 'Enter destination or Plus Code' : `Stop ${idx + 1}`}
                                        className={`bg-transparent outline-none flex-1 font-bold text-base h-8 ${theme === 'light' ? 'text-black placeholder:text-gray-400' : 'text-white placeholder:text-gray-500'}`}
                                        value={searchQueries[idx] || ''}
                                        onChange={e => handleSearch(e.target.value, idx)}
                                        onFocus={() => setActiveInputIndex(idx)}
                                        autoFocus={idx === 0}
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
                                                setPredictions([]);
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
                                                if (activeInputIndex === idx) setActiveInputIndex(Math.max(0, idx - 1));
                                            }}
                                            className="p-1.5 ml-1 bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 transition-colors flex-shrink-0"
                                        >
                                            <Trash size={15} className="text-red-500 opacity-80" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="flex items-center gap-3 pt-1 pl-1">
                            <div className="w-10 flex justify-center"><Plus size={18} className="text-[#00D68F]" /></div>
                            <button
                                onClick={() => {
                                    addDestination();
                                    setSearchQueries([...searchQueries, '']);
                                    setActiveInputIndex(destinations.length);
                                }}
                                className="text-base font-bold text-[#00D68F] active:opacity-60"
                            >
                                Add Stop
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`px-4 py-3 ${bgMain}`}>
                    {activeInputIndex !== null && predictions.length > 0 ? (
                        <div className="space-y-2">
                            {predictions.map((p: any) => (
                                <button
                                    key={p.place_id}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => selectPrediction(p)}
                                    className={`w-full p-4 text-left ${bgCard} rounded-2xl shadow-sm border ${theme === 'light' ? 'border-black/5' : 'border-white/5'} flex items-start gap-4 active:scale-[0.98] transition-all`}
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
        </div>
    );
};
