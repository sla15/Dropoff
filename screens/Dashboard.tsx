
import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Search, Car, MapPin, ShoppingBag, Star, Trash, Trash2, X, Plus, ArrowRight, Loader2, Map as MapIcon, Gift, Truck } from 'lucide-react';
import { Theme, Screen, UserData, Activity, Business, SavedLocation, AppSettings } from '../types';
import { triggerHaptic } from '../utils/helpers';

import { supabase } from '../supabaseClient';
import { LocationPicker } from '../components/LocationPicker';
import { NotificationPrompt } from '../components/NotificationPrompt';
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
}



export const DashboardScreen = ({ user, theme, navigate, toggleTheme, setShowAssistant, favorites, businesses, recentActivities, setRecentActivities, setSelectedBusiness, isScrolling, isNavVisible, handleScroll, setPrefilledDestination, setPrefilledTier, setPrefilledDistance, setMarketSearchQuery, settings, showAlert, activeOrderId }: Props) => {
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [placeholderText, setPlaceholderText] = useState("Where to?");
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
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
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    fetchLocations();
    implementQuietMode();
  }, []);

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
      if (data) setSavedLocations(data);
    } catch (err) {
      console.error("Fetch Locations Error:", err);
    }
  };

  useEffect(() => {
    const checkNotificationStatus = async () => {
      if (!user.id) return;

      let isGranted = false;
      let isDefault = false;

      const { Capacitor } = (window as any);
      if (Capacitor?.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const perm = await PushNotifications.checkPermissions();
        isGranted = perm.receive === 'granted';
        isDefault = perm.receive === 'prompt';
      } else {
        const permission = (Notification as any)?.permission;
        isGranted = permission === 'granted';
        isDefault = permission === 'default';
      }

      const hasPromptedThisSession = sessionStorage.getItem('notif_prompt_seen');

      if (isDefault && !hasPromptedThisSession) {
        console.log('🔔 Dashboard: User needs a notification prompt (permission is prompt/default)');
        setTimeout(() => setShowNotificationPrompt(true), 3000);
      } else if (isGranted) {
        // If already granted but maybe no ID in DB, try to sync
        const { data: profile } = await supabase
          .from('profiles')
          .select('fcm_token')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.fcm_token) {
          console.log('🔔 Dashboard: Permission granted but no FCM token in DB, syncing...');
          await initFCM(user.id);
        }
      }
    };

    if (user.id) {
      checkNotificationStatus();
    }
  }, [user.id, user.role]);

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

          // 2. Determine target ID (use reference_id if available, fallback to activity.id)
          const targetId = activity.reference_id || activity.id;
          const table = activity.type === 'ride' ? 'rides' : 'orders';

          // 3. If it's a ride, attempt to delete from distance_cache first
          if (activity.type === 'ride') {
            const { data: ride } = await supabase
              .from('rides')
              .select('pickup_lat, pickup_lng, dropoff_lat, dropoff_lng')
              .eq('id', targetId)
              .maybeSingle();

            if (ride) {
              // Delete both direct and reverse cache entries
              await supabase
                .from('distance_cache')
                .delete()
                .or(`and(origin_lat.eq.${ride.pickup_lat},origin_lng.eq.${ride.pickup_lng},dest_lat.eq.${ride.dropoff_lat},dest_lng.eq.${ride.dropoff_lng}),and(origin_lat.eq.${ride.dropoff_lat},origin_lng.eq.${ride.dropoff_lng},dest_lat.eq.${ride.pickup_lat},dest_lng.eq.${ride.pickup_lng})`);
            }
          }

          // 4. Delete from source table (rides/orders)
          await supabase
            .from(table)
            .delete()
            .eq('id', targetId);

          // 5. Delete the activity record itself
          await supabase
            .from('user_activities')
            .delete()
            .eq('id', activity.id);

          console.log(`✅ ${activity.type} and associated data deleted.`);
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
      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions({
        input: val,
        sessionToken: sessionToken.current,
        componentRestrictions: { country: 'gm' }
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
              <span className={`text-xs ${textSec} font-medium`}>{getGreeting()}</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{user.name || 'Alex'}</span>
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
        <div className="flex items-center gap-3">
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
              className={`w-full h-14 pl-12 pr-12 rounded-[22px] ${theme === 'light' ? 'bg-white border-none shadow-[0_8px_30px_rgba(0,0,0,0.04)] focus:shadow-[0_8px_30px_rgba(0,214,143,0.1)]' : 'bg-[#1C1C1E]/50 border border-white/5 shadow-sm'} backdrop-blur-md font-medium outline-none text-base placeholder:opacity-50 transition-all cursor-text`}
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

      <div className="flex-1 px-5 pt-2 flex flex-col gap-8 overflow-y-auto min-h-0 pb-40" onScroll={handleScroll}>
        <div className="grid grid-cols-2 gap-6">
          <div onClick={() => navigate('ride')} className={`col-span-1 h-56 ${bgCard} rounded-[32px] relative overflow-hidden group active:scale-[0.98] transition-all duration-300 shadow-[0_30px_40px_-20px_rgba(0,0,0,0.06)] dark:shadow-[0_40px_60px_-25px_rgba(0,0,0,1)] cursor-pointer border border-black/5 dark:border-white/10`}>
            <img src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&q=80" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Car" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-5 right-5 text-right z-10">
              <div className="flex justify-end mb-2"><div className="w-10 h-10 rounded-full bg-[#00D68F] flex items-center justify-center text-white shadow-xl"><Car size={20} /></div></div>
              <h2 className="text-xl font-black text-white tracking-tight">Ride</h2>
              <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest flex items-center justify-end gap-1"><MapPin size={10} /> {user.location || 'Locating...'}</p>
            </div>
          </div>

          <div onClick={() => navigate('marketplace')} className={`col-span-1 h-56 ${bgCard} rounded-[32px] relative overflow-hidden group active:scale-[0.98] transition-all duration-300 shadow-[0_30px_40px_-20px_rgba(0,0,0,0.06)] dark:shadow-[0_40px_60px_-25px_rgba(0,0,0,1)] cursor-pointer border border-black/5 dark:border-white/10`}>
            <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Market" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-5 right-5 text-right z-10">
              <div className="flex justify-end mb-2"><div className="w-10 h-10 rounded-full bg-[#FF9500] flex items-center justify-center text-white shadow-xl"><ShoppingBag size={20} /></div></div>
              <h2 className="text-xl font-black text-white tracking-tight">Market</h2>
              <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">Premium Shops</p>
            </div>
          </div>
        </div>

        {/* 1. Saved Places Section (Top) */}
        <div className="w-full">
          <div className="flex justify-center mb-5">
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
                className={`w-[100px] h-[100px] p-2 rounded-[28px] ${bgCard} shadow-[0_8px_20px_rgba(0,0,0,0.06)] dark:shadow-none cursor-pointer border border-gray-100 dark:border-white/5 hover:border-[#00D68F] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group`}
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">{place.emoji}</div>
                <div className="text-center w-full">
                  <div className="font-bold text-[11px] truncate w-full px-1">{place.label}</div>
                </div>
              </div>
            ))}

            <div
              onClick={() => { triggerHaptic(); setShowSaveDrawer(true); }}
              className={`w-[100px] h-[100px] p-2 rounded-[28px] border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Plus size={20} className={textSec} />
              </div>
              <div className={`text-[10px] font-bold ${textSec}`}>Add New</div>
            </div>
          </div>
        </div>

        {/* 2. Featured Favorites (Middle) - Limit 5 */}
        {favorites.length > 0 && (
          <div className="w-full">
            <div className="flex justify-center mb-5">
              <h3 className={`text-xl font-black ${textMain} tracking-tight`}>My Favorites</h3>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
              {businesses.filter(b => favorites.includes(b.id)).slice(0, 5).map(b => (
                <div
                  key={b.id}
                  onClick={() => { triggerHaptic(); setSelectedBusiness(b); navigate('business-detail', true); }}
                  className={`min-w-[170px] p-4 rounded-[28px] ${bgCard} shadow-sm cursor-pointer border border-gray-100 dark:border-white/5 hover:border-[#00D68F] active:scale-98 transition-all flex flex-col gap-3 group`}
                >
                  <div className="w-full h-28 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                    <img src={b.logo || b.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={b.name} />
                  </div>
                  <div className="px-1 text-center">
                    <div className="font-bold text-sm truncate">{b.name}</div>
                    <div className={`text-[10px] ${textSec} flex items-center justify-center gap-1 mt-1`}>
                      <Star size={10} fill="currentColor" className={b.rating >= 4.5 ? 'text-[#00D68F]' : 'text-orange-400'} /> {b.rating} • {b.category}
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
            <button onClick={() => navigate('profile')} className="mt-2 text-xs font-bold text-[#00D68F] flex items-center gap-1 bg-[#00D68F]/10 px-4 py-2 rounded-full hover:bg-[#00D68F]/20 transition-colors">
              View History <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-4 px-2">
            {recentActivities.slice(0, 7).map(activity => (

              <div
                key={activity.id}
                onClick={() => {
                  triggerHaptic();
                  setExpandedActivity(expandedActivity === activity.id ? null : activity.id);
                }}
                className={`${bgCard} p-4 rounded-[20px] shadow-sm cursor-pointer active:scale-[0.99] transition-all duration-300 group overflow-hidden relative`}
              >
                {/* Liquid Shimmer Highlight */}
                <div className="absolute -top-10 -left-10 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent blur-xl pointer-events-none rotate-45"></div>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activity.type === 'ride' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {activity.type === 'ride' ? <Car size={20} /> : <ShoppingBag size={20} />}
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
                        if (activity.type === 'ride') {
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
            {recentActivities.length === 0 && (
              <div className={`py-2 text-center text-[10px] ${textSec} opacity-40 font-medium`}>No recently completed activities.</div>
            )}
          </div>
        </div>
      </div>

      {/* Save Location Drawer */}
      {showSaveDrawer && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end animate-slide-in">
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

      {activeOrderId && (
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

      <NotificationPrompt
        isOpen={showNotificationPrompt}
        onClose={() => {
          setShowNotificationPrompt(false);
          sessionStorage.setItem('notif_prompt_seen', 'true');
        }}
        theme={theme}
      />
    </div>
  );
};
