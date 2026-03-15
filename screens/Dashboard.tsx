
import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Search, Car, MapPin, ShoppingBag, Star, Trash, Trash2, X, Plus, ArrowRight, Loader2, Map as MapIcon, Gift, Truck, Phone } from 'lucide-react';
import { Theme, Screen, UserData, Activity, Business, SavedLocation, AppSettings } from '../types';
import { triggerHaptic } from '../utils/helpers';

import { supabase } from '../supabaseClient';
import { LocationPicker } from '../components/LocationPicker';
import { initFCM } from '../utils/fcm';

interface Props {
  user: UserData;
  theme: Theme;
  navigate: (scr: Screen, addToHistory?: boolean) => void;
  toggleTheme: () => void;
  setShowAssistant: (s: boolean) => void;
  favorites: string[];
  businesses: Business[];
  recentActivities: Activity[];
  setRecentActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
  setSelectedBusiness: (b: Business | null) => void;
  isScrolling: boolean;
  isNavVisible: boolean;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  setPrefilledDestination: (dest: string | null) => void;
  setPrefilledTier: (tier: string | null) => void;
  setPrefilledDistance: (dist: number | null) => void;
  setMarketSearchQuery: (q: string) => void;
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
  activeOrderId: string | null;
  activeBatchId: string | null;
  setIsNavVisible: (visible: boolean) => void;
  setProfileDrawerToOpen: (val: string) => void;
  isActivitiesLoading: boolean;
  isFavoritesLoading: boolean;
  locationPromptDone: boolean;
}



export const DashboardScreen = ({ user, theme, navigate, toggleTheme, setShowAssistant, favorites, businesses, recentActivities, setRecentActivities, setSelectedBusiness, isScrolling, isNavVisible, handleScroll, setPrefilledDestination, setPrefilledTier, setPrefilledDistance, setMarketSearchQuery, settings, showAlert, activeOrderId, activeBatchId, setIsNavVisible, setProfileDrawerToOpen, isActivitiesLoading, isFavoritesLoading, locationPromptDone }: Props) => {
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [placeholderText, setPlaceholderText] = useState("Where to?");
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(() => {
    try {
      const cached = localStorage.getItem('cached_locations');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error("Failed to parse cached_locations", e);
      localStorage.removeItem('cached_locations');
      return [];
    }
  });
  const [showSaveDrawer, setShowSaveDrawer] = useState(false);
  const [saveStep, setSaveStep] = useState(1);
  const [newLocLabel, setNewLocLabel] = useState('');
  const [newLocEmoji, setNewLocEmoji] = useState('🏠');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'market' | 'maps'>('market');
  const [predictions, setPredictions] = useState<any[]>([]);
  const searchTimeout = useRef<any>(null);
  const sessionToken = useRef<any>(null);

  const EMOJIS = ['🏠', '💼', '🏋️', '🏫', '🌳', '🛍️', '🍽️', '🎾'];
  const LABELS = ['Home', 'Work', 'Gym', 'School', 'Park', 'Mall', 'Restaurant', 'Club'];

  useEffect(() => {
    fetchLocations();
    implementQuietMode();
  }, []);

  useEffect(() => {
    if (showSaveDrawer || showMapPicker) {
      setIsNavVisible(false);
    } else {
      setIsNavVisible(true);
    }
  }, [showSaveDrawer, showMapPicker, setIsNavVisible]);

  const implementQuietMode = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Set driver to offline when using user app
      await supabase
        .from('drivers')
        .update({ is_online: false })
        .eq('id', session.user.id);

      console.log("Quiet Mode: Driver set to offline");
    } catch (err) {
      console.error("Quiet Mode Error:", err);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('user_saved_locations')
        .select('*')
        .eq('user_id', session.user.id);
      if (error) throw error;
      if (data) {
        setSavedLocations(data);
        localStorage.setItem('cached_locations', JSON.stringify(data));
      }
    } catch (err) {
      console.error("Fetch Locations Error:", err);
    }
  };


  const handleDeleteActivity = async (activity: Activity, e: React.MouseEvent) => {
    e.stopPropagation();
    showAlert(
      "Delete Activity",
      `Are you sure you want to permanently delete this ${activity.type} from your history? This will also remove any cached distance data.`,
      "info",
      async () => {
        triggerHaptic();
        try {
          // 1. Remove from UI immediately
          setRecentActivities(prev => prev.filter(a => a.id !== activity.id));

          // 2. Update localStorage to match UI
          const currentSaved = JSON.parse(localStorage.getItem('app_recent_activities') || '[]');
          const updatedSaved = currentSaved.filter((a: any) => a.id !== activity.id);
          localStorage.setItem('app_recent_activities', JSON.stringify(updatedSaved));

          // 3. Delete from Supabase user_activities table ONLY
          const { error } = await supabase
            .from('user_activities')
            .delete()
            .eq('id', activity.id);

          if (error) {
            // Revert UI and LocalStorage on error
            setRecentActivities(prev => [...prev, activity].sort((a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
            ));
            localStorage.setItem('app_recent_activities', JSON.stringify(currentSaved));
            throw error;
          }

          console.log(`✅ Activity log deleted.`);
        } catch (err) {
          console.error("Delete Activity Error:", err);
          showAlert("Error", "Something went wrong during deletion.", "error");
        }
      },
      true, // showCancel
      "Yes, Delete",
      "Cancel"
    );
  };

  const handleSaveLocation = async (locData: { address: string; lat: number; lng: number }) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (savedLocations.some(sl => sl.address === locData.address)) {
        showAlert("Duplicate Location", "This location is already saved in your places.", "info");
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.from('user_saved_locations').insert({
        user_id: session.user.id,
        label: newLocLabel,
        emoji: newLocEmoji,
        address: locData.address,
        latitude: locData.lat,
        longitude: locData.lng
      });

      if (error) throw error;

      setShowMapPicker(false);
      setShowSaveDrawer(false);
      fetchLocations();
      showAlert("Success", "Location saved successfully!", "success");
    } catch (err: any) {
      showAlert("Error", `Could not save location: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const texts = ["Where to?", "What to Order?"];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % texts.length;
      setPlaceholderText(texts[index]);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-advance card carousel every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!carouselRef.current) return;

      const container = carouselRef.current;
      const nextIndex = (activeCardIndex + 1) % 2; // Assuming 2 cards (Ride & Marketplace)

      container.scrollTo({
        left: nextIndex * container.offsetWidth,
        behavior: 'smooth'
      });
      setActiveCardIndex(nextIndex);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeCardIndex]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning,";
    if (hour < 17) return "Good afternoon,";
    return "Good evening,";
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      if (searchMode === 'market') {
        setMarketSearchQuery(searchQuery);
        navigate('marketplace');
      }
    }
  };

  const handleMapSearch = (val: string) => {
    setSearchQuery(val);
    if (searchMode !== 'maps' || !val.trim() || val.length < 3) {
      setPredictions([]);
      return;
    }

    if (!(window as any).google) return;

    // Start session if not exists
    const google = (window as any).google;
    if (!sessionToken.current && google) {
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
      console.log("Maps Dash: Started new session");
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      const google = (window as any).google;
      if (!google || !google.maps) {
        console.warn("Dashboard: Google Maps not loaded yet.");
        return;
      }
      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions({
        input: val,
        sessionToken: sessionToken.current,
        // Updated to national bias for Dashboard too
        componentRestrictions: { country: ['gm', 'sn', 'gw', 'gn'] },
        locationBias: {
          center: { lat: 13.4432, lng: -15.3101 },
          radius: 100000
        }
      }, (preds: any) => {
        setPredictions(preds || []);
      });
    }, 500);
  };

  const selectMapPrediction = (pred: any) => {
    const google = (window as any).google;
    setSearchQuery(pred.description);
    setPredictions([]);
    setPrefilledDestination(pred.description);

    // End session correctly to save cost
    sessionToken.current = null;

    triggerHaptic();
    navigate('ride');
  };

  const bgMain = theme === 'light' ? 'bg-[#F8F9FA]' : 'bg-[#000000]';
  const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
  const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
  const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
  const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';

  return (
    <div className={`h-full flex flex-col ${bgMain} ${textMain} relative overflow-hidden animate-scale-in`}>
      <div className={`pt-safe px-6 pb-6 z-10 flex flex-col gap-6 ${theme === 'light' ? 'bg-white/80' : 'bg-black/80'} backdrop-blur-md transition-all`}>
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-12 h-12 rounded-full ${user.photo ? 'bg-cover bg-center' : 'bg-[#00D68F]/20 flex items-center justify-center'} border-2 border-white dark:border-[#1C1C1E]`}
                style={user.photo ? { backgroundImage: `url(${user.photo})` } : {}}
              >
                {!user.photo && (
                  <span className="text-[#00D68F] font-bold text-lg">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <span className={`text-[11px] ${textSec} font-bold uppercase tracking-wider mb-0.5`}>{getGreeting()}</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight">{user.name || 'Alex'}</span>
                {settings.is_rating_enabled && (
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg ${user.rating >= 4.5 ? 'bg-[#00D68F]/10 text-[#00D68F]' :
                    user.rating >= 3.0 ? 'bg-orange-500/10 text-orange-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                    <span className="text-[10px] font-black">{(user.rating || 5.0).toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button onClick={toggleTheme} className={`w-10 h-10 rounded-full ${theme === 'light' ? 'bg-gray-100 shadow-inner' : 'bg-[#1C1C1E]'} flex items-center justify-center transition-all active:scale-95`}>
            {theme === 'light' ? <Sun size={20} className="text-orange-500" /> : <Moon size={20} className="text-[#00D68F]" />}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${textSec}`} size={20} />
            <input
              value={searchQuery}
              onFocus={() => {
                if (searchMode === 'maps' && !sessionToken.current) {
                  const google = (window as any).google;
                  if (google) {
                    sessionToken.current = new google.maps.places.AutocompleteSessionToken();
                  }
                }
              }}
              onChange={(e) => searchMode === 'market' ? setSearchQuery(e.target.value) : handleMapSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder={searchMode === 'market' ? "What to order?" : "Where to go?"}
              className={`w-full h-14 pl-12 pr-12 rounded-[22px] ${theme === 'light' ? 'bg-[#F2F2F7] border-none shadow-none focus:bg-white focus:shadow-[0_8px_30px_rgba(0,214,143,0.12)] focus:ring-2 focus:ring-[#00D68F]/20' : 'bg-[#1C1C1E]/80 border border-white/5 shadow-lg focus:ring-2 focus:ring-[#00D68F]/30'} font-bold outline-none text-base placeholder:opacity-50 transition-all cursor-text`}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setPredictions([]); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              triggerHaptic();
              setSearchMode(prev => prev === 'market' ? 'maps' : 'market');
              setSearchQuery('');
              setPredictions([]);
            }}
            className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${searchMode === 'market' ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'bg-[#00D68F]/10 text-[#00D68F]'} shadow-sm active:scale-98 border-2 border-transparent hover:border-current`}
          >
            {searchMode === 'market' ? <ShoppingBag size={24} /> : <MapIcon size={24} />}
          </button>
        </div>

        {/* Reward Balance Badge */}
        {user.referralBalance > 0 && (
          <div className="mx-6 mt-4">
            <div className={`p-4 rounded-3xl ${theme === 'light' ? 'bg-[#00D68F]/10' : 'bg-[#00D68F]/5'} border border-[#00D68F]/20 flex items-center justify-between animate-scale-in`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00D68F] flex items-center justify-center text-black">
                  <Gift size={20} />
                </div>
                <div>
                  <div className={`text-[10px] uppercase font-black text-[#00D68F] tracking-widest`}>Available Credit</div>
                  <div className="text-lg font-black">{settings.currency_symbol}{(user.referralBalance || 0).toFixed(2)}</div>
                </div>
              </div>
              <button
                onClick={() => navigate('earn')}
                className={`px-4 py-2 rounded-xl bg-[#00D68F] text-black text-xs font-bold active:scale-98 transition-all`}
              >
                Use Now
              </button>
            </div>
          </div>
        )}

        {searchMode === 'maps' && predictions.length > 0 && (
          <div className={`mt-2 rounded-2xl ${bgCard} shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-scale-in max-h-60 overflow-y-auto`}>
            {predictions.map(p => (
              <div
                key={p.place_id}
                onClick={() => selectMapPrediction(p)}
                className="p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 active:bg-gray-50 dark:active:bg-white/5 cursor-pointer flex items-start gap-3"
              >
                <MapPin size={18} className="text-[#00D68F] mt-1" />
                <div className="flex-1">
                  <div className="font-bold text-sm">{p.structured_formatting.main_text}</div>
                  <div className={`text-xs ${textSec} truncate`}>{p.structured_formatting.secondary_text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-5 pt-4 flex flex-col gap-8 overflow-y-auto min-h-0 pb-40" onScroll={handleScroll}>
        {/* ── Hero Cards: side-by-side on wide, swipeable carousel on narrow ── */}
        <div className="w-full">
          {/* Wide layout (≥ 480px) */}
          <div className="hidden min-[480px]:grid grid-cols-2 gap-6">
            {/* Ride Card */}
            <div onClick={() => navigate('ride')} className={`col-span-1 h-56 ${bgCard} rounded-[32px] relative overflow-hidden group active:scale-[0.96] hover:-translate-y-1 transition-all duration-400 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_50px_-15px_rgba(0,214,143,0.2)] dark:shadow-[0_40px_60px_-25px_rgba(0,0,0,1)] cursor-pointer border border-black/5 dark:border-white/10`}>
              <img src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&q=80" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Car" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
              <div className="absolute bottom-5 right-5 text-right z-10 filter drop-shadow-md">
                <div className="flex justify-end mb-2"><div className="w-10 h-10 rounded-full bg-[#00D68F] flex items-center justify-center text-black shadow-[0_8px_16px_rgba(0,214,143,0.4)] transition-transform group-hover:scale-110"><Car size={20} /></div></div>
                <h2 className="text-2xl font-black text-white tracking-tight">Ride & Delivery</h2>
                <p className="text-[10px] uppercase font-bold text-white/80 tracking-widest flex items-center justify-end gap-1"><MapPin size={10} /> {user.location || 'Locating...'}</p>
              </div>
            </div>
            {/* Marketplace Card */}
            <div onClick={() => navigate('marketplace')} className={`col-span-1 h-56 ${bgCard} rounded-[32px] relative overflow-hidden group active:scale-[0.96] hover:-translate-y-1 transition-all duration-400 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_50px_-15px_rgba(255,149,0,0.2)] dark:shadow-[0_40px_60px_-25px_rgba(0,0,0,1)] cursor-pointer border border-black/5 dark:border-white/10`}>
              <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Market" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
              <div className="absolute bottom-5 right-5 text-right z-10 filter drop-shadow-md">
                <div className="flex justify-end mb-2"><div className="w-10 h-10 rounded-full bg-[#FF9500] flex items-center justify-center text-black shadow-[0_8px_16px_rgba(255,149,0,0.4)] transition-transform group-hover:scale-110"><ShoppingBag size={20} /></div></div>
                <h2 className="text-2xl font-black text-white tracking-tight">Market</h2>
                <p className="text-[10px] uppercase font-bold text-white/80 tracking-widest">Premium Shops</p>
              </div>
            </div>
          </div>

          {/* Narrow layout (< 480px): swipeable snap carousel */}
          <div className="min-[480px]:hidden">
            <div
              ref={carouselRef}
              onScroll={() => {
                if (!carouselRef.current) return;
                const idx = Math.round(carouselRef.current.scrollLeft / carouselRef.current.offsetWidth);
                setActiveCardIndex(idx);
              }}
              className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-1 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* Ride Card */}
              <div
                onClick={() => navigate('ride')}
                className={`snap-center flex-shrink-0 w-[88vw] h-52 ${bgCard} rounded-[28px] relative overflow-hidden active:scale-[0.97] transition-all duration-300 shadow-xl cursor-pointer border border-black/5 dark:border-white/10`}
              >
                <img src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&q=80" className="absolute inset-0 w-full h-full object-cover" alt="Car" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                <div className="absolute bottom-5 right-5 text-right z-10">
                  <div className="flex justify-end mb-2"><div className="w-10 h-10 rounded-full bg-[#00D68F] flex items-center justify-center text-black shadow-[0_8px_16px_rgba(0,214,143,0.4)]"><Car size={20} /></div></div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Ride & Delivery</h2>
                  <p className="text-[10px] uppercase font-bold text-white/80 tracking-widest flex items-center justify-end gap-1"><MapPin size={10} /> {user.location || 'Locating...'}</p>
                </div>
              </div>
              {/* Marketplace Card */}
              <div
                onClick={() => navigate('marketplace')}
                className={`snap-center flex-shrink-0 w-[88vw] h-52 ${bgCard} rounded-[28px] relative overflow-hidden active:scale-[0.97] transition-all duration-300 shadow-xl cursor-pointer border border-black/5 dark:border-white/10`}
              >
                <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80" className="absolute inset-0 w-full h-full object-cover" alt="Market" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                <div className="absolute bottom-5 right-5 text-right z-10">
                  <div className="flex justify-end mb-2"><div className="w-10 h-10 rounded-full bg-[#FF9500] flex items-center justify-center text-black shadow-[0_8px_16px_rgba(255,149,0,0.4)]"><ShoppingBag size={20} /></div></div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Market</h2>
                  <p className="text-[10px] uppercase font-bold text-white/80 tracking-widest">Premium Shops</p>
                </div>
              </div>
            </div>
            {/* Dot indicators */}
            <div className="flex justify-center gap-2 mt-3">
              {[0, 1].map(i => (
                <button
                  key={i}
                  onClick={() => carouselRef.current?.scrollTo({ left: i * carouselRef.current.offsetWidth, behavior: 'smooth' })}
                  className={`rounded-full transition-all duration-300 ${activeCardIndex === i
                      ? 'w-6 h-2 bg-[#00D68F]'
                      : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 1. Saved Places Section (Top) */}
        <div className="w-full mt-4">
          <div className="flex justify-center mb-6">
            <h3 className={`text-xl font-black ${textMain} tracking-tight`}>Saved Places</h3>
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            {savedLocations.map(place => (
              <div
                key={place.id}
                onClick={() => {
                  triggerHaptic();
                  setPrefilledDestination(place.address);
                  navigate('ride');
                }}
                className={`w-[100px] h-[100px] p-2 rounded-[28px] ${bgCard} shadow-[0_8px_20px_rgba(0,0,0,0.04)] dark:shadow-none cursor-pointer border border-gray-100 dark:border-white/5 hover:border-[#00D68F] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group`}
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">{place.emoji}</div>
                <div className="text-center w-full">
                  <div className="font-bold text-[11px] truncate w-full px-1">{place.label}</div>
                </div>
              </div>
            ))}

            <div
              onClick={() => { triggerHaptic(); setShowSaveDrawer(true); }}
              className={`w-[100px] h-[100px] p-2 rounded-[28px] border-[2px] border-dashed border-gray-300/50 dark:border-gray-700/50 ${theme === 'light' ? 'bg-gray-50/50' : 'bg-white/5'} flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 hover:border-gray-400 active:scale-95 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all`}
            >
              <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1C1C1E] shadow-sm flex items-center justify-center">
                <Plus size={20} className={textSec} />
              </div>
              <div className={`text-[10px] font-bold ${textSec}`}>Add New</div>
            </div>
          </div>
        </div>

        {/* 2. Featured Favorites (Middle) - Limit 5 */}
        {favorites.length > 0 && (
          <div className="w-full mt-2">
            <div className="flex flex-col items-center mb-5 relative px-4 text-center">
              <h3 className={`text-xl font-black ${textMain} tracking-tight`}>My Favorites</h3>
              <button
                onClick={() => { setProfileDrawerToOpen('favorites'); navigate('profile'); }}
                className={`mt-2 text-xs font-bold text-[#00D68F] active:opacity-70 transition-colors flex items-center gap-1 bg-[#00D68F]/10 px-4 py-2 rounded-full hover:bg-[#00D68F]/20`}
              >
                See All <ArrowRight size={14} />
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 px-2 -mx-2 snap-x">
              {isFavoritesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`w-[260px] h-[220px] shrink-0 p-3 rounded-[32px] ${theme === 'light' ? 'bg-gray-200' : 'bg-[#2C2C2E]'} animate-pulse snap-center border border-black/5 dark:border-white/5`} />
                ))
              ) : businesses.filter(b => favorites.includes(b.id)).slice(0, 5).map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    if (b.isOpen) {
                      triggerHaptic();
                      setSelectedBusiness(b);
                      navigate('business-detail', true);
                    }
                  }}
                  className={`w-[260px] shrink-0 p-3 rounded-[32px] ${bgCard} shadow-[0_12px_30px_rgba(0,0,0,0.06)] dark:shadow-none border border-black/5 dark:border-white/5 transition-all flex flex-col gap-3 group snap-center ${b.isOpen ? 'cursor-pointer hover:border-[#00D68F]/50 hover:shadow-[0_16px_40px_rgba(0,214,143,0.1)] active:scale-95' : 'opacity-60 grayscale cursor-not-allowed'}`}
                >
                  <div className="w-full h-[140px] rounded-[24px] overflow-hidden bg-gray-100 dark:bg-gray-800 relative shadow-inner">
                    <img
                      src={b.logo || b.image}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                      alt={b.name}
                    />

                    {/* Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    {!b.isOpen && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-xs font-black text-white uppercase backdrop-blur-md px-4 text-center">
                        <div className="tracking-widest">Closed</div>
                        {b.working_hours?.start && <div className="mt-1 opacity-80 text-[10px] tracking-normal capitalize">Opens at {b.working_hours.start}</div>}
                      </div>
                    )}

                    {/* Floating Rating Badge (Optional inside image, or keep below) */}
                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/80 backdrop-blur-md px-2 py-1 rounded-xl flex items-center gap-1 shadow-sm">
                      <Star size={12} fill="currentColor" className={b.rating >= 4.5 ? 'text-[#00D68F]' : 'text-orange-400'} />
                      <span className="text-xs font-bold text-black dark:text-white">{b.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="px-2 pb-1 relative">
                    <div className="font-black text-base truncate tracking-tight">{b.name}</div>
                    <div className={`text-xs ${textSec} font-medium mt-0.5 flex flex-col gap-0.5`}>
                      <span className="truncate">{b.category}</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-[#E5E5EA] border border-black/5 text-black dark:bg-[#2C2C2E] dark:border-white/5 dark:text-[#EBEBF5] px-2 py-0.5 rounded-md mt-1 shadow-sm w-max">
                        <Phone size={10} /> {b.phone}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 w-full">
          <div className="flex flex-col items-center mb-5 relative px-4 text-center">
            <h3 className={`text-xl font-black ${textMain} tracking-tight`}>Recent Activities</h3>
            <button onClick={() => { setProfileDrawerToOpen('history'); navigate('profile'); }} className="mt-2 text-xs font-bold text-[#00D68F] flex items-center gap-1 bg-[#00D68F]/10 px-4 py-2 rounded-full hover:bg-[#00D68F]/20 transition-colors">
              View History <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-4 px-2">
            {isActivitiesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`w-full h-20 rounded-[24px] ${theme === 'light' ? 'bg-gray-200' : 'bg-[#2C2C2E]'} animate-pulse`} />
              ))
            ) : recentActivities.slice(0, 7).map(activity => (

              <div
                key={activity.id}
                onClick={() => {
                  triggerHaptic();
                  setExpandedActivity(expandedActivity === activity.id ? null : activity.id);
                }}
                className={`${bgCard} p-4 rounded-[24px] shadow-[0_8px_20px_rgba(0,0,0,0.03)] border-b border-transparent dark:border-white/5 cursor-pointer active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] transition-all duration-300 group overflow-hidden relative`}
              >
                {/* Liquid Shimmer Highlight */}
                <div className="absolute -top-10 -left-10 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent blur-xl pointer-events-none rotate-45"></div>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activity.type.startsWith('ride') || activity.type.startsWith('delivery') ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {activity.type.startsWith('ride') || activity.type.startsWith('delivery') ? <Car size={20} /> : <ShoppingBag size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm truncate">{activity.title}</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black">D{activity.price}</span>
                        <button
                          onClick={(e) => handleDeleteActivity(activity, e)}
                          className="p-2 -mr-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all text-red-500 active:scale-95"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                    <p className={`text-[10px] ${textSec}`}>{activity.subtitle} • {activity.date}</p>
                  </div>
                </div>

                {/* Expandable Reorder Section */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedActivity === activity.id ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
                >
                  <div className="overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic();
                        if (activity.type.startsWith('ride') || activity.type.startsWith('delivery')) {
                          setPrefilledDestination(activity.title);
                          const tierMap: Record<string, string> = { 'premium': 'prem', 'scooter': 'moto', 'economic': 'eco' };
                          setPrefilledTier(tierMap[activity.requested_vehicle_type || 'economic'] || 'eco');
                          setPrefilledDistance(activity.distance_km || null);
                          navigate('ride');
                        } else {
                          // For marketplace reorders, we might just navigate to market or specific store
                          navigate('marketplace');
                        }
                      }}
                      className="w-full bg-[#00D68F] text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      <span>Reorder</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!isActivitiesLoading && recentActivities.length === 0 && (
              <div className={`py-2 text-center text-[10px] ${textSec} opacity-40 font-medium`}>No recently completed activities.</div>
            )}
          </div>
        </div>
      </div>

      {/* Save Location Drawer */}
      {showSaveDrawer && (
        <div className="fixed inset-0 z-[1000] flex flex-col justify-end animate-slide-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSaveDrawer(false)}></div>
          <div className={`${bgCard} rounded-t-[32px] p-6 pb-safe relative z-10 transition-transform`}>
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6"></div>

            {saveStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Label this place</h2>
                <div className="grid grid-cols-4 gap-4">
                  {EMOJIS.map((emoji, i) => (
                    <button
                      key={i}
                      onClick={() => { triggerHaptic(); setNewLocEmoji(emoji); setNewLocLabel(LABELS[i]); }}
                      className={`h-20 rounded-[20px] flex flex-col items-center justify-center gap-1 transition-all ${newLocEmoji === emoji ? 'bg-[#00D68F] text-black scale-105' : inputBg}`}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="text-[10px] font-bold">{LABELS[i]}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-50 ml-1">Custom Label</label>
                  <input
                    value={newLocLabel}
                    onChange={(e) => setNewLocLabel(e.target.value)}
                    placeholder="E.g. Aunt's House"
                    className={`w-full h-14 px-5 rounded-[20px] ${inputBg} outline-none font-bold`}
                  />
                </div>
                <button
                  onClick={() => setSaveStep(2)}
                  className="w-full h-14 bg-[#00D68F] text-black rounded-[20px] font-bold flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight size={20} />
                </button>
              </div>
            )}

            {saveStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{newLocEmoji}</span>
                  <div>
                    <h2 className="text-2xl font-bold">{newLocLabel}</h2>
                    <p className={`text-xs ${textSec}`}>Select the address on map</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => setShowMapPicker(true)}
                    className={`w-full p-6 rounded-[24px] border-2 border-dashed ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex flex-col items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-all`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#00D68F]/10 flex items-center justify-center text-[#00D68F]">
                      <MapPin size={24} />
                    </div>
                    <span className="font-bold">Choose from Map</span>
                  </button>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setSaveStep(1)} className={`w-1/3 h-14 rounded-[20px] ${inputBg} font-bold`}>Back</button>
                  <button onClick={() => setShowSaveDrawer(false)} className={`flex-1 h-14 rounded-[20px] ${inputBg} font-bold`}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showMapPicker && (
        <LocationPicker
          onConfirm={(loc) => {
            handleSaveLocation({ address: loc.address, lat: loc.lat, lng: loc.lng });
          }}
          onClose={() => setShowMapPicker(false)}
          theme={theme}
          user={user}
        />
      )}

      {isLoading && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-[#1C1C1E] p-8 rounded-[32px] flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-[#00D68F]" size={40} />
            <p className="font-bold">Saving Location...</p>
          </div>
        </div>
      )}

      {(activeOrderId || activeBatchId) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] md:max-w-[400px] z-50">
          <button
            onClick={() => navigate('order-tracking')}
            className="w-full h-16 bg-[#00D68F] rounded-[24px] shadow-[0_8px_30px_rgb(0,214,143,0.3)] flex items-center justify-between px-6 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                <Truck className="text-black" size={20} />
              </div>
              <div className="text-left">
                <p className="text-black font-black text-sm">Active Order In Progress</p>
                <p className="text-black/60 text-[10px] uppercase font-bold">Tap to track delivery</p>
              </div>
            </div>
            <ArrowRight size={20} className="text-black" />
          </button>
        </div>
      )}

    </div>
  );
};
