import React, { useState } from 'react';
import { ArrowLeft, MapPin, ChevronRight, Truck, Plus, Minus, Trash2, Copy, Check } from 'lucide-react';
import { Theme, Screen, CartItem, UserData, AppSettings } from '../types';
import { triggerHaptic } from '../index';
import { supabase } from '../supabaseClient';

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    goBack: () => void;
    cart: CartItem[];
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
    user: UserData;
    settings: AppSettings;
}

export const CheckoutScreen = ({ theme, navigate, goBack, cart, setCart, user, settings }: Props) => {
    const [deliveryNote, setDeliveryNote] = useState('');
    const [merchants, setMerchants] = useState<Record<string, { name: string, phone: string }>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const uniqueBusinessIds = Array.from(new Set(cart.map(item => item.businessId)));
    const multiStopFee = (uniqueBusinessIds.length - 1) * 30; // D30 for each extra stop
    const deliveryFee = Number(settings.min_delivery_fee) + multiStopFee;
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
                .select('id, name, owner_id')
                .in('id', uniqueBusinessIds);

            if (data && !error) {
                const ownerIds = data.map(b => b.owner_id).filter(id => !!id);
                const { data: owners, error: ownerError } = await supabase
                    .from('profiles')
                    .select('id, phone')
                    .in('id', ownerIds);

                if (owners && !ownerError) {
                    const merchantMap: Record<string, { name: string, phone: string }> = {};
                    data.forEach(b => {
                        const owner = owners.find(o => o.id === b.owner_id);
                        merchantMap[b.id] = {
                            name: b.name,
                            phone: owner?.phone || '+220 123 4567'
                        };
                    });
                    setMerchants(merchantMap);
                }
            }
        };
        fetchMerchantInfo();
    }, [cart]);

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

            // 1. Split cart by merchant and create orders
            for (const [bizId, items] of Object.entries(groupedCart)) {
                const bizSubtotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                // Share the delivery fee proportionally or add it to one (simple approach: full fee on first order or split)
                // For simplicity, we add the shared delivery fee divided by merchant count
                const merchantDeliveryShare = deliveryFee / uniqueBusinessIds.length;
                const orderTotal = bizSubtotal + merchantDeliveryShare;

                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        customer_id: customerId,
                        business_id: bizId,
                        total_amount: orderTotal,
                        status: 'pending',
                        delivery_instructions: deliveryNote,
                        delivery_address: user.location
                    })
                    .select()
                    .single();

                if (orderError) throw orderError;

                // 2. Insert Order Items
                const orderItemsToInsert = items.map(item => ({
                    order_id: orderData.id,
                    product_id: item.id,
                    quantity: item.quantity,
                    price_at_time: item.price
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItemsToInsert);

                if (itemsError) throw itemsError;
            }

            // 3. Success
            setCart([]);
            navigate('order-tracking');
            // Success feedback would usually be a cleaner modal
        } catch (err: any) {
            console.error("Order Placement Error:", err);
            alert(`Order Failed: ${err.message}`);
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
                        onClick={() => { triggerHaptic(); alert("Location selection would open here."); }}
                        className={`flex items-center justify-between p-3 rounded-xl ${inputBg} cursor-pointer active:opacity-80`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-black flex items-center justify-center">
                                <MapPin size={16} />
                            </div>
                            <div>
                                <div className="text-sm font-bold">Home</div>
                                <div className={`text-xs ${textSec}`}>{user.location}</div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="opacity-40" />
                    </div>

                    <div className="mt-4">
                        <label className={`text-xs font-bold ${textSec} mb-2 block`}>Delivery Instructions</label>
                        <input
                            value={deliveryNote}
                            onChange={(e) => setDeliveryNote(e.target.value)}
                            placeholder="e.g. Call when outside"
                            className={`w-full p-3 rounded-xl ${inputBg} outline-none text-sm font-medium`}
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

                {/* Wave Payment Instructions */}
                {uniqueBusinessIds.length > 0 && (
                    <div className={`${bgCard} rounded-2xl p-4 mb-6 shadow-sm`}>
                        <h2 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide opacity-70">
                            Payment Instructions
                        </h2>
                        <div className="space-y-4">
                            {Object.entries(groupedCart).map(([bizId, items]) => {
                                const mSubtotal = items.reduce((s, i) => s + (i.price * i.quantity), 0);
                                const merchant = merchants[bizId];
                                return (
                                    <div key={bizId} className={`${inputBg} p-4 rounded-xl space-y-3`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] uppercase font-black opacity-50 mb-1">Send to {merchant?.name || items[0].businessName}</p>
                                                <p className="font-black text-lg text-[#00D68F]">D{mSubtotal.toFixed(2)}</p>
                                            </div>
                                            <div className="bg-white/10 px-2 py-1 rounded text-[10px] font-bold">Wave Payment</div>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-black/5 dark:border-white/5">
                                            <div className="flex-1">
                                                <p className={`text-[10px] ${textSec} font-bold`}>Wave Account Number</p>
                                                <p className="font-bold">{merchant?.phone || "Loading..."}</p>
                                            </div>
                                            <button
                                                onClick={() => merchant?.phone && copyToClipboard(merchant.phone, bizId)}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${copiedId === bizId ? 'bg-[#00D68F] text-black' : 'bg-white/10 hover:bg-white/20'}`}
                                            >
                                                {copiedId === bizId ? <Check size={18} /> : <Copy size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className={`mt-4 text-[10px] text-center ${textSec} px-4 italic leading-relaxed`}>
                            Please send the exact amounts to each merchant listed above. Your order will be confirmed once payments are received.
                        </p>
                    </div>
                )}
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
        </div>
    );
};
