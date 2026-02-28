
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Package, Truck, Home, Star, Phone, MessageSquare, Loader2, CheckCircle2, X, Plus } from 'lucide-react';
import { Theme, Screen, UserData, Activity } from '../types';
import { triggerHaptic, sendPushNotification, getInitialAvatar } from '../utils/helpers';
import { GreenGlow } from '../components/GreenGlow';
import { supabase } from '../supabaseClient';

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    user: UserData;
    setRecentActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
    showAlert: (
        title: string,
        message: string,
        type?: 'success' | 'error' | 'info',
        onConfirm?: () => void,
        showCancel?: boolean,
        confirmText?: string,
        cancelText?: string,
        onCancel?: () => void
    ) => void;
    activeOrderId: string | null;
    setActiveOrderId: (id: string | null) => void;
    activeBatchId: string | null;
    setActiveBatchId: (id: string | null) => void;
}

type OrderStatus = 'pending' | 'preparing' | 'picked-up' | 'arriving' | 'delivered';

export const OrderTrackingScreen = ({ theme, navigate, user, setRecentActivities, showAlert, activeOrderId, setActiveOrderId, activeBatchId, setActiveBatchId }: Props) => {
    const [status, setStatus] = useState<OrderStatus>('pending');
    const [progress, setProgress] = useState(25);
    const [orderInfo, setOrderInfo] = useState<any>(null);
    const [batchOrders, setBatchOrders] = useState<any[]>([]);
    const [driver, setDriver] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Review State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewBusiness, setReviewBusiness] = useState<{ id: string, name: string } | null>(null);
    const [userRating, setUserRating] = useState(5);
    const [userComment, setUserComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewedIds, setReviewedIds] = useState<string[]>([]);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

    useEffect(() => {
        if (!activeOrderId && !activeBatchId) return;
        fetchOrderAndDriver();

        const channelId = activeBatchId ? `batch-tracking-${activeBatchId}` : `order-tracking-${activeOrderId}`;
        const filterStr = activeBatchId ? `batch_id=eq.${activeBatchId}` : `id=eq.${activeOrderId}`;

        // Subscribe to real-time changes
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders', filter: filterStr },
                (payload) => {
                    console.log('Order Change Received:', payload.new);
                    if (activeBatchId) {
                        setBatchOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
                    } else {
                        handleStatusUpdate(payload.new);
                    }

                    if (payload.new.driver_id && (!driver || driver.id !== payload.new.driver_id)) {
                        fetchDriver(payload.new.driver_id);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeOrderId, activeBatchId]);

    useEffect(() => {
        if (activeBatchId && batchOrders.length > 0) {
            // Calculate aggregate status
            const statuses = batchOrders.map(o => o.status);

            // Priority for global status
            if (statuses.every(s => s === 'completed')) handleStatusUpdate(batchOrders[0]);
            else if (statuses.some(s => s === 'delivering')) setStatus('picked-up');
            else if (statuses.some(s => s === 'ready' || s === 'preparing')) setStatus('preparing');
            else setStatus('pending');

            // Find an order that best represents the current driver context
            const activeOrder = batchOrders.find(o => ['delivering', 'ready', 'preparing'].includes(o.status)) || batchOrders[0];
            setOrderInfo(activeOrder);
        }
    }, [batchOrders, activeBatchId]);

    const fetchOrderAndDriver = async () => {
        try {
            setIsLoading(true);

            if (activeBatchId) {
                const { data: orders, error } = await supabase
                    .from('orders')
                    .select('*, businesses(name, image_url)')
                    .eq('batch_id', activeBatchId);

                if (error) throw error;
                if (orders && orders.length > 0) {
                    setBatchOrders(orders);
                    if (orders[0].driver_id) {
                        await fetchDriver(orders[0].driver_id);
                    }
                }
            } else if (activeOrderId) {
                const { data: order, error } = await supabase
                    .from('orders')
                    .select('*, businesses(name, image_url)')
                    .eq('id', activeOrderId)
                    .maybeSingle();

                if (error) throw error;
                if (order) {
                    setOrderInfo(order);
                    handleStatusUpdate(order);
                    if (order.driver_id) {
                        await fetchDriver(order.driver_id);
                    }
                }
            }
        } catch (err) {
            console.error("Fetch Order Error:", err);
            showAlert("Error", "Could not fetch order details", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDriver = async (driverId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', driverId)
                .single();
            if (error) throw error;
            if (data) setDriver(data);
        } catch (err) {
            console.error("Fetch Driver Error:", err);
        }
    };

    const handleStatusUpdate = (order: any) => {
        const s = order.status;
        let newStatus: OrderStatus = 'pending';
        let newProgress = 25;

        switch (s) {
            case 'pending': newStatus = 'pending'; newProgress = 25; break;
            case 'accepted': newStatus = 'pending'; newProgress = 35; break;
            case 'preparing': newStatus = 'preparing'; newProgress = 50; break;
            case 'ready': newStatus = 'preparing'; newProgress = 65; break;
            case 'delivering': newStatus = 'picked-up'; newProgress = 85; break;
            case 'completed':
                newStatus = 'delivered';
                newProgress = 100;
                // If it's the first time reaching completed, notify user
                if (status !== 'delivered') {
                    sendPushNotification("DROPOFF: Order Delivered", "Your order has been delivered successfully!");
                    triggerHaptic();
                }
                break;
            case 'cancelled':
                showAlert("Order Cancelled", "This order has been cancelled.", "info");
                setActiveOrderId(null);
                navigate('dashboard');
                break;
        }

        setStatus(newStatus);
        setProgress(newProgress);
        setOrderInfo(order);
    };

    const handleCancelOrder = async () => {
        const targetId = activeBatchId || activeOrderId;
        if (!targetId) return;

        showAlert(
            "Cancel Order?",
            "Are you sure you want to cancel this order? This cannot be undone.",
            "info",
            async () => {
                try {
                    setIsLoading(true);
                    const { error } = await supabase
                        .from('orders')
                        .update({ status: 'cancelled' })
                        .match(activeBatchId ? { batch_id: activeBatchId } : { id: activeOrderId });

                    if (error) throw error;

                    triggerHaptic();
                    setActiveOrderId(null);
                    setActiveBatchId(null);
                    localStorage.removeItem('active_order_id');
                    localStorage.removeItem('active_batch_id');
                    showAlert("Cancelled", "Your order has been cancelled successfully.", "success");
                    navigate('dashboard');
                } catch (err) {
                    console.error("Cancel Order Error:", err);
                    showAlert("Error", "Could not cancel order. Please try again.", "error");
                } finally {
                    setIsLoading(false);
                }
            },
            true,
            "Yes, Cancel",
            "No, Keep it"
        );
    };

    const statusConfig = {
        pending: { label: 'Order Received', icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        preparing: { label: 'Preparing your order', icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        'picked-up': { label: 'Out for delivery', icon: Truck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        arriving: { label: 'Arriving now', icon: Truck, color: 'text-[#00D68F]', bg: 'bg-[#00D68F]/10' },
        delivered: { label: 'Delivered', icon: Home, color: 'text-[#00D68F]', bg: 'bg-[#00D68F]/10' }
    };

    const Config = statusConfig[status];

    const handleSubmitReview = async () => {
        if (!reviewBusiness || isSubmittingReview) return;
        setIsSubmittingReview(true);
        triggerHaptic();

        try {
            const { error } = await supabase
                .from('business_reviews')
                .insert({
                    business_id: reviewBusiness.id,
                    user_id: user.id,
                    rating: userRating,
                    comment: userComment
                });

            if (error) throw error;

            setReviewedIds(prev => [...prev, reviewBusiness.id]);
            setShowReviewModal(false);
            setUserComment('');
            setUserRating(5);
            setReviewBusiness(null);
            showAlert("Success", "Thank you for your review!", "success");
        } catch (err: any) {
            console.error("Review Submission Error:", err);
            showAlert("Error", "Could not submit review. Please try again.", "error");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    if (isLoading && !orderInfo) {
        return (
            <div className={`h-full flex items-center justify-center ${bgMain}`}>
                <Loader2 className="animate-spin text-[#00D68F]" size={40} />
            </div>
        );
    }

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} relative overflow-hidden`}>
            <GreenGlow />

            <div className="pt-safe px-6 pb-6 flex items-center justify-between z-10">
                <button
                    onClick={() => {
                        if (status === 'delivered') setActiveOrderId(null);
                        navigate('dashboard');
                    }}
                    className={`w-10 h-10 rounded-full ${bgCard} shadow-lg flex items-center justify-center active:scale-95 transition-transform`}
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center">
                    <h1 className="font-bold">{activeBatchId ? 'Batch Tracking' : 'Order Tracking'}</h1>
                    <p className={`text-[10px] ${textSec} uppercase tracking-widest font-black`}>
                        {activeBatchId ? `Batch #${activeBatchId.slice(0, 8)}` : `Order #${activeOrderId?.slice(0, 8)}`}
                    </p>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 px-6 pb-40 overflow-y-auto z-10">
                <div className={`${bgCard} rounded-[32px] p-8 shadow-sm relative overflow-hidden`}>
                    <div className="flex flex-col items-center mb-8">
                        <div className={`w-28 h-28 ${Config.bg} rounded-full flex items-center justify-center ${Config.color} mb-6 relative`}>
                            <Config.icon size={48} className={status !== 'delivered' ? 'animate-bounce' : ''} />
                            {status !== 'delivered' && (
                                <div className="absolute inset-0 rounded-full border-4 border-current border-t-transparent animate-spin opacity-20"></div>
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-center mb-2">{Config.label}</h2>
                        <p className={`text-center ${textSec} font-medium`}>
                            {status === 'delivered' ? 'Completed' : 'Estimated arrival: 25 min'}
                        </p>
                    </div>

                    <div className="relative h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-12">
                        <div
                            className="absolute top-0 left-0 h-full bg-[#00D68F] transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    {activeBatchId && batchOrders.length > 0 && (
                        <div className="mb-12 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest opacity-40 mb-2">Merchant Progress</h3>
                            <div className="space-y-3">
                                {batchOrders.map((order, idx) => (
                                    <div key={order.id} className={`p-3 rounded-2xl ${inputBg} flex items-center justify-between`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#00D68F]/10 flex items-center justify-center text-[#00D68F] font-bold text-xs">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">Shop {idx + 1}</p>
                                                <p className={`text-[10px] uppercase font-black ${order.status === 'completed' ? 'text-[#00D68F]' : 'text-orange-500'}`}>
                                                    {order.status}
                                                </p>
                                            </div>
                                        </div>
                                        {order.status === 'completed' && <CheckCircle2 size={16} className="text-[#00D68F]" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full ${progress >= 25 ? 'bg-[#00D68F] text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'} flex items-center justify-center`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${progress < 25 && 'opacity-50'}`}>Order Received</p>
                                <p className={`text-[10px] ${textSec}`}>{orderInfo?.created_at ? new Date(orderInfo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full ${progress >= 50 ? 'bg-[#00D68F] text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'} flex items-center justify-center`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${progress < 50 && 'opacity-50'}`}>Preparing Order</p>
                                <p className={`text-[10px] ${textSec}`}>{progress >= 50 ? 'In progress' : 'Pending'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full ${progress >= 85 ? 'bg-[#00D68F] text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'} flex items-center justify-center`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${progress < 85 && 'opacity-50'}`}>Out for Delivery</p>
                                <p className={`text-[10px] ${textSec}`}>{progress >= 85 ? 'On the way' : 'Pending'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full ${progress >= 100 ? 'bg-[#00D68F] text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'} flex items-center justify-center`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${progress < 100 && 'opacity-50'}`}>Delivered Successfully</p>
                                <p className={`text-[10px] ${textSec}`}>{progress >= 100 ? 'Done' : 'Waiting...'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {status === 'delivered' && (
                    <div className={`${bgCard} mt-6 rounded-[28px] p-6 shadow-sm border-2 border-[#00D68F]/20 animate-scale-in`}>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Star className="text-orange-400 fill-orange-400" size={20} />
                            How was your experience?
                        </h2>
                        <div className="space-y-4">
                            {activeBatchId ? (
                                batchOrders.map((order, idx) => {
                                    const biz = order.businesses;
                                    const bizName = biz?.name || `Shop ${idx + 1}`;
                                    const bizLogo = biz?.image_url || getInitialAvatar(bizName, 40);

                                    return (
                                        <div key={order.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                                                    <img src={bizLogo} className="w-full h-full object-cover" />
                                                </div>
                                                <p className="font-bold text-sm">{bizName}</p>
                                            </div>
                                            <button
                                                disabled={reviewedIds.includes(order.business_id)}
                                                onClick={() => {
                                                    setReviewBusiness({ id: order.business_id, name: bizName });
                                                    setShowReviewModal(true);
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold ${reviewedIds.includes(order.business_id) ? 'bg-gray-100 text-gray-400' : 'bg-[#00D68F] text-black active:scale-95'}`}
                                            >
                                                {reviewedIds.includes(order.business_id) ? 'Rated' : 'Rate Now'}
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                                            <img src={orderInfo?.businesses?.image_url || getInitialAvatar(orderInfo?.businesses?.name || 'Merchant', 40)} className="w-full h-full object-cover" />
                                        </div>
                                        <p className="font-bold text-sm">{orderInfo?.businesses?.name || 'Merchant'}</p>
                                    </div>
                                    <button
                                        disabled={reviewedIds.includes(orderInfo?.business_id)}
                                        onClick={() => {
                                            setReviewBusiness({ id: orderInfo?.business_id, name: orderInfo?.businesses?.name || 'the merchant' });
                                            setShowReviewModal(true);
                                        }}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-bold ${reviewedIds.includes(orderInfo?.business_id) ? 'bg-gray-100 text-gray-400' : 'bg-[#00D68F] text-black active:scale-95'}`}
                                    >
                                        {reviewedIds.includes(orderInfo?.business_id) ? 'Rated' : 'Rate Merchant'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {driver ? (
                    <div className={`${bgCard} mt-6 rounded-[28px] p-6 shadow-sm border border-white/5`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full border-2 border-[#00D68F] bg-cover bg-center bg-[#F2F2F7] flex items-center justify-center overflow-hidden">
                                    {driver.avatar_url ? (
                                        <img src={driver.avatar_url} alt={driver.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Truck size={24} className="text-[#00D68F]" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold">{driver.full_name || 'Assigned Driver'}</h3>
                                    <p className={`text-[10px] uppercase font-black text-[#00D68F]`}>Delivery Expert</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <a href={`tel:${driver.phone}`} className={`w-10 h-10 rounded-full ${inputBg} flex items-center justify-center text-[#00D68F] active:scale-95 transition-transform shadow-sm`}>
                                    <Phone size={20} />
                                </a>
                                <a href={`sms:${driver.phone}?body=Hello, I'm waiting for my order!`} className={`w-10 h-10 rounded-full ${inputBg} flex items-center justify-center text-[#00D68F] active:scale-95 transition-transform shadow-sm`}>
                                    <MessageSquare size={20} />
                                </a>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Star size={14} className="fill-[#00D68F] text-[#00D68F]" />
                                <span className="font-bold text-sm tracking-tight">{driver.average_rating || '5.0'}</span>
                                <span className={`text-[10px] ${textSec}`}>({driver.total_ratings_count || '0'} reviews)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-[#00D68F] animate-pulse"></div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#00D68F]">Active Now</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={`${bgCard} mt-6 rounded-[28px] p-8 shadow-sm flex flex-col items-center gap-3 text-center opacity-60`}>
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center animate-pulse">
                            <Truck size={24} className={textSec} />
                        </div>
                        <p className="text-sm font-bold">Waiting for delivery partner assignment...</p>
                    </div>
                )}

                {(orderInfo?.status === 'pending' || orderInfo?.status === 'accepted') && (
                    <button
                        onClick={handleCancelOrder}
                        className="mt-8 w-full py-4 rounded-2xl border-2 border-red-500/20 text-red-500 font-bold flex items-center justify-center gap-2 active:scale-95 active:bg-red-500/10 transition-all shadow-sm"
                    >
                        <X size={18} />
                        Cancel Order
                    </button>
                )}
            </div>

            {/* Review Modal */}
            {showReviewModal && reviewBusiness && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReviewModal(false)}></div>
                    <div className={`${theme === 'light' ? 'bg-white/80' : 'bg-[#1C1C1E]/80'} backdrop-blur-xl w-full max-w-sm rounded-[32px] p-8 relative z-10 animate-scale-in`}>
                        <h2 className="text-2xl font-bold mb-2">Rate {reviewBusiness.name}</h2>
                        <p className={`text-sm ${textSec} mb-6`}>How was your experience today?</p>

                        <div className="flex justify-center gap-2 mb-8">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => { triggerHaptic(); setUserRating(star); }}
                                    className={`transition-transform active:scale-90 ${userRating >= star ? 'text-orange-400' : 'text-gray-300 dark:text-gray-700'}`}
                                >
                                    <Star size={32} fill={userRating >= star ? "currentColor" : "none"} strokeWidth={2} />
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={userComment}
                            onChange={(e) => setUserComment(e.target.value)}
                            placeholder="Tell us what you loved or how we can improve..."
                            className={`w-full h-32 p-4 rounded-2xl ${theme === 'light' ? 'bg-[#F2F2F7]/50 border border-white/40' : 'bg-white/10 border border-white/5'} backdrop-blur-md outline-none focus:ring-2 focus:ring-[#00D68F] mb-6 resize-none text-sm font-medium`}
                        ></textarea>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className={`flex-1 py-4 rounded-2xl font-bold ${theme === 'light' ? 'bg-gray-100' : 'bg-white/5'} active:scale-95 transition-transform`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitReview}
                                disabled={isSubmittingReview}
                                className="flex-1 py-4 bg-[#00D68F] text-black rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                            >
                                {isSubmittingReview ? <Loader2 size={20} className="animate-spin" /> : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

