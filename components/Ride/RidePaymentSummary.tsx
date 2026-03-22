import React from 'react';
import { User, Check } from 'lucide-react';
import { StarRating } from '../StarRating';
import { UserData } from '../../types';

interface RidePaymentSummaryProps {
    assignedDriver: any;
    rating: number;
    setRating: (rating: number) => void;
    calculatePrice: (multiplier: number) => { originalPrice: number; finalPrice: number; amountUsed: number };
    tiers: any[];
    selectedTier: string;
    loading: boolean;
    submitReview: () => void;
    onReviewSkip: () => void;
    ridePayMethod: 'cash' | 'wave';
    bgCard: string;
    inputBg: string;
    textSec: string;
    user: UserData;
}

export const RidePaymentSummary: React.FC<RidePaymentSummaryProps> = ({
    assignedDriver,
    rating,
    setRating,
    calculatePrice,
    tiers,
    selectedTier,
    loading,
    submitReview,
    onReviewSkip,
    ridePayMethod,
    bgCard,
    inputBg,
    textSec,
    user
}) => {
    const priceInfo = calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-scale-in">
            <div className={`${bgCard} w-full max-w-md rounded-[32px] p-6 relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-[#00D68F]"></div>

                <div className="flex flex-col items-center mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-white dark:border-[#1C1C1E] shadow-xl overflow-hidden mb-3 relative">
                        {assignedDriver?.profile_picture ? (
                            <img src={assignedDriver.profile_picture} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center"><User size={30} /></div>
                        )}
                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-[#00D68F] border-2 border-white rounded-full flex items-center justify-center">
                            <Check size={12} className="text-black" strokeWidth={4} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-black">Ride Completed!</h2>
                    <p className={`text-sm ${textSec} font-bold`}>How was your ride with {assignedDriver?.name}?</p>
                </div>

                <div className="flex justify-center mb-8">
                    <StarRating rating={rating} setRating={setRating} size={36} />
                </div>

                <div className="flex items-center justify-between mb-6 px-2">
                    <span className="font-bold text-gray-500">Total Paid ({ridePayMethod === 'wave' ? 'Wave' : 'Cash'})</span>
                    <span className="text-2xl font-black text-[#00D68F]">D{priceInfo.finalPrice}</span>
                </div>

                {priceInfo.amountUsed > 0 && (
                    <div className="flex items-center justify-between mb-6 px-2 text-xs">
                        <span className="font-bold text-gray-500">Discount Applied</span>
                        <span className="font-black text-[#00D68F]">-D{priceInfo.amountUsed}</span>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={submitReview}
                        disabled={loading}
                        className="w-full bg-[#00D68F] text-black py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Done'}
                    </button>
                    
                    <button
                        onClick={onReviewSkip}
                        disabled={loading}
                        className={`w-full py-3 rounded-2xl font-bold text-xs uppercase tracking-widest ${textSec} active:scale-95 transition-all text-center`}
                    >
                        Skip for Now
                    </button>
                </div>
            </div>
        </div>
    );
};
