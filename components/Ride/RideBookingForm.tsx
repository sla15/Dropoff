import { ArrowLeft, ArrowRight, Locate, MapPin as MapPinFilled, Plus, Trash, X, Info, Car, Bike } from 'lucide-react';
import { Theme, UserData, AppSettings } from '../../types';
import { Skeleton } from '../Skeleton';

interface RideBookingFormProps {
    theme: Theme;
    user: UserData;
    bookingStep: 'planning' | 'selecting';
    setBookingStep: (step: 'planning' | 'selecting') => void;
    rideType: 'ride' | 'delivery';
    setRideType: (type: 'ride' | 'delivery') => void;
    destinations: string[];
    updateDestination: (index: number, value: string) => void;
    addDestination: () => void;
    removeDestination: (index: number) => void;
    handleSearch: (val: string, index: number) => void;
    predictions: any[];
    selectPrediction: (prediction: any) => void;
    activeInputIndex: number | null;
    setActiveInputIndex: (index: number | null) => void;
    isCalculating: boolean;
    handleNextStep: () => void;
    selectedTier: string;
    setSelectedTier: (tier: string) => void;
    tiers: any[];
    calculatePrice: (multiplier: number) => { originalPrice: number; finalPrice: number; amountUsed: number };
    ridePayMethod: 'cash' | 'wave';
    setRidePayMethod: (method: 'cash' | 'wave') => void;
    confirmRide: () => void;
    triggerHaptic: () => void;
    bgCard: string;
    inputBg: string;
    textSec: string;
    sessionToken: any;
    settings: AppSettings;
    showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RideBookingForm: React.FC<RideBookingFormProps> = ({
    theme,
    bookingStep,
    setBookingStep,
    rideType,
    setRideType,
    destinations,
    updateDestination,
    addDestination,
    removeDestination,
    handleSearch,
    predictions,
    selectPrediction,
    activeInputIndex,
    setActiveInputIndex,
    isCalculating,
    handleNextStep,
    selectedTier,
    setSelectedTier,
    tiers,
    calculatePrice,
    ridePayMethod,
    setRidePayMethod,
    confirmRide,
    triggerHaptic,
    bgCard,
    inputBg,
    textSec,
    sessionToken,
    user,
    settings,
    showAlert
}) => {
    const minFare = rideType === 'delivery' ? settings.min_delivery_fee : settings.min_ride_price;

    return (
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
                                            placeholder={
                                                idx === destinations.length - 1
                                                    ? "Final Destination"
                                                    : `Stop ${idx + 1}`
                                            }
                                            className="bg-transparent outline-none flex-1 font-bold text-sm"
                                            value={dest}
                                            onChange={(e) => handleSearch(e.target.value, idx)}
                                            onFocus={() => {
                                                setActiveInputIndex(idx);
                                                if (!sessionToken.current) {
                                                    const google = (window as any).google;
                                                    if (google) {
                                                        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
                                                    }
                                                }
                                            }}
                                        />
                                        {dest.length > 0 && (
                                            <button
                                                onClick={() => updateDestination(idx, '')}
                                                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                            >
                                                <X size={14} className="opacity-50" />
                                            </button>
                                        )}
                                        {destinations.length > 1 && (
                                            <button onClick={() => removeDestination(idx)} className="p-1.5 bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 transition-colors">
                                                <Trash size={12} className="opacity-50" />
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
                        disabled={!destinations[0] || isCalculating}
                        className="w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-xl disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {isCalculating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                Calculating...
                            </>
                        ) : 'Next'}
                    </button>
                </div>
            ) : (
                <div className="space-y-6 animate-scale-in relative">
                    {/* Fare Calculation Skeleton Overlay (Removed absolute overlay for more natural feel) */}

                    <div className="flex items-center justify-between px-1">
                        <button
                            onClick={() => setBookingStep('planning')}
                            className="text-[#00D68F] font-bold text-sm flex items-center gap-1 active:opacity-60"
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold">Choose your ride</h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    console.log("Info icon clicked");
                                    const tier = tiers.find(t => t.id === selectedTier);
                                    const mult = tier?.mult || 1;
                                    const price = calculatePrice(mult);
                                    console.log("Calculated price for info:", price);
                                    showAlert(
                                        "Fare Calculation",
                                        `Your fare is calculated as:\n\n• Min Fare: D${minFare}\n• Rate per KM: D${settings.price_per_km}\n• Multiplier: ${mult}x (${tier?.label})\n\nFormula:\nMin Fare + (Distance × Rate × Multiplier)\n\nYour Total: D${price.finalPrice}`,
                                        "info"
                                    );
                                }}
                                className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 text-[#00D68F] active:scale-90 transition-transform"
                            >
                                <Info size={16} />
                            </button>
                        </div>
                        <div className="w-10"></div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="font-bold text-sm">Available Tiers</h3>
                        </div>
                        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 px-1 snap-x">
                            {isCalculating ? (
                                // Show 3 Skeleton Cards
                                [1, 2, 3].map(i => (
                                    <div key={i} className="min-w-[200px] h-[160px] p-5 rounded-3xl bg-gray-100 dark:bg-gray-800 flex flex-col gap-3">
                                        <Skeleton className="w-12 h-4 mb-2" />
                                        <Skeleton className="w-24 h-6" />
                                        <Skeleton className="w-16 h-4" />
                                        <div className="mt-auto">
                                            <Skeleton className="w-20 h-8" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                tiers.map(t => {
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
                                })
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className={`flex p-1 rounded-xl ${inputBg}`}>
                            <button onClick={() => setRidePayMethod('wave')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${ridePayMethod === 'wave' ? 'bg-[#1E88E5] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Wave</button>
                            <button onClick={() => setRidePayMethod('cash')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${ridePayMethod === 'cash' ? 'bg-[#00D68F] text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Cash</button>
                        </div>

                        <button
                            onClick={confirmRide}
                            disabled={!destinations[0] || isCalculating}
                            className={`w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-xl disabled:opacity-50 disabled:shadow-none flex items-center justify-between px-6 active:scale-[0.98] transition-transform`}
                        >
                            {isCalculating ? (
                                <Skeleton className="w-full h-8 bg-black/10" />
                            ) : (
                                <>
                                    <span>Book {tiers.find(t => t.id === selectedTier)?.label}</span>
                                    <div className="flex flex-col items-end text-right">
                                        <span className="text-xl leading-none font-bold">D{calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1).finalPrice}</span>
                                    </div>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
