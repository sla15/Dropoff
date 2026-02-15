import React, { useState } from 'react';
import { User, X } from 'lucide-react';

interface RideCancellationSummaryProps {
    onClose: () => void;
    bgCard: string;
    textSec: string;
    inputBg: string;
}

export const RideCancellationSummary: React.FC<RideCancellationSummaryProps> = ({
    onClose,
    bgCard,
    textSec,
    inputBg
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-scale-in">
            <div className={`${bgCard} w-full max-w-md rounded-[32px] p-6 relative overflow-hidden`}>
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                        <X size={40} className="text-red-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-black text-center mb-2">Ride Cancelled</h2>
                <p className={`text-center ${textSec} mb-8`}>
                    This ride was cancelled. No charge has been made.
                </p>

                <button
                    onClick={onClose}
                    className="w-full py-4 bg-gray-100 dark:bg-white/10 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
