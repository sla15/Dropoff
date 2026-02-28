
import React, { useState, useEffect, useRef } from 'react';
declare global { interface Window { google: any; } }
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import './index.css';
import { createRoot } from 'react-dom/client';
import { Theme, Screen, CartItem, Business, Activity, UserData, Category, AppSettings } from './types';
import { INITIAL_BUSINESSES } from './data';
import { SmartAssistant } from './components/SmartAssistant';
import { BottomNav } from './components/Navigation';
import { SplashScreen } from './components/SplashScreen'; // Import Splash
import { FloatingCartButton } from './components/FloatingCartButton';
import { CONFIG } from './config';
import { supabase } from './supabaseClient';

// Screens
import { OnboardingScreen } from './screens/Onboarding';
import { DashboardScreen } from './screens/Dashboard';
import { RideScreen } from './screens/Ride';
import { MarketplaceScreen } from './screens/Marketplace';
import { EarnScreen } from './screens/Earn';
import { BusinessDetailScreen } from './screens/BusinessDetail';
import { CheckoutScreen } from './screens/Checkout';
import { ProfileScreen } from './screens/Profile';
import { OrderTrackingScreen } from './screens/OrderTracking';
import { PremiumModal } from './components/PremiumModal';
import { triggerHaptic, sendPushNotification } from './utils/helpers';

// --- API INITIALIZATION ---
import { initFCM } from './utils/fcm';
// --- END API INITIALIZATION ---

// Google Maps initialization is handled in index.html to ensure the callback is available before the script loads.
const App = () => {
  const isNative = Capacitor.isNativePlatform();

  // 🌓 Theme Management (Apple-style)
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('ride_theme') || localStorage.getItem('app_theme');
    if (saved) return saved as Theme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('ride_theme', t);
    localStorage.setItem('app_theme', t);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('ride_theme') && !localStorage.getItem('app_theme')) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'bg-black' : 'bg-[#F2F2F7]';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (isNative) {
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
        StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#000000' : '#F2F2F7' });
      }).catch(console.error);
    }
  }, [theme, isNative]);

  const [isLoading, setIsLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('splash');
  const [history, setHistory] = useState<Screen[]>([]);
  const [showAssistant, setShowAssistant] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isRideSearching, setIsRideSearching] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [prefilledDestination, setPrefilledDestination] = useState<string | null>(null);
  const [prefilledTier, setPrefilledTier] = useState<string | null>(null);
  const [prefilledDistance, setPrefilledDistance] = useState<number | null>(null);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info',
    showCancel?: boolean,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // 👤 User State (At the top to prevent ReferenceErrors)
  const [user, setUser] = useState<UserData>({
    id: '',
    name: '',
    phone: '',
    email: '',
    location: 'Banjul, The Gambia',
    photo: '',
    role: 'customer',
    rating: 5.0,
    referralCode: '',
    referralBalance: 0
  });
  const userRef = useRef<UserData>(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // FCM Initialization Logic
  const hasTriggeredFCM = useRef(false);

  useEffect(() => {
    if (!user.id) return;

    const startFCM = async () => {
      if (hasTriggeredFCM.current) return;
      console.log("🚀 Proactive FCM Trigger for user:", user.id);
      await initFCM(user.id);
      hasTriggeredFCM.current = true;
    };

    // Native can init immediately on login
    if (isNative) {
      startFCM();
      return;
    }

    // Web needs interaction for permission, but let's try once if already granted
    if (Notification.permission === 'granted') {
      startFCM();
    }

    const handleInteraction = () => {
      startFCM();
    };

    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [user.id, isNative]);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    return localStorage.getItem('active_order_id');
  });

  const [activeBatchId, setActiveBatchId] = useState<string | null>(() => {
    return localStorage.getItem('active_batch_id');
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('app_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse cart from localStorage", e);
      localStorage.removeItem('app_cart');
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>({
    min_ride_price: 150,
    min_delivery_fee: 50,
    driver_search_radius_km: 10,
    referral_reward_amount: 50,
    currency_symbol: 'D',
    commission_percentage: 15,
    rating_window_limit: 100,
    is_rating_enabled: true,
    max_driver_cash_amount: 3000,
    multiplier_scooter: 0.7,
    multiplier_economy: 1.0,
    multiplier_premium: 1.5,
    price_per_km: 40,
    waiting_fee_per_min: 0.5
  });

  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES);
  const [categories, setCategories] = useState<Category[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    onConfirm?: () => void,
    showCancel?: boolean,
    confirmText?: string,
    cancelText?: string,
    onCancel?: () => void
  ) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
      onConfirm,
      showCancel,
      confirmText,
      cancelText,
      onCancel
    });
  };

  const scrollTimeout = useRef<any>(null);
  const lastScrollY = useRef(0);

  // --- Real-time Geolocation ---
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    let watchId: string | null = null;

    const startWatching = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const permissions = await Geolocation.checkPermissions();
          if (permissions.location === 'prompt' || permissions.location === 'prompt-with-rationale') {
            await Geolocation.requestPermissions();
          }
        }

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
          (pos) => {
            if (!pos) return;
            const { latitude, longitude } = pos.coords;
            console.log("📍 Location updated:", latitude, longitude);
            setUserLocation({ lat: latitude, lng: longitude });

            setUser(prev => ({
              ...prev,
              last_lat: latitude,
              last_lng: longitude
            }));

            if (window.google?.maps?.Geocoder) {
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                if (status === 'OK' && results?.[0]) {
                  setUser(prev => ({ ...prev, location: results[0].formatted_address }));
                }
              });
            }
          }
        );
      } catch (err) {
        console.error("Geolocation error:", err);
      }
    };

    startWatching();

    return () => {
      if (watchId) Geolocation.clearWatch({ id: watchId });
    };
  }, []);

  // Sync with DB if session exists
  useEffect(() => {
    if (user.id && userLocation) {
      const updateDB = async () => {
        await supabase
          .from('profiles')
          .update({
            last_lat: userLocation.lat,
            last_lng: userLocation.lng
          })
          .eq('id', user.id);
      };
      updateDB();
    }
  }, [user.id, userLocation]);

  // --- Effects ---

  useEffect(() => {
    if (activeOrderId) {
      localStorage.setItem('active_order_id', activeOrderId);
    } else {
      localStorage.removeItem('active_order_id');
    }
  }, [activeOrderId]);

  useEffect(() => {
    if (activeBatchId) {
      localStorage.setItem('active_batch_id', activeBatchId);
    } else {
      localStorage.removeItem('active_batch_id');
    }
  }, [activeBatchId]);

  // Sync active orders on mount
  useEffect(() => {
    if (user.id && !activeOrderId && !activeBatchId) {
      const fetchActiveOrder = async () => {
        try {
          // Check for active batch first
          const { data: batchData } = await supabase
            .from('orders')
            .select('batch_id')
            .eq('customer_id', user.id)
            .not('batch_id', 'is', null)
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'delivering'])
            .limit(1)
            .maybeSingle();

          if (batchData?.batch_id) {
            setActiveBatchId(batchData.batch_id);
            return;
          }

          const { data, error } = await supabase
            .from('orders')
            .select('id')
            .eq('customer_id', user.id)
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'delivering'])
            .limit(1)
            .maybeSingle();

          if (data && !error) {
            setActiveOrderId(data.id);
          }
        } catch (err) {
          console.error("Error fetching active order:", err);
        }
      };
      fetchActiveOrder();
    }
  }, [user.id]);



  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    triggerHaptic();
  };

  // --- 4. DATA FETCHING & INITIALIZATION ---
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (data && !error) setSettings(data);
    } catch (err) { console.error("Settings Fetch Error:", err); }
  };

  const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabase.from('businesses').select(`*`);
      if (data && !error) {
        setBusinesses(data.map((b: any) => ({
          id: b.id,
          name: b.name,
          category: b.category,
          description: b.description,
          rating: b.rating || 5.0,
          reviews: 0,
          deliveryTime: '30-45 min',
          image: b.image_url || 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=800&q=80',
          logo: b.image_url || null,
          phone: '',
          location: b.location_address || '',
          isOpen: b.is_open,
          distance: '2.5 km',
          products: []
        })));
      }
    } catch (err) { console.error(err); }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('business_categories').select('*').eq('is_active', true).order('display_order', { ascending: true });
      if (data && !error) setCategories(data);
    } catch (err) { console.error(err); }
  };

  const fetchFavorites = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('user_favorite_businesses').select('business_id').eq('user_id', userId);
      if (data && !error) setFavorites(data.map(f => f.business_id));
    } catch (err) { console.error(err); }
  };

  const fetchActivities = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        setRecentActivities(data.map((a: any) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          subtitle: a.subtitle,
          price: Number(a.price) || 0,
          date: new Date(a.created_at).toLocaleDateString(),
          created_at: a.created_at,
          status: a.status as 'completed' | 'cancelled',
          reference_id: a.reference_id
        })));
      }
    } catch (err) { console.error("Activities Fetch Error:", err); }
  };

  // --- 4. INITIALIZATION ---
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      const minTime = new Promise(resolve => setTimeout(resolve, 3500));

      const sessionCheck = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
          if (profile) {
            setUser({
              id: profile.id,
              name: profile.full_name || '',
              phone: profile.phone || '',
              email: profile.email || '',
              location: profile.location || 'Banjul, The Gambia',
              photo: profile.avatar_url || null,
              role: profile.role || 'customer',
              rating: Number(profile.average_rating) || 5.0,
              referralCode: profile.referral_code || '',
              referralBalance: profile.referral_balance || 0,
              last_lat: profile.last_lat,
              last_lng: profile.last_lng
            });
            fetchFavorites(session.user.id);
            fetchActivities(session.user.id);
            subscribeToChanges(session.user.id);
            initFCM(session.user.id);

            // Enforce full_name for onboarding
            if (!profile.full_name) {
              setScreen('onboarding');
            } else {
              setScreen('dashboard');
            }
          } else {
            setScreen('onboarding');
          }
        } else {
          setScreen('onboarding');
          initFCM();
        }
      };

      await Promise.all([minTime, sessionCheck(), fetchSettings(), fetchBusinesses(), fetchCategories()]);
      setIsLoading(false);
    };

    const subscribeToChanges = (userId?: string) => {
      const channel = supabase.channel('app-changes');
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => fetchSettings());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'business_categories' }, () => fetchCategories());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => fetchBusinesses());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchBusinesses());

      if (userId) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'user_activities', filter: `user_id=eq.${userId}` }, () => fetchActivities(userId));

        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => {
          const p = payload.new as any;
          setUser(prev => ({
            ...prev,
            name: p.full_name || prev.name,
            phone: p.phone || prev.phone,
            email: p.email || prev.email,
            location: p.location || prev.location,
            avatar: p.avatar_url || prev.avatar,
            role: p.role || prev.role,
            rating: p.average_rating !== undefined ? Number(p.average_rating) : prev.rating,
            referralCode: p.referral_code || prev.referralCode,
            referralBalance: p.referral_balance !== undefined ? Number(p.referral_balance) : prev.referralBalance
          }));
        });
      }
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime connected');
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.log('⚠️ Realtime connection lost. Reconnecting in 5s...');
          setTimeout(() => {
            if (userId) subscribeToChanges(userId);
          }, 5000);
        }
      });
      return channel;
    };

    initializeApp();
  }, []);


  const navigate = (scr: Screen, addToHistory = false) => {
    // Block navigation if searching for a ride
    // Exception: Allow navigation TO 'ride' or if we are already on the target screen (to avoid alert spam)
    if (isRideSearching && scr !== 'ride' && scr !== screen) {
      showAlert(
        "Request in Progress",
        "Please cancel your search before navigating to another screen.",
        "info"
      );
      return;
    }

    triggerHaptic();
    setIsNavVisible(true); // Always show nav on navigation
    if (addToHistory) {
      setHistory(prev => [...prev, screen]);
    } else if (['dashboard', 'marketplace', 'earn', 'profile', 'ride'].includes(scr)) {
      setHistory([]);
    }
    setScreen(scr);
  };

  const goBack = () => {
    triggerHaptic();
    if (history.length > 0) {
      const newHistory = [...history];
      const prev = newHistory.pop();
      setHistory(newHistory);
      if (prev) setScreen(prev);
    } else {
      setScreen('dashboard');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    const delta = currentScrollY - lastScrollY.current;

    // Hysteresis: only update if scrolled more than 10px
    if (Math.abs(delta) > 10) {
      if (delta > 0 && currentScrollY > 50) {
        if (isNavVisible) setIsNavVisible(false);
      } else if (delta < 0) {
        if (!isNavVisible) setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
    }

    setIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => setIsScrolling(false), 400);
  };

  const toggleFavorite = async (bizId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert("Please login to save favorites!"); return; }

    if (favorites.includes(bizId)) {
      const { error } = await supabase.from('user_favorite_businesses').delete().eq('user_id', session.user.id).eq('business_id', bizId);
      if (!error) setFavorites(prev => prev.filter(f => f !== bizId));
    } else {
      if (favorites.length >= 6) { alert("Limit reached!"); return; }
      const { error } = await supabase.from('user_favorite_businesses').insert({ user_id: session.user.id, business_id: bizId });
      if (!error) setFavorites(prev => [...prev, bizId]);
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 'onboarding': return <OnboardingScreen theme={theme} navigate={navigate} setUser={setUser} showAlert={showAlert} />;
      case 'dashboard': return <DashboardScreen user={user} theme={theme} navigate={navigate} toggleTheme={toggleTheme} setShowAssistant={setShowAssistant} favorites={favorites} businesses={businesses} recentActivities={recentActivities} setRecentActivities={setRecentActivities} setSelectedBusiness={setSelectedBusiness} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} setPrefilledDestination={setPrefilledDestination} setPrefilledTier={setPrefilledTier} setPrefilledDistance={setPrefilledDistance} setMarketSearchQuery={setMarketSearchQuery} settings={settings} showAlert={showAlert} activeOrderId={activeOrderId} />;
      case 'marketplace': return <MarketplaceScreen theme={theme} navigate={navigate} businesses={businesses} categories={categories} setSelectedBusiness={setSelectedBusiness} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} toggleFavorite={toggleFavorite} favorites={favorites} searchQuery={marketSearchQuery} setSearchQuery={setMarketSearchQuery} showAlert={showAlert} user={user} />;
      case 'earn': return <EarnScreen theme={theme} navigate={navigate} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} settings={settings} showAlert={showAlert} />;
      case 'business-detail': return <BusinessDetailScreen theme={theme} navigate={navigate} goBack={goBack} selectedBusiness={selectedBusiness} cart={cart} setCart={setCart} showAlert={showAlert} />;
      case 'checkout': return <CheckoutScreen theme={theme} navigate={navigate} goBack={goBack} cart={cart} setCart={setCart} user={user} settings={settings} showAlert={showAlert} setActiveOrderId={setActiveOrderId} setActiveBatchId={setActiveBatchId} />;
      case 'profile': return <ProfileScreen theme={theme} navigate={navigate} setScreen={setScreen} user={user} setUser={setUser} recentActivities={recentActivities} setRecentActivities={setRecentActivities} favorites={favorites} businesses={businesses} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} settings={settings} showAlert={showAlert} />;
      case 'order-tracking': return <OrderTrackingScreen theme={theme} navigate={navigate} user={user} setRecentActivities={setRecentActivities} showAlert={showAlert} activeOrderId={activeOrderId} setActiveOrderId={setActiveOrderId} activeBatchId={activeBatchId} setActiveBatchId={setActiveBatchId} />;
      default: return null;
    }
  };

  return (
    <div className={`flex h-[100dvh] w-full ${theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-black'} transition-colors overflow-hidden`}>
      {isLoading && <SplashScreen theme={theme} />}
      <div className={`flex-1 relative flex justify-center bg-gray-100 dark:bg-black/50 overflow-hidden ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>
        <div className={`w-full h-full ${theme === 'light' ? 'bg-white/95' : 'bg-black/95'} relative overflow-hidden`}>
          <div key={screen} className="h-full w-full animate-scale-in">
            {screen && renderScreen()}
          </div>

          {!isLoading && screen !== 'onboarding' && screen !== 'ride' && screen !== 'checkout' && screen !== 'business-detail' && (
            <BottomNav active={screen} navigate={navigate} theme={theme} isScrolling={isScrolling} isNavVisible={isNavVisible} />
          )}

          {!isLoading && screen !== 'onboarding' && screen !== 'ride' && screen !== 'checkout' && (
            <FloatingCartButton cart={cart} theme={theme} onClick={() => navigate('checkout', true)} />
          )}

          {/* Persistent Ride Layer */}
          <div className={`absolute inset-0 transition-opacity duration-300 ${screen === 'ride' ? 'opacity-100 z-[5] pointer-events-auto' : 'opacity-0 -z-10 pointer-events-none'}`}>
            <RideScreen
              theme={theme}
              navigate={navigate}
              goBack={goBack}
              setRecentActivities={setRecentActivities}
              user={user}
              prefilledDestination={prefilledDestination}
              prefilledTier={prefilledTier}
              prefilledDistance={prefilledDistance}
              clearPrefilled={() => { setPrefilledDestination(null); setPrefilledTier(null); setPrefilledDistance(null); }}
              active={screen === 'ride'}
              handleScroll={handleScroll}
              settings={settings}
              showAlert={showAlert}
              onSearchingChange={setIsRideSearching}
              indexLocation={userLocation}
            />
          </div>
        </div>
      </div>
      {showAssistant && <SmartAssistant onClose={() => setShowAssistant(false)} theme={theme} />}
      <PremiumModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        theme={theme}
        showCancel={modalConfig.showCancel}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
