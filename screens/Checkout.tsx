import React, { useState } from 'react';
import { ArrowLeft, MapPin, ChevronRight, Truck, Plus, Minus, Trash2, Copy, Check, Info } from 'lucide-react';
import { Theme, Screen, CartItem, UserData, AppSettings } from '../types';
import { triggerHaptic } from '../utils/helpers';
import { supabase } from '../supabaseClient';
import { LocationPicker } from '../components/LocationPicker';

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    goBack: () => void;
    cart: CartItem[];
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
    user: UserData;
    settings: AppSettings;
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
    setActiveOrderId: (id: string | null) => void;
    setActiveBatchId: (id: string | null) => void;
}

export const CheckoutScreen = ({ theme, navigate, goBack, cart, setCart, user, settings, showAlert, setActiveOrderId, setActiveBatchId }: Props) => {
    const [merchants, setMerchants] = useState<Record<string, { name: string, phone: string, lat?: number, lng?: number }>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [deliveryLocation, setDeliveryLocation] = useState<{ address: string; lat: number; lng: number }>({
        address: user.location || 'Banjul, The Gambia',
        lat: user.last_lat || 13.4432,
        lng: user.last_lng || -16.6322
    });
    const [deliveryNote, setDeliveryNote] = useState('');
    const [deliveryDistance, setDeliveryDistance] = useState<number | null>(null);

    const uniqueBusinessIds = Array.from(new Set(cart.map(item => item.businessId)));

    // Calculate Delivery Fee
    const getDeliveryFee = () => {
        if (!settings) return 0;
        const minFee = Number(settings.min_delivery_fee);
        if (deliveryDistance === null) return minFee;

        const pricePerKm = Number(settings.price_per_km);
        const distanceKm = deliveryDistance / 1000;
        const calculatedFee = distanceKm * pricePerKm;

        return Math.max(minFee, calculatedFee);
    };

    const deliveryFee = getDeliveryFee();
    const subtotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const total = subtotal + deliveryFee;

    const groupedCart = cart.reduce((acc, item) => {
        if (!acc[item.businessId]) acc[item.businessId] = [];
        acc[item.businessId].push(item);
        return acc;
    }, {} as Record<string, CartItem[]>);

    React.useEffect(() => {
        const fetchMerchantInfo = async () => {
            if (uniqueBusinessIds.length === 0) return;
            const { data, error } = await supabase
                .from('businesses')
                .select('id, name, owner_id, lat, lng')
                .in('id', uniqueBusinessIds);

            if (data && !error) {
                const ownerIds = data.map(b => b.owner_id).filter(id => !!id);
                const { data: owners, error: ownerError } = await supabase
                    .from('profiles')
                    .select('id, phone')
                    .in('id', ownerIds);

                if (owners && !ownerError) {
                    const merchantMap: Record<string, { name: string, phone: string, lat?: number, lng?: number }> = {};
                    data.forEach(b => {
                        const owner = owners.find(o => o.id === b.owner_id);
                        merchantMap[b.id] = {
                            name: b.name,
                            phone: owner?.phone || '+220 123 4567',
                            lat: b.lat,
                            lng: b.lng
                        };
                    });
                    setMerchants(merchantMap);
                }
            }
        };
        fetchMerchantInfo();
    }, [cart]);

    // Distance Matrix Calculation
    React.useEffect(() => {
        const calculateRouteDistance = async () => {
            if (uniqueBusinessIds.length === 0 || !merchants || Object.keys(merchants).length < uniqueBusinessIds.length) return;
            if (!window.google) return;

            const service = new window.google.maps.DistanceMatrixService();

            // For a multi-merchant order, the route is:
            // Pickup 1 -> Pickup 2 -> ... -> Customer Dropoff
            // We want the total distance.

            // Sort merchants to optimize route? For now, we'll just follow cart order or merchant order
            const waypoints = uniqueBusinessIds.map(id => merchants[id]).filter(m => m && m.lat && m.lng);
            if (waypoints.length === 0) return;

            // Sequential distance:
            // Driver (approx from first merchant) -> Merchant 1 -> Merchant 2 -> Customer
            // Simplified: distance from M1 to M2 + M2 to M3 ... + Last M to Customer

            let totalMeters = 0;
            const points = [...waypoints, { lat: deliveryLocation.lat, lng: deliveryLocation.lng }];

            for (let i = 0; i < points.length - 1; i++) {
                try {
                    const result = await new Promise<any>((resolve, reject) => {
                        service.getDistanceMatrix({
                            origins: [{ lat: points[i].lat, lng: points[i].lng }],
                            destinations: [{ lat: points[i + 1].lat, lng: points[i + 1].lng }],
                            travelMode: window.google.maps.TravelMode.DRIVING,
                        }, (response: any, status: any) => {
                            if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
                                resolve(response.rows[0].elements[0].distance.value);
                            } else {
                                reject(status);
                            }
                        });
                    });
                    totalMeters += result;
                } catch (e) {
                    console.error("Distance Matrix Error:", e);
                }
            }

            setDeliveryDistance(totalMeters);
        };

        calculateRouteDistance();
    }, [merchants, deliveryLocation, uniqueBusinessIds.length]);

    const copyToClipboard = (text: string, id: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedId(id);
            triggerHaptic();
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';
    const separator = theme === 'light' ? 'border-[#C6C6C8]' : 'border-[#38383A]';

    const updateQuantity = (itemId: string, delta: number) => {
        triggerHaptic();
        setCart(prev => {
            return prev.map(item => {
                if (item.id === itemId) {
                    return { ...item, quantity: Math.max(0, item.quantity + delta) };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const handlePlaceOrder = async () => {
        if (cart.length === 0 || isSubmitting) return;
        setIsSubmitting(true);
        triggerHaptic();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Please log in to place an order.");

            const customerId = session.user.id;

            // Verify all businesses are open
            const { data: bizData, error: bizError } = await supabase
                .from('businesses')
                .select('id, name, is_open')
                .in('id', uniqueBusinessIds);

            if (bizError) throw bizError;

            const closedBusinesses = bizData?.filter(b => !b.is_open) || [];
            if (closedBusinesses.length > 0) {
                const names = closedBusinesses.map(b => b.name).join(", ");
                throw new Error(`The following businesses are currently closed: ${names}. Please remove their items from your cart to proceed.`);
            }

            // Generate batch_id for multi-merchant orders
            const batchId = uniqueBusinessIds.length > 1 ? crypto.randomUUID() : null;
            let firstOrderId: string | null = null;

            // 1. Split cart by merchant and create orders
            for (const [bizId, items] of Object.entries(groupedCart)) {
                const bizSubtotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);

                // Split delivery fee proportionally based on subtotal (with safety check)
                const merchantDeliveryShare = subtotal > 0 ? deliveryFee * (bizSubtotal / subtotal) : 0;
                const orderTotal = bizSubtotal + merchantDeliveryShare;

                if (isNaN(orderTotal)) {
                    throw new Error("Invalid order total calculation. Please check your cart items.");
                }

                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        customer_id: customerId,
                        business_id: bizId,
                        batch_id: batchId,
                        total_amount: Number(orderTotal.toFixed(2)),
                        status: 'pending',
                        delivery_instructions: deliveryNote,
                        delivery_address: deliveryLocation.address
                    })
                    .select()
                    .single();

                if (orderError) {
                    console.error("Order Insert Error Details:", orderError);
                    throw new Error(`Order failed at ${merchants[bizId]?.name || 'Merchant'}: ${orderError.message}`);
                }
                if (!orderData) throw new Error("Could not create order row. Please try again.");

                if (!firstOrderId) firstOrderId = orderData.id;

                // 2. Insert Order Items
                const orderItemsToInsert = items.map(item => ({
                    order_id: orderData.id,
                    product_id: item.originalProductId,
                    quantity: item.quantity,
                    price_at_time: item.price
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItemsToInsert);

                if (itemsError) {
                    console.error("Order Items Insert Error Details:", itemsError);
                    throw new Error(`Items failed for ${merchants[bizId]?.name || 'Merchant'}: ${itemsError.message}`);
                }
            }

            // Track for real-time tracking
            if (batchId) {
                setActiveBatchId(batchId);
                setActiveOrderId(null); // Clear single order ID if using batch
            } else if (firstOrderId) {
                setActiveOrderId(firstOrderId);
                setActiveBatchId(null);
            }

            // 3. Success
            setCart([]);
            navigate('order-tracking');
        } catch (err: any) {
            console.error("Order Placement Final Catch:", err);
            showAlert("Order Failed", err.message || "An unexpected error occurred. Please try again.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in`}>
            {/* Consistent Header */}
            <div className={`pt-safe px-4 pb-4 flex items-center gap-4 ${bgMain} sticky top-0 z-10 border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-800'}`}>
                <button onClick={goBack} className={`p-2 rounded-full ${theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-gray-800'} transition-colors`}>
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">Checkout</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32">

                {/* Delivery Location Section */}
                <div className={`${bgCard} rounded-2xl p-4 mb-6 shadow-sm`}>
                    <h2 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide opacity-70">
                        <MapPin size={16} className="text-[#00D68F]" /> Dropoff Location
                    </h2>
                    <div
                        onClick={() => { triggerHaptic(); setShowPicker(true); }}
                        className={`flex items-center justify-between p-3 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md cursor-pointer active:opacity-80`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-black flex items-center justify-center">
                                <MapPin size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold">Delivery Spot</div>
                                <div className={`text-xs ${textSec} truncate`}>{deliveryLocation.address}</div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="opacity-40" />
                    </div>


                    <div className="mt-4">
                        <label className={`text-xs font-bold ${textSec} mb-2 block`}>Delivery Instructions</label>
                        <input
                            value={deliveryNote}
                            onChange={(e) => setDeliveryNote(e.target.value)}
                            className={`w-full p-4 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md outline-none font-medium`}
                            placeholder="e.g. Ring the doorbell, Leave at front desk"
                        />
                    </div>
                </div>

                {/* Order Summary */}
                <div className={`${bgCard} rounded-2xl p-4 mb-6 shadow-sm`}>
                    <h2 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide opacity-70">
                        <Truck size={16} className="text-[#00D68F]" /> Order Summary
                    </h2>

                    {cart.length === 0 ? (
                        <div className={`text-center py-6 ${textSec} text-sm`}>Your cart is empty.</div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedCart).map(([bizId, items]) => (
                                <div key={bizId} className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-white/5">
                                        <h3 className="font-black text-xs uppercase tracking-widest text-[#00D68F]">
                                            {merchants[bizId]?.name || items[0].businessName || "Merchant"}
                                        </h3>
                                        <span className={`text-[10px] ${textSec} font-bold`}>{items.length} items</span>
                                    </div>
                                    <div className="space-y-4">
                                        {items.map(item => (
                                            <div key={item.id} className="flex flex-col gap-2">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-sm max-w-[200px]">{item.name}</span>
                                                    <span className="font-bold text-sm">D{(item.price * item.quantity).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <p className={`text-xs ${textSec}`}>D{item.price} each</p>
                                                    <div className={`flex items-center gap-3 p-1 rounded-lg ${inputBg}`}>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-black shadow-sm active:scale-90 transition-transform"
                                                        >
                                                            {item.quantity === 1 ? <Trash2 size={14} className="text-red-500" /> : <Minus size={14} />}
                                                        </button>
                                                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-black shadow-sm active:scale-90 transition-transform"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <p className="text-xs font-bold opacity-60">Merchant Subtotal: D{items.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2 mt-8 pt-4 border-t border-gray-100 dark:border-white/5">
                        <div className="flex justify-between items-center text-sm">
                            <span className={textSec}>Items Subtotal</span>
                            <span className="font-medium">D{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-1.5">
                                <span className={textSec}>Delivery Fee</span>
                                {uniqueBusinessIds.length > 1 && (
                                    <span className="text-[10px] bg-[#00D68F]/10 text-[#00D68F] px-1.5 py-0.5 rounded font-black uppercase">Multi-Stop</span>
                                )}
                            </div>
                            <span className="font-medium">D{deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className={`h-px ${separator} my-2`}></div>
                        <div className="flex justify-between items-center font-bold text-lg">
                            <span>Total</span>
                            <span className="text-[#00D68F]">D{total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Notice */}
                <div className={`${bgCard} rounded-2xl p-6 mb-6 shadow-sm border-2 border-[#00D68F]/20`}>
                    <h2 className="font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide text-[#00D68F]">
                        <Check size={16} /> Pay Cash on Delivery
                    </h2>
                    <p className="text-sm font-medium leading-relaxed opacity-80">
                        Please have <span className="font-black text-[#00D68F]">D{total.toFixed(2)}</span> ready to pay the driver in cash when they arrive with your order.
                    </p>
                    <div className={`mt-4 p-3 rounded-xl ${inputBg} text-[10px] font-bold flex items-center gap-2`}>
                        <Info size={14} className="shrink-0" />
                        <span>This total includes items from {uniqueBusinessIds.length} shop{uniqueBusinessIds.length > 1 ? 's' : ''} and the delivery fee.</span>
                    </div>
                </div>
            </div>

            <div className={`p-4 ${bgCard} pb-safe border-t ${separator}`}>
                <button
                    onClick={handlePlaceOrder}
                    disabled={cart.length === 0 || isSubmitting}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-full font-bold text-lg shadow-lg active:scale-[0.98] transition-transform flex justify-between px-6 items-center disabled:opacity-50"
                >
                    <span>{isSubmitting ? 'Processing...' : 'Place Order'}</span>
                    <span>D{total.toFixed(2)}</span>
                </button>
            </div>

            {showPicker && (
                <LocationPicker
                    theme={theme}
                    onConfirm={(loc) => { setDeliveryLocation(loc); setShowPicker(false); }}
                    onClose={() => setShowPicker(false)}
                    title="Set Delivery Location"
                    initialLocation={{ lat: deliveryLocation.lat, lng: deliveryLocation.lng }}
                    user={user}
                />
            )}
        </div>
    );
};
