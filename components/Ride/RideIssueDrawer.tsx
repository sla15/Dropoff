import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { triggerHaptic } from '../../utils/helpers';

interface RideIssueDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    rideId?: string | null;
    customerId?: string | null;
    driverId?: string | null;
}

export const RideIssueDrawer: React.FC<RideIssueDrawerProps> = ({ isOpen, onClose, rideId, customerId, driverId }) => {
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const toggleIssue = (issue: string) => {
        triggerHaptic();
        setSelectedIssues(prev => 
            prev.includes(issue) 
                ? prev.filter(i => i !== issue) 
                : [...prev, issue]
        );
    };

    const categories = [
        {
            title: "My initiative",
            isDriverAction: false,
            items: [
                { id: "found_another_ride", label: "Found another ride", emoji: "🚗" },
                { id: "plans_changed", label: "Plans changed", emoji: "🗓️" },
                { id: "wrong_address", label: "Wrong address", emoji: "📍" },
            ]
        },
        {
            title: "Driver's actions",
            isDriverAction: true,
            items: [
                { id: "asked_to_cancel", label: "Asked to cancel", emoji: "🚫" },
                { id: "rude_behavior", label: "Rude behavior", emoji: "🤬" },
                { id: "asked_more_money", label: "Asked for more money", emoji: "💰" },
                { id: "refused_to_drive", label: "Refused to drive", emoji: "🛑" },
                { id: "waiting_too_far", label: "Waiting too far", emoji: "🚶‍♂️" },
                { id: "couldnt_find_car", label: "I couldn't find the car", emoji: "🔍" },
                { id: "left_without_me", label: "Left without me", emoji: "🏃‍♂️💨" },
                { id: "arrived_too_early", label: "Set Arrived too early", emoji: "⏰" },
                { id: "different_license", label: "Different license plate", emoji: "🔢" },
                { id: "different_driver", label: "Different driver", emoji: "👤" },
                { id: "not_responding", label: "Not responding", emoji: "📴" },
                { id: "other_passenger", label: "Other passenger in the car", emoji: "👥" },
            ]
        },
        {
            title: "Service issues",
            isDriverAction: false,
            items: [
                { id: "drivers_rating", label: "Driver's rating", emoji: "⭐️" },
                { id: "ride_price", label: "Ride price", emoji: "💵" },
                { id: "luggage_didnt_fit", label: "Luggage didn't fit", emoji: "🧳" },
            ]
        }
    ];

    const handleDone = async () => {
        triggerHaptic();
        if (selectedIssues.length > 0 && rideId && customerId) {
            setIsSaving(true);
            try {
                const { error } = await supabase
                    .from('ride_cancellations')
                    .insert({
                        ride_id: rideId,
                        customer_id: customerId,
                        reasons: selectedIssues
                    });
                if (error) {
                    console.error("Error saving cancellation reasons:", error);
                }

                const driverActionCategory = categories.find(c => c.title === "Driver's actions");
                const hasDriverIssue = selectedIssues.some(issueId => 
                    driverActionCategory?.items.some(item => item.id === issueId)
                );

                if (hasDriverIssue && driverId) {
                    const { data: driver } = await supabase
                        .from('drivers')
                        .select('average_rating')
                        .eq('id', driverId)
                        .single();

                    if (driver) {
                        await supabase
                            .from('drivers')
                            .update({ average_rating: Math.max(0, driver.average_rating - 0.5) })
                            .eq('id', driverId);
                    }
                }
            } catch (err) {
                console.error("Failed to process cancellation:", err);
            } finally {
                setIsSaving(false);
            }
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            {/* Glassmorphic Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                onClick={onClose} 
            />
            
            {/* Translucent Sheet Container */}
            <div className="relative bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl rounded-t-[2rem] shadow-2xl flex flex-col max-h-[85vh] animate-slide-up border-t border-gray-200/25 dark:border-gray-800/50">
                {/* Drag Handle Indicator */}
                <div className="w-full flex justify-center pt-3 pb-1">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full opacity-60" />
                </div>
                
                <div className="px-6 pb-2 border-b border-gray-100/10 dark:border-gray-800/10 z-10 bg-transparent">
                    <h2 className="text-2xl font-black text-black dark:text-white mt-2 mb-4">
                        What happened?
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pt-4 pb-28 hide-scrollbar">
                    {categories.map((category, idx) => (
                        <div key={idx} className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    {category.title}
                                </h3>
                                {category.isDriverAction && (
                                    <span className="text-[10px] font-black bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        ⚠️ Affects Rating
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {category.items.map(item => {
                                    const isSelected = selectedIssues.includes(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleIssue(item.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95
                                                ${isSelected 
                                                    ? category.isDriverAction
                                                        ? 'bg-red-500 text-white shadow-md shadow-red-500/30 scale-[1.02] border border-transparent'
                                                        : 'bg-[#00D68F] text-black shadow-md scale-[1.02] border border-transparent'
                                                    : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-800/50 hover:bg-black/10 dark:hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="text-base">{item.emoji}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="absolute bottom-0 left-0 w-full p-4 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-lg border-t border-gray-200/25 dark:border-gray-800/50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-black/5 dark:bg-white/5 text-black dark:text-white py-4 rounded-2xl font-bold text-base active:scale-95 transition-all border border-gray-200/50 dark:border-gray-800/50"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleDone}
                        disabled={isSaving}
                        className="flex-[2] bg-[#FF3B30] text-white py-4 rounded-2xl font-black text-base shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : 'Submit Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};
