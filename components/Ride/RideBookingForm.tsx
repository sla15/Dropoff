import React from 'react';
import { ArrowLeft, ArrowRight, Locate, MapPin as MapPinFilled, Plus, Trash, X, Info, Car, Bike, Search, Pencil } from 'lucide-react';
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
    expandSheet?: () => void;
    setShowSearchOverlay: (show: boolean) => void;
    distanceKm?: number;
    // Pickup location
    pickupLocation?: string;
    onChangePickup?: () => void;
    savedLocations?: any[];
    onSelectSavedLocation?: (address: string, coords: { lat: number; lng: number }) => void;
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
    showAlert,
    expandSheet,
    setShowSearchOverlay,
    distanceKm = 0,
    pickupLocation = 'Current Location',
    onChangePickup,
    savedLocations = [],
    onSelectSavedLocation
}) => {
    const minFare = rideType === 'delivery' ? settings.min_delivery_fee : settings.min_ride_price;

    return (
        <div className="space-y-6">
            {bookingStep === 'planning' ? (
                <div className="space-y-6 animate-scale-in">
                    {/* Modern Segmented Tab Switcher */}
                    <div className={`w-full p-1 rounded-2xl ${inputBg} flex gap-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]`}>
                        <button
                            onClick={() => { triggerHaptic(); setRideType('ride'); }}
                            className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 active:scale-98 ${rideType === 'ride' ? 'bg-[#00D68F] text-black shadow-md' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            <Car size={16} />
                            Ride
                        </button>
                        <button
                            onClick={() => { triggerHaptic(); setRideType('delivery'); setSelectedTier('moto'); }}
                            className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 active:scale-98 ${rideType === 'delivery' ? 'bg-[#00D68F] text-black shadow-md' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            <Bike size={16} />
                            Delivery
                        </button>
                    </div>

                    {/* Unified Route Container */}
                    <div className={`p-5 rounded-3xl ${bgCard} border border-gray-100 dark:border-gray-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.15)] flex gap-4 relative`}>
                        {/* Left vertical line track */}
                        <div className="flex flex-col items-center py-2 shrink-0">
                            <div className="w-3.5 h-3.5 rounded-full border-[3px] border-[#00D68F] bg-transparent"></div>
                            <div className="w-[1.5px] flex-1 border-l-2 border-dashed border-gray-200 dark:border-gray-800 my-1"></div>
                            <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
                        </div>

                        {/* Right inputs */}
                        <div className="flex-1 flex flex-col gap-3 min-w-0">
                            {/* Pickup Row */}
                            <button
                                onClick={() => { triggerHaptic(); onChangePickup?.(); }}
                                className="w-full flex items-center justify-between text-left group"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Pickup Location</div>
                                    <div className={`font-bold text-sm truncate ${pickupLocation === 'Current Location' ? textSec : (theme === 'light' ? 'text-black' : 'text-white')}`}>
                                        {pickupLocation}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 bg-gray-100 dark:bg-white/5 px-2.5 py-1.5 rounded-xl transition-all group-active:scale-95 group-hover:bg-gray-200 dark:group-hover:bg-white/10">
                                    <Pencil size={11} className="text-[#00D68F]" />
                                    <span className="text-[9px] font-black text-[#00D68F] uppercase tracking-wide">Edit</span>
                                </div>
                            </button>

                            {/* Divider */}
                            <div className="h-[1px] w-full bg-gray-100 dark:bg-gray-800/80"></div>

                            {/* Destination Row */}
                            <button
                                onClick={() => { triggerHaptic(); setShowSearchOverlay(true); }}
                                className="w-full flex items-center justify-between text-left group"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Destination</div>
                                    <div className="font-bold text-base truncate">
                                        {destinations[0] || "Where to?"}
                                    </div>
                                    {destinations.length > 1 && (
                                        <div className="mt-1">
                                            <span className="bg-[#00D68F]/15 text-[#00D68F] px-2 py-0.5 rounded-md font-black uppercase text-[8px] tracking-wider">+{destinations.length - 1} Stop(s)</span>
                                        </div>
                                    )}
                                </div>
                                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 group-hover:scale-110 transition-transform">
                                    <Search size={16} />
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Quick-Select Saved Locations Carousel */}
                    {savedLocations && savedLocations.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Quick Book</div>
                            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 snap-x">
                                {savedLocations.map(loc => (
                                    <button
                                        key={loc.id}
                                        onClick={() => {
                                            triggerHaptic();
                                            onSelectSavedLocation?.(loc.address, { lat: loc.latitude, lng: loc.longitude });
                                        }}
                                        className={`snap-start shrink-0 flex items-center gap-2 px-4.5 py-2.5 rounded-full ${bgCard} border border-gray-100 dark:border-gray-800/80 shadow-sm active:scale-95 transition-all text-xs font-bold hover:border-gray-200 dark:hover:border-gray-700`}
                                    >
                                        <span className="text-sm shrink-0">{loc.emoji || '📍'}</span>
                                        <span className="truncate max-w-[120px]">{loc.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prominent Booking Action Button */}
                    <button
                        onClick={handleNextStep}
                        disabled={!destinations[0] || isCalculating}
                        className="w-full bg-[#00D68F] text-black py-4.5 rounded-full font-bold text-lg shadow-[0_8px_25px_rgba(0,214,143,0.3)] disabled:opacity-50 disabled:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {isCalculating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                <span className="animate-pulse font-black">Calculating...</span>
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
                                    const tier = tiers.find(t => t.id === selectedTier);
                                    const mult = tier?.mult || 1;
                                    const price = calculatePrice(mult);
                                    showAlert(
                                        "Fare Breakdown",
                                        `📍 Distance: ${distanceKm > 0 ? distanceKm.toFixed(1) + ' km' : 'Calculating...'}\n• Min Fare: D${minFare}\n• Rate per KM: D${settings.price_per_km}\n• Multiplier: ${mult}x (${tier?.label})\n\nBase Fare: D${price.originalPrice}\nGift Applied: -D${price.amountUsed}\n──────────────\nYou Pay: D${price.finalPrice}`,
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
                                [1, 2, 3].map(i => (
                                    <div key={i} className="min-w-[200px] h-[160px] p-5 rounded-3xl bg-gray-100 dark:bg-gray-800 flex flex-col gap-3 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                                        <div className="w-12 h-3 rounded-full bg-gray-300 dark:bg-gray-700" />
                                        <div className="w-24 h-6 rounded-lg bg-gray-300 dark:bg-gray-700" />
                                        <div className="w-16 h-3 rounded-full bg-gray-300 dark:bg-gray-700" />
                                        <div className="mt-auto">
                                            <div className="w-20 h-7 rounded-lg bg-gray-300 dark:bg-gray-700" />
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
