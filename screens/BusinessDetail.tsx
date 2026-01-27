
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Star, Plus, ThumbsUp, MessageCircle } from 'lucide-react';
import { Theme, Screen, Business, Product, CartItem } from '../types';
import { triggerHaptic } from '../index';
import { supabase } from '../supabaseClient';

interface Props {
    theme: Theme;
    navigate: (scr: Screen, addToHistory?: boolean) => void;
    goBack: () => void;
    selectedBusiness: Business | null;
    cart: CartItem[];
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

export const BusinessDetailScreen = ({ theme, navigate, goBack, selectedBusiness, cart, setCart }: Props) => {
    const [selectedFilter, setSelectedFilter] = useState('All');
    const [realReviews, setRealReviews] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [userRating, setUserRating] = useState(5);
    const [userComment, setUserComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!selectedBusiness) return null;

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';

    const addToCart = (product: Product, variation?: string) => {
        triggerHaptic();
        setCart(prev => {
            // Create a unique ID based on product ID and variation to differentiate in cart
            const cartItemId = variation ? `${product.id}-${variation}` : product.id;
            const productName = variation ? `${product.name} (${variation})` : product.name;

            const existing = prev.find(i => i.id === cartItemId);
            if (existing) {
                return prev.map(i => i.id === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                ...product,
                id: cartItemId, // Override ID for cart uniqueness
                name: productName, // Override name to include variation
                quantity: 1,
                businessId: selectedBusiness.id,
                businessName: selectedBusiness.name
            }];
        });
    };

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    // Extract unique categories/tags from all products
    const filters = useMemo(() => {
        const tags = new Set<string>(['All']);
        // Add Main Categories
        selectedBusiness.products.forEach(p => {
            if (p.mainCategory) tags.add(p.mainCategory);
        });
        return Array.from(tags);
    }, [selectedBusiness]);

    React.useEffect(() => {
        if (selectedBusiness) {
            fetchReviews();
        }
    }, [selectedBusiness]);

    const fetchReviews = async () => {
        if (!selectedBusiness) return;
        setLoadingReviews(true);
        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('*, profiles(full_name)')
                .eq('target_id', selectedBusiness.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRealReviews(data || []);
        } catch (err) {
            console.error("Fetch Reviews Error:", err);
        } finally {
            setLoadingReviews(false);
        }
    };

    const filteredProducts = selectedBusiness.products.filter(p => {
        if (selectedFilter === 'All') return true;
        return p.mainCategory === selectedFilter;
    });

    return (
        <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in relative`}>
            {/* Header Image & Back Button */}
            <div className="h-64 relative shrink-0">
                <img src={selectedBusiness.image} className="w-full h-full object-cover" alt={selectedBusiness.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>

                {/* Consistent Back Button Style */}
                <button
                    onClick={goBack}
                    className="absolute top-safe left-4 w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white z-20 active:scale-90 transition-transform"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="absolute bottom-6 left-6 right-6 text-white">
                    <h1 className="text-3xl font-bold mb-2">{selectedBusiness.name}</h1>
                    <div className="flex items-center gap-2 text-sm opacity-90">
                        <Star size={14} fill="currentColor" className="text-orange-400" />
                        <span className="font-bold">{selectedBusiness.rating}</span>
                        <span>({selectedBusiness.reviews} reviews)</span>
                        <span>•</span>
                        <span>{selectedBusiness.category}</span>
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto px-4 pt-6 pb-32 -mt-6 rounded-t-[32px] ${bgMain} relative z-10`}>

                {/* Category Filter */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
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

                <h2 className="font-bold text-xl mb-4 px-2">{selectedFilter === 'All' ? 'Menu' : selectedFilter}</h2>

                <div className="space-y-4 mb-8">
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(p => (
                            <ProductCard key={p.id} product={p} addToCart={addToCart} theme={theme} bgCard={bgCard} textSec={textSec} />
                        ))
                    ) : (
                        <div className={`text-center py-10 ${textSec}`}>
                            <p>No items found in this category.</p>
                        </div>
                    )}
                </div>

                {/* Reviews Section */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h2 className="font-bold text-xl">Reviews <span className={`text-sm ${textSec} font-normal`}>({selectedBusiness.reviews})</span></h2>
                        <button
                            onClick={() => { triggerHaptic(); setShowReviewModal(true); }}
                            className="text-[#00D68F] font-bold text-sm bg-[#00D68F]/10 px-3 py-1.5 rounded-full"
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
                            <div key={review.id} className={`${bgCard} p-4 rounded-2xl shadow-sm`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-[#00D68F]/10 text-[#00D68F] flex items-center justify-center font-bold text-xs uppercase">
                                            {(review.profiles?.full_name || 'U').charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">{review.profiles?.full_name || 'User'}</div>
                                            <div className="flex items-center gap-1 text-[10px] text-orange-400">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={8} fill={i < review.rating ? "currentColor" : "none"} strokeWidth={i < review.rating ? 0 : 2} className={i >= review.rating ? textSec : ""} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] ${textSec}`}>{new Date(review.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className={`text-sm ${textSec} leading-relaxed`}>{review.comment}</p>
                                <div className="flex gap-4 mt-3">
                                    <button className={`flex items-center gap-1 text-xs ${textSec} hover:text-[#00D68F]`}>
                                        <ThumbsUp size={12} /> Helpful
                                    </button>
                                </div>
                            </div>
                        ))}
                        {realReviews.length > 5 && <button className={`w-full py-3 text-sm font-bold ${textSec}`}>View all reviews</button>}
                    </div>
                </div>
            </div>

            {cartCount > 0 && (
                <div className="fixed bottom-8 left-6 right-6 z-50 animate-scale-in">
                    <button onClick={() => navigate('checkout', true)} className="w-full bg-[#00D68F] text-black p-4 rounded-full font-bold text-lg shadow-xl flex items-center justify-between px-6 active:scale-[0.98] transition-transform">
                        <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center text-sm font-bold">{cartCount}</div>
                        <span>View Cart</span>
                        <span>D{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
                    </button>
                </div>
            )}

            {/* Review Modal */}
            {showReviewModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReviewModal(false)}></div>
                    <div className={`${bgCard} w-full max-w-sm rounded-[32px] p-8 relative z-10 animate-scale-in`}>
                        <h2 className="text-2xl font-bold mb-2">Rate {selectedBusiness.name}</h2>
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
                            className={`w-full h-32 p-4 rounded-2xl ${theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-white/5'} outline-none focus:ring-2 focus:ring-[#00D68F] mb-6 resize-none text-sm font-medium`}
                        ></textarea>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className={`flex-1 py-4 rounded-2xl font-bold ${theme === 'light' ? 'bg-gray-100' : 'bg-white/5'} active:scale-95 transition-transform`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setIsSubmitting(true);
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) {
                                        alert("Please login to leave a review!");
                                        setIsSubmitting(false);
                                        return;
                                    }

                                    const { error } = await supabase.from('reviews').insert({
                                        reviewer_id: session.user.id,
                                        target_id: selectedBusiness.id,
                                        rating: userRating,
                                        comment: userComment,
                                        role_target: 'merchant'
                                    });

                                    if (error) {
                                        alert("Error submitting review: " + error.message);
                                    } else {
                                        setShowReviewModal(false);
                                        setUserComment('');
                                        setUserRating(5);
                                        fetchReviews(); // Refresh list
                                    }
                                    setIsSubmitting(false);
                                }}
                                disabled={isSubmitting}
                                className="flex-1 py-4 bg-[#00D68F] text-black rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
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
}

const ProductCard: React.FC<ProductCardProps> = ({ product, addToCart, theme, bgCard, textSec }) => {
    const [selectedVar, setSelectedVar] = useState(product.categories?.[0] || '');

    return (
        <div className={`${bgCard} p-3 rounded-2xl flex gap-4 shadow-sm active:scale-[0.99] transition-transform cursor-pointer`} onClick={() => addToCart(product, selectedVar)}>
            <img src={product.image} className="w-24 h-24 rounded-xl object-cover bg-gray-100" alt={product.name} />
            <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                    <h3 className="font-bold mb-1">{product.name}</h3>
                    <p className={`text-xs ${textSec} line-clamp-2`}>{product.description}</p>

                    {/* Variations Dropdown */}
                    {product.categories && product.categories.length > 0 && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <select
                                value={selectedVar}
                                onChange={(e) => setSelectedVar(e.target.value)}
                                className={`text-[10px] px-2 py-1.5 rounded-lg border-none outline-none font-medium w-full ${theme === 'light' ? 'bg-gray-100 text-gray-700' : 'bg-white/10 text-gray-200'}`}
                            >
                                {product.categories.map((tag) => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="font-bold">D{product.price}</span>
                    <div className="w-8 h-8 rounded-full bg-[#00D68F]/10 text-[#00D68F] flex items-center justify-center">
                        <Plus size={16} strokeWidth={3} />
                    </div>
                </div>
            </div>
        </div>
    );
}
