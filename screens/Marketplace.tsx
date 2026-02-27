
import React, { useState } from 'react';
import { Search, Star, MapPin, Heart } from 'lucide-react';
import { Theme, Screen, Business, Category, UserData } from '../types';
import { triggerHaptic } from '../utils/helpers';

interface Props {
   theme: Theme;
   navigate: (scr: Screen, addToHistory?: boolean) => void;
   businesses: Business[];
   categories: Category[];
   setSelectedBusiness: (b: Business | null) => void;
   isScrolling: boolean;
   isNavVisible: boolean;
   handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
   toggleFavorite: (id: string, e?: React.MouseEvent) => void;
   favorites: string[];
   searchQuery: string;
   setSearchQuery: (q: string) => void;
   user: UserData;
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

// Haversine formula to calculate distance in KM
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
   const R = 6371; // Radius of the earth in km
   const dLat = (lat2 - lat1) * Math.PI / 180;
   const dLon = (lon2 - lon1) * Math.PI / 180;
   const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   const d = R * c;
   return d;
};

export const MarketplaceScreen = ({ theme, navigate, businesses, categories, setSelectedBusiness, isScrolling, isNavVisible, handleScroll, toggleFavorite, favorites, searchQuery, setSearchQuery, showAlert, user }: Props) => {
   const [selectedCategory, setSelectedCategory] = useState('All');

   const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
   const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
   const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
   const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
   const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

   const displayCategories = ['All', ...categories.map(c => c.name)];

   const filteredBusinesses = businesses.filter(b => {
      const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         b.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
   });

   const filteredProducts = businesses.flatMap(b =>
      b.products.map(p => ({ ...p, business: b }))
   ).filter(p => {
      if (!searchQuery) return false;
      return p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         p.mainCategory.toLowerCase().includes(searchQuery.toLowerCase());
   });

   return (
      <div className={`h-full flex flex-col ${bgMain} ${textMain} animate-slide-in`}>
         <div className={`pt-safe px-6 pb-4 ${theme === 'light' ? 'bg-white/80' : 'bg-black/80'} backdrop-blur-md z-10 sticky top-0 border-b ${theme === 'light' ? 'border-gray-200' : 'border-gray-800'}`}>
            <h1 className="text-3xl font-black tracking-tight mb-4">Marketplace</h1>
            <div className={`flex items-center gap-3 p-3 rounded-[22px] h-14 ${theme === 'light' ? 'bg-white border-none shadow-[0_12px_40px_rgba(0,0,0,0.06)] focus-within:shadow-[0_12px_40px_rgba(0,214,143,0.15)] focus-within:ring-2 focus-within:ring-[#00D68F]/20' : 'bg-[#1C1C1E]/60 border border-white/5 shadow-lg focus-within:ring-2 focus-within:ring-[#00D68F]/30'} backdrop-blur-xl transition-all`}>
               <Search size={20} className={`${textSec} ml-2`} />
               <input
                  placeholder="Restaurants, groceries, etc."
                  className="bg-transparent flex-1 outline-none font-bold text-base placeholder:opacity-50 h-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
               />
            </div>
            <div className="flex gap-3 mt-4 overflow-x-auto no-scrollbar pb-2">
               {displayCategories.map(c => (
                  <button
                     key={c}
                     onClick={() => setSelectedCategory(c)}
                     className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all shadow-sm ${selectedCategory === c ? 'bg-[#00D68F] text-black border border-[#00D68F]' : `bg-white dark:bg-[#1C1C1E] border ${theme === 'light' ? 'border-gray-200' : 'border-gray-800'} ${textSec}`}`}
                  >
                     {c}
                  </button>
               ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto min-h-0 px-6 pt-4 pb-32 space-y-6" onScroll={handleScroll}>
            {/* Products Section (Only if searching) */}
            {searchQuery && filteredProducts.length > 0 && (
               <div className="space-y-4">
                  <h2 className="font-bold text-lg">Products Found</h2>
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                     {filteredProducts.map(p => (
                        <div
                           key={`${p.business.id}-${p.id}`}
                           onClick={() => { setSelectedBusiness(p.business); navigate('business-detail', true); }}
                           className={`min-w-[140px] ${bgCard} p-3 rounded-2xl shadow-sm cursor-pointer active:scale-95 transition-all flex flex-col gap-2`}
                        >
                           <img src={p.image} className="w-full h-24 object-cover rounded-xl" alt={p.name} />
                           <div>
                              <div className="font-bold text-xs truncate">{p.name}</div>
                              <div className="text-[10px] text-[#00D68F] font-black">D{p.price}</div>
                              <div className={`text-[9px] ${textSec} truncate`}>{p.business.name}</div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            <h2 className="font-bold text-lg">
               {selectedCategory === 'All' ? 'Featured Spots' : `${selectedCategory} Spots`}
            </h2>

            {filteredBusinesses.length > 0 ? (
               filteredBusinesses.map(b => (
                  <div
                     key={b.id}
                     onClick={() => { setSelectedBusiness(b); navigate('business-detail', true); }}
                     className={`group ${bgCard} p-4 rounded-[24px] shadow-[0_8px_20px_rgba(0,0,0,0.03)] border-b border-transparent dark:border-white/5 ${b.isOpen ? 'cursor-pointer active:scale-[0.98] hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)]' : 'opacity-50 grayscale cursor-not-allowed'} transition-all duration-300 flex items-center gap-4`}
                  >
                     {/* Logo / Image on Left */}
                     <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800 border border-black/5 dark:border-white/5 relative">
                        <img src={b.logo || b.image} className="w-full h-full object-cover" alt={b.name} />
                        {!b.isOpen && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[8px] font-bold text-white uppercase backdrop-blur-sm">Closed</div>}
                     </div>

                     {/* Content Middle */}
                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                           <h3 className="text-base font-black tracking-tight truncate pr-2">{b.name}</h3>
                        </div>
                        <p className={`text-xs ${textSec} line-clamp-1 mb-1.5`}>{b.description}</p>

                        <div className="flex items-center gap-3 text-xs font-medium opacity-80">
                           <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${b.rating >= 5.0 ? 'bg-[#00D68F]/10 text-[#00D68F]' : b.rating >= 3.8 ? 'bg-orange-500/10 text-orange-600' : 'bg-red-500/10 text-red-600'}`}>
                              <Star size={10} fill="currentColor" /> {b.rating}
                           </span>
                           <span className={`flex items-center gap-1 ${textSec}`}>
                              <MapPin size={10} /> {user.last_lat && user.last_lng && b.lat && b.lng ? `${getDistance(user.last_lat, user.last_lng, b.lat, b.lng).toFixed(1)} km` : b.distance}
                           </span>
                        </div>
                     </div>

                     {/* Favorite Button Right */}
                     <button
                        onClick={(e) => toggleFavorite(b.id, e)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${favorites.includes(b.id) ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-gray-50 dark:bg-white/5 text-gray-400'}`}
                        disabled={!b.isOpen}
                     >
                        <Heart size={20} className={favorites.includes(b.id) ? "fill-current" : ""} />
                     </button>
                  </div>
               ))
            ) : (
               <div className="py-10 text-center opacity-60">
                  <p>No businesses found in this category.</p>
               </div>
            )}
         </div>
      </div>
   );
};
