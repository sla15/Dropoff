import React from 'react';
import { User, Star, Bike, Car } from 'lucide-react';
import { UserData, RideStatus } from '../../types';

interface RideStatusPanelProps {
    status: RideStatus;
    rideType: 'ride' | 'delivery';
    etaSeconds: number;
    assignedDriver: any;
    destinations: string[];
    user: UserData;
    inputBg: string;
    textSec: string;
    formatTime: (seconds: number) => string;
    selectedTier: string;
    handleCancelRide: () => void;
}

export const RideStatusPanel: React.FC<RideStatusPanelProps> = ({
    status,
    rideType,
    etaSeconds,
    assignedDriver,
    destinations,
    user,
    inputBg,
    textSec,
    formatTime,
    selectedTier,
    handleCancelRide
}) => {
    return (
        <div className="text-center py-4 relative">
            {status === 'searching' && (
                <div className="absolute top-0 right-0 z-20">
                    <div className="w-16 h-16 border-4 border-[#00D68F] border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

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
                                <div className="w-16 h-16 rounded-full bg-[#00D68F]/10 flex items-center justify-center border-4 border-white dark:border-[#1C1C1E] shadow-md overflow-hidden">
                                    {assignedDriver?.profile_picture ? (
                                        <img src={assignedDriver.profile_picture} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={32} className="text-[#00D68F] opacity-50" />
                                    )}
                                </div>
                                <div className={`absolute -bottom-2 right-1 px-1.5 py-0.5 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-1 ${(assignedDriver?.rating || 5.0) >= 4.5 ? 'bg-[#00D68F]/10 text-[#00D68F]' :
                                    (assignedDriver?.rating || 5.0) >= 3.0 ? 'bg-orange-500/10 text-orange-500' :
                                        'bg-red-500/10 text-red-500'
                                    }`}>
                                    <Star size={10} fill="currentColor" />
                                    <span className="text-[10px] font-black">{Number(assignedDriver?.rating || 5.0).toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-px w-full bg-black/5 dark:bg-white/10 my-4"></div>

                        {/* Driver Info */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-[#00D68F]/10 flex items-center justify-center text-[#00D68F] overflow-hidden">
                                    {assignedDriver?.vehicle_img ? (
                                        <img src={assignedDriver.vehicle_img} className="w-full h-full object-cover" />
                                    ) : (
                                        selectedTier === 'moto' ? <Bike size={24} /> : <Car size={24} />
                                    )}
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-base truncate max-w-[150px]">{assignedDriver?.name || 'Your Driver'}</div>
                                    <div className="font-bold text-sm tracking-tight">{assignedDriver?.vehicle_model || 'Toyota Prius'}</div>
                                    <div className={`${textSec} text-[11px] font-bold uppercase tracking-wider`}>{assignedDriver?.vehicle_color || 'Silver'} • {assignedDriver?.vehicle_category || 'Sedan'}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5">Plate</div>
                                <div className="font-mono font-bold text-lg bg-white dark:bg-black/40 px-2 py-1 rounded-lg border border-black/5 dark:border-white/10">{assignedDriver?.vehicle_plate || 'BJL ....'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

                    <button
                        onClick={() => handleCancelRide()}
                        className="w-full mt-6 py-4 rounded-2xl bg-red-500/10 text-red-500 font-bold text-sm active:scale-[0.98] transition-all border border-red-500/20"
                    >
                        Cancel {rideType === 'delivery' ? 'Delivery' : 'Ride'} Request
                    </button>
                </div>
            )}
        </div>
    );
};
