
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Star, Plus, ThumbsUp, MessageCircle, Loader2 } from 'lucide-react';
import { Theme, Screen, Business, Product, CartItem } from '../types';
import { triggerHaptic, getInitialAvatar } from '../utils/helpers';
import { supabase } from '../supabaseClient';
import { StarRating } from '../components/StarRating';

interface Props {
    theme: Theme;
    navigate: (scr: Screen, addToHistory?: boolean) => void;
    goBack: () => void;
    selectedBusiness: Business | null;
    cart: CartItem[];
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
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
}

export const BusinessDetailScreen = ({ theme, navigate, goBack, selectedBusiness, cart, setCart, showAlert }: Props) => {
    const [selectedFilter, setSelectedFilter] = useState('All');
    const [realReviews, setRealReviews] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [userRating, setUserRating] = useState(5);
    const [userComment, setUserComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Extract unique categories/tags from all products
    const filters = useMemo(() => {
        if (!selectedBusiness) return ['All'];
        const tags = new Set<string>(['All']);
        products.forEach(p => {
            if (p.mainCategory) tags.add(p.mainCategory);
        });
        return Array.from(tags);
    }, [products]);

    React.useEffect(() => {
        if (selectedBusiness) {
            fetchProducts();
            fetchReviews();

            // Real-time subscription for products of THIS business
            const channel = supabase
                .channel(`business-products-${selectedBusiness.id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'products',
                    filter: `business_id=eq.${selectedBusiness.id}`
                }, () => fetchProducts())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [selectedBusiness]);

    const fetchProducts = async () => {
        if (!selectedBusiness) return;
        setLoadingProducts(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('business_id', selectedBusiness.id)
                .order('name', { ascending: true });

            if (data && !error) {
                setProducts(data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    image: p.image_url || '', // Reliable placeholder image
                    description: p.description,
                    stock: p.stock,
                    mainCategory: p.category,
                    categories: [p.category]
                })));
            }
        } catch (err) {
            console.error("Fetch Products Error:", err);
        } finally {
            setLoadingProducts(false);
        }
    };

    const fetchReviews = async () => {
        if (!selectedBusiness) return;
        setLoadingReviews(true);
        try {
            // Explicitly specify the relationship to avoid ambiguity
            const { data, error } = await supabase
                .from('business_reviews')
                .select('*, profiles!user_id(full_name, avatar_url)')
                .eq('business_id', selectedBusiness.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRealReviews(data || []);
        } catch (err) {
            console.error("Fetch Reviews Error:", err);
        } finally {
            setLoadingReviews(false);
        }
    };

    const addToCart = (product: Product, variation?: string) => {
        if (!selectedBusiness || !selectedBusiness.isOpen) return;
        triggerHaptic();
        setCart(prev => {
            const cartItemId = variation ? `${product.id}-${variation}` : product.id;
            const productName = variation ? `${product.name} (${variation})` : product.name;

            const existing = prev.find(i => i.id === cartItemId);
            if (existing) {
                return prev.map(i => i.id === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                ...product,
                id: cartItemId,
                name: productName,
                quantity: 1,
                businessId: selectedBusiness.id,
                businessName: selectedBusiness.name,
                originalProductId: product.id // Store the real UUID for database
            }];
        });
    };

    if (!selectedBusiness) return null;

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    const filteredProducts = products.filter(p => {
        if (selectedFilter === 'All') return true;
        return p.mainCategory === selectedFilter;
    });

    return (
        <div className={`h-full bg-black ${textMain} animate-slide-in relative overflow-hidden`}>
            {/* Background Image Layer (Parallax Background) */}
            <div className="absolute top-0 left-0 right-0 h-[300px] z-0 pointer-events-none">
                <img
                    src={selectedBusiness.image || getInitialAvatar(selectedBusiness.name, 400)}
                    className="w-full h-full object-cover pointer-events-auto"
                    alt={selectedBusiness.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none"></div>
            </div>

            {/* Fixed Back Button - Absolute positioning with fixed size for perfect circle */}
            <div className="fixed top-2 left-2 z-[100] pt-safe pointer-events-none">
                <button
                    onClick={goBack}
                    className="w-12 h-12 bg-black/40 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white active:scale-90 transition-all shadow-2xl mt-4 ml-4 pointer-events-auto overflow-hidden"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="h-full overflow-y-auto relative z-10 no-scrollbar">
                <div className="pt-[220px] pointer-events-none"></div> {/* Spacer to let BG image show through */}

                <div className={`min-h-[calc(100vh-100px)] ${bgMain} rounded-t-[40px] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] flex flex-col pb-32 relative pointer-events-auto`}>

                    {/* Business Info Section - Now inside the scroll flow! */}
                    <div className="px-8 pt-8 pb-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-baseline gap-3 flex-wrap">
                                <h1 className={`text-3xl font-black leading-tight ${theme === 'light' ? 'text-black' : 'text-white'}`}>{selectedBusiness.name}</h1>
                                {!selectedBusiness.isOpen && (
                                    <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider shadow-sm">Closed</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <div className="flex items-center gap-1">
                                    <Star size={14} fill="currentColor" className={selectedBusiness.rating >= 4.5 ? 'text-orange-400' : 'text-gray-400'} />
                                    <span className={`font-bold ${theme === 'light' ? 'text-black' : 'text-white'}`}>{selectedBusiness.rating}</span>
                                </div>
                                <span className={textSec}>({realReviews.length} reviews)</span>
                                <span className="opacity-30 mx-1">•</span>
                                <span className={`uppercase tracking-widest text-[10px] font-black ${theme === 'light' ? 'text-[#00D68F]' : 'text-[#00D68F]'}`}>{selectedBusiness.category}</span>
                            </div>
                        </div>
                    </div>

                    {/* Sticky Category Filter */}
                    <div className="sticky top-0 z-40 bg-inherit rounded-t-[40px] pt-2 pb-2 px-4 shadow-sm border-b border-black/5 dark:border-white/5">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-2 pb-2">
                            {filters.map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => { triggerHaptic(); setSelectedFilter(filter); }}
                                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedFilter === filter
                                        ? 'bg-[#00D68F] text-black shadow-md'
                                        : `${bgCard} ${textSec} border border-transparent`
                                        }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-4 py-6">
                        <h2 className="font-bold text-xl mb-4 px-2">{selectedFilter === 'All' ? 'Menu' : selectedFilter}</h2>

                        <div className="space-y-4 mb-10">
                            {loadingProducts ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 size={32} className="animate-spin text-[#00D68F]" />
                                    <p className={`text-sm ${textSec} font-medium`}>Loading amazing products...</p>
                                </div>
                            ) : products.length > 0 ? (
                                filteredProducts.map(p => (
                                    <ProductCard key={p.id} product={p} addToCart={addToCart} theme={theme} bgCard={bgCard} textSec={textSec} isOpen={selectedBusiness.isOpen} />
                                ))
                            ) : (
                                <div className={`text-center py-10 ${textSec}`}>
                                    <p>No items found for this business yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Reviews Section */}
                        <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-6 px-2">
                                <h2 className="font-bold text-xl">Reviews <span className={`text-sm ${textSec} font-normal`}>({realReviews.length})</span></h2>
                                <button
                                    onClick={() => { triggerHaptic(); setShowReviewModal(true); }}
                                    className="text-[#00D68F] font-bold text-sm bg-[#00D68F]/10 px-4 py-2 rounded-full active:scale-95 transition-transform"
                                >
                                    Write a Review
                                </button>
                            </div>

                            <div className="space-y-4">
                                {loadingReviews && (
                                    <div className="flex justify-center py-4">
                                        <div className="w-6 h-6 border-2 border-[#00D68F] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}

                                {!loadingReviews && realReviews.length === 0 && (
                                    <div className={`text-center py-8 ${textSec} italic text-sm`}>
                                        No reviews yet for this business.
                                    </div>
                                )}

                                {realReviews.map(review => (
                                    <div key={review.id} className={`${bgCard} p-4 rounded-2xl shadow-sm border border-black/5 dark:border-white/5`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`w-8 h-8 rounded-full ${!review.profiles?.avatar_url ? 'bg-[#00D68F]/10 text-[#00D68F]' : 'bg-gray-200'} flex items-center justify-center font-bold text-xs uppercase bg-cover bg-center shadow-sm`}
                                                    style={review.profiles?.avatar_url ? { backgroundImage: `url(${review.profiles.avatar_url})` } : {}}
                                                >
                                                    {!review.profiles?.avatar_url && (review.profiles?.full_name || 'U').charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm block leading-none mb-1">{review.profiles?.full_name || 'User'}</div>
                                                    <div className="flex items-center gap-0.5">
                                                        <StarRating rating={review.rating} size={10} interactive={false} />
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] ${textSec} font-medium`}>{new Date(review.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className={`text-sm ${textSec} leading-relaxed mt-2`}>{review.comment}</p>
                                    </div>
                                ))}
                                {realReviews.length > 5 && <button className={`w-full py-3 text-sm font-bold ${textSec}`}>View all reviews</button>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Sticky Bottoms */}
            {cartCount > 0 && (
                <div className="fixed bottom-8 left-6 right-6 z-50 animate-scale-in">
                    <button onClick={() => navigate('checkout', true)} className="w-full bg-[#00D68F] text-black p-4 rounded-full font-bold text-lg shadow-2xl flex items-center justify-between px-6 active:scale-[0.98] transition-all border border-black/5">
                        <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center text-sm font-bold">{cartCount}</div>
                        <span className="flex-1 text-center font-black">View Cart</span>
                        <span className="font-black">D{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                    </button>
                </div>
            )}

            {/* Review Modal */}
            {showReviewModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReviewModal(false)}></div>
                    <div className={`${theme === 'light' ? 'bg-white' : 'bg-[#1C1C1E]'} w-full max-w-sm rounded-[40px] p-8 relative z-10 animate-scale-in shadow-2xl border border-white/10`}>
                        <h2 className={`text-2xl font-black mb-2 ${textMain}`}>Rate {selectedBusiness.name}</h2>
                        <p className={`text-sm ${textSec} mb-6 font-medium`}>How was your experience today?</p>

                        <div className="flex justify-center mb-8">
                            <StarRating rating={userRating} setRating={setUserRating} size={40} />
                        </div>

                        <textarea
                            value={userComment}
                            onChange={(e) => setUserComment(e.target.value)}
                            placeholder="Tell us what you loved or how we can improve..."
                            className={`w-full h-32 p-5 rounded-3xl ${theme === 'light' ? 'bg-[#F2F2F7] border-gray-200 text-[#1C1C1E]' : 'bg-white/5 border-white/5 text-white'} border outline-none focus:ring-2 focus:ring-[#00D68F] mb-6 resize-none text-sm font-semibold transition-all`}
                        ></textarea>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className={`flex-1 py-4 rounded-2xl font-black text-sm ${theme === 'light' ? 'bg-gray-100 text-gray-500' : 'bg-white/5 text-gray-400'} active:scale-95 transition-all outline-none`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setIsSubmitting(true);
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) {
                                        showAlert("Login Required", "Please log in to leave a review!", "info");
                                        setIsSubmitting(false);
                                        return;
                                    }

                                    const { error } = await supabase.from('business_reviews').upsert({
                                        user_id: session.user.id,
                                        business_id: selectedBusiness.id,
                                        rating: userRating,
                                        comment: userComment
                                    }, { onConflict: 'user_id,business_id' });

                                    if (error) {
                                        showAlert("Error", error.message, "error");
                                    } else {
                                        setShowReviewModal(false);
                                        setUserComment('');
                                        setUserRating(5);
                                        fetchReviews(); // Refresh list
                                    }
                                    setIsSubmitting(false);
                                }}
                                disabled={isSubmitting}
                                className="flex-1 py-4 bg-[#00D68F] text-black rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-[#00D68F]/20 disabled:opacity-50 outline-none"
                            >
                                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Extracted Component for managing internal selection state
interface ProductCardProps {
    product: Product;
    addToCart: (p: Product, v?: string) => void;
    theme: Theme;
    bgCard: string;
    textSec: string;
    isOpen: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, addToCart, theme, bgCard, textSec, isOpen }) => {
    return (
        <div
            className={`${bgCard} p-3 rounded-2xl flex gap-4 shadow-sm transition-all border border-black/5 dark:border-white/5 ${isOpen && product.stock > 0 ? 'active:scale-[0.98] cursor-pointer hover:shadow-md' : 'opacity-60 grayscale cursor-not-allowed'}`}
            onClick={() => { if (isOpen && product.stock > 0) addToCart(product) }}
        >
            {product.image ? (
                <img src={product.image} className="w-24 h-24 rounded-2xl object-cover bg-gray-100 shadow-sm" alt={product.name} />
            ) : (
                <div className="w-24 h-24 rounded-2xl bg-[#00D68F]/10 flex items-center justify-center p-2 text-center shadow-sm">
                    <span className="text-[11px] font-black text-[#00D68F] uppercase leading-tight tracking-tighter">
                        {product.name}
                    </span>
                </div>
            )}
            <div className="flex-1 flex flex-col justify-between py-0.5">
                <div>
                    <h3 className="font-bold text-base mb-1">{product.name}</h3>

                    {/* Stock & Description Area */}
                    <div className="mt-1">
                        <div className={`text-[10px] font-black uppercase tracking-wider ${product.stock > 0 ? 'text-[#00D68F]' : 'text-red-500'} mb-1`}>
                            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </div>
                        <div className={`text-[11px] font-medium leading-relaxed opacity-80 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} line-clamp-3`}>
                            {product.description || 'No description provided.'}
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="font-black text-lg">D{product.price}</span>
                    <div className="w-9 h-9 rounded-full bg-[#00D68F]/10 text-[#00D68F] flex items-center justify-center shadow-inner">
                        <Plus size={18} strokeWidth={3} />
                    </div>
                </div>
            </div>
        </div>
    );
};
