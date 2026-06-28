import React, { useState } from 'react';
import { User, Check, Package, Phone, X, AlertCircle } from 'lucide-react';
import { StarRating } from '../StarRating';
import { UserData } from '../../types';
import { RideIssueDrawer } from './RideIssueDrawer';
import { supabase } from '../../supabaseClient';

interface RidePaymentSummaryProps {
    assignedDriver: any;
    rating: number;
    setRating: (rating: number) => void;
    acTurnedOn: boolean | null;
    setAcTurnedOn: (val: boolean | null) => void;
    reviewComment: string;
    setReviewComment: (c: string) => void;
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
    currentRideId?: string | null;
}

/** Strip anything that could be dangerous before it ever leaves the device */
const sanitizeComment = (raw: string): string => {
    return raw
        .replace(/\0/g, '')           // remove null bytes
        .replace(/<[^>]*>/g, '')      // strip any HTML/script tags
        .slice(0, 1000)               // hard cap at 1000 chars (matches DB CHECK constraint)
        .trim();
};

export const RidePaymentSummary: React.FC<RidePaymentSummaryProps> = ({
    assignedDriver,
    rating,
    setRating,
    acTurnedOn,
    setAcTurnedOn,
    reviewComment,
    setReviewComment,
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
    user,
    currentRideId
}) => {
    const [isIssueDrawerOpen, setIsIssueDrawerOpen] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotReporting, setForgotReporting] = useState(false);
    const [forgotDone, setForgotDone] = useState(false);
    const priceInfo = calculatePrice(tiers.find(t => t.id === selectedTier)?.mult || 1);
    const charsLeft = 1000 - reviewComment.length;

    const handleForgotSomething = async () => {
        setForgotReporting(true);
        try {
            // 1. Log to Supabase so Admin is notified in their dashboard
            await supabase.from('lost_item_reports').insert({
                customer_id: user.id,
                customer_name: user.name || 'Unknown Customer',
                driver_id: assignedDriver?.id || null,
                driver_name: assignedDriver?.name || 'Unknown Driver',
                driver_phone: assignedDriver?.phone || null,
                ride_id: currentRideId || null,
                status: 'pending',
                reported_at: new Date().toISOString(),
            });

            // 2. Call the driver directly — fastest way to recover an item
            if (assignedDriver?.phone) {
                window.location.href = `tel:${assignedDriver.phone}`;
            }

            setForgotDone(true);
        } catch (err) {
            console.error('Lost item report error:', err);
            // Even if DB write fails, still let the customer call the driver
            if (assignedDriver?.phone) {
                window.location.href = `tel:${assignedDriver.phone}`;
            }
            setForgotDone(true);
        } finally {
            setForgotReporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-scale-in">
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

                <div className="flex justify-center mb-5">
                    <StarRating rating={rating} setRating={setRating} size={36} />
                </div>

                {selectedTier === 'prem' && (
                    <div className="mb-5 flex flex-col items-center">
                        <p className={`text-sm ${textSec} font-bold mb-3`}>Did the driver turn on the AC?</p>
                        <div className="flex gap-4 w-full px-4">
                            <button
                                type="button"
                                onClick={() => setAcTurnedOn(true)}
                                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-95 border ${
                                    acTurnedOn === true
                                        ? 'bg-[#00D68F]/20 border-[#00D68F] text-[#00D68F]'
                                        : 'bg-transparent border-gray-200 dark:border-gray-800 text-gray-500'
                                }`}
                            >
                                Yes 👍
                            </button>
                            <button
                                type="button"
                                onClick={() => setAcTurnedOn(false)}
                                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-95 border ${
                                    acTurnedOn === false
                                        ? 'bg-red-500/20 border-red-500 text-red-500'
                                        : 'bg-transparent border-gray-200 dark:border-gray-800 text-gray-500'
                                }`}
                            >
                                No 👎
                            </button>
                        </div>
                        {acTurnedOn === false && (
                            <p className="text-xs text-red-500 font-semibold mt-2 text-center px-4">
                                ⚠️ A 0.5 rating deduction will be applied to the driver.
                            </p>
                        )}
                    </div>
                )}

                {/* Optional comment — sanitized, not required */}
                <div className="mb-5 relative">
                    <textarea
                        value={reviewComment}
                        onChange={e => setReviewComment(sanitizeComment(e.target.value))}
                        placeholder="Leave a comment (optional)..."
                        maxLength={1000}
                        rows={3}
                        className={`w-full px-4 py-3 rounded-2xl text-sm font-medium resize-none outline-none border border-transparent focus:border-[#00D68F]/40 transition-colors ${inputBg} ${textSec} placeholder:opacity-50`}
                    />
                    {reviewComment.length > 800 && (
                        <span className={`absolute bottom-2 right-3 text-[10px] font-bold ${charsLeft < 50 ? 'text-red-400' : 'text-gray-400'}`}>
                            {charsLeft}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between mb-5 px-2">
                    <span className="font-bold text-gray-500">Total Paid ({ridePayMethod === 'wave' ? 'Wave' : 'Cash'})</span>
                    <span className="text-2xl font-black text-[#00D68F]">D{priceInfo.finalPrice}</span>
                </div>

                {priceInfo.amountUsed > 0 && (
                    <div className="flex items-center justify-between mb-5 px-2 text-xs">
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

                    {/* Forgot Something Button */}
                    <button
                        onClick={() => setShowForgotModal(true)}
                        className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 active:scale-95 transition-all"
                    >
                        <Package size={15} />
                        Forgot Something?
                    </button>

                    <button
                        onClick={() => setIsIssueDrawerOpen(true)}
                        className={`w-full py-2 rounded-2xl font-bold text-sm ${textSec} active:scale-95 transition-all text-center underline decoration-dashed underline-offset-4`}
                    >
                        Problem with the Ride?
                    </button>

                    <button
                        onClick={onReviewSkip}
                        disabled={loading}
                        className={`w-full py-3 rounded-2xl font-bold text-xs uppercase tracking-widest ${textSec} active:scale-95 transition-all text-center opacity-70`}
                    >
                        Skip for Now
                    </button>
                </div>
            </div>

            {/* ── Forgot Something Modal ── */}
            {showForgotModal && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
                    <div className="bg-[#1C1C1E] dark:bg-[#1C1C1E] w-full max-w-md rounded-[32px] p-6 flex flex-col gap-4 shadow-2xl" style={{ animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)' }}>
                        
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                                    <Package size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-base">Forgot Something?</h3>
                                    <p className="text-[#98989D] text-xs font-medium">We'll contact your driver & notify admin</p>
                                </div>
                            </div>
                            <button onClick={() => setShowForgotModal(false)} className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center active:scale-90 transition-transform">
                                <X size={16} className="text-[#98989D]" />
                            </button>
                        </div>

                        {/* Driver Info */}
                        <div className="flex items-center gap-3 bg-[#2C2C2E] rounded-2xl p-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                                {assignedDriver?.profile_picture ? (
                                    <img src={assignedDriver.profile_picture} className="w-full h-full object-cover" alt="Driver" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><User size={20} className="text-gray-400" /></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm truncate">{assignedDriver?.name || 'Your Driver'}</p>
                                <p className="text-[#98989D] text-xs font-medium">{assignedDriver?.phone || 'No phone on record'}</p>
                            </div>
                            {assignedDriver?.phone && (
                                <div className="w-10 h-10 rounded-full bg-[#00D68F]/15 flex items-center justify-center flex-shrink-0">
                                    <Phone size={16} className="text-[#00D68F]" />
                                </div>
                            )}
                        </div>

                        {forgotDone ? (
                            <div className="flex flex-col items-center gap-3 py-3">
                                <div className="w-14 h-14 rounded-full bg-[#00D68F]/15 flex items-center justify-center">
                                    <Check size={28} className="text-[#00D68F]" strokeWidth={3} />
                                </div>
                                <p className="text-white font-bold text-center">Report Sent to Admin</p>
                                <p className="text-[#98989D] text-xs text-center">Your driver's number has been dialled. Admin has been notified and will follow up if needed.</p>
                                <button onClick={() => setShowForgotModal(false)} className="w-full py-3 rounded-2xl bg-[#00D68F] text-black font-black text-sm active:scale-95 transition-all mt-1">
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start gap-2 bg-amber-500/10 rounded-2xl p-3">
                                    <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-amber-300 text-xs font-medium leading-relaxed">
                                        Tapping below will immediately call {assignedDriver?.name?.split(' ')[0] || 'the driver'} and log a report to admin so they can follow up.
                                    </p>
                                </div>

                                <button
                                    onClick={handleForgotSomething}
                                    disabled={forgotReporting}
                                    className="w-full py-4 rounded-2xl bg-amber-500 text-black font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-amber-500/25"
                                >
                                    {forgotReporting ? (
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <><Phone size={18} /> Call Driver & Notify Admin</>
                                    )}
                                </button>

                                <button onClick={() => setShowForgotModal(false)} className={`w-full py-3 rounded-2xl font-bold text-sm text-[#98989D] active:scale-95 transition-all text-center`}>
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                    <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
                </div>
            )}
            
            <RideIssueDrawer 
                isOpen={isIssueDrawerOpen} 
                onClose={() => setIsIssueDrawerOpen(false)} 
            />
        </div>
    );
};
