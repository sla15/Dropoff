
import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import { Theme, Screen, CartItem, Business, Activity, UserData, Category, AppSettings } from './types';
import { INITIAL_BUSINESSES } from './data';
import { SmartAssistant } from './components/SmartAssistant';
import { Sidebar } from './components/Navigation';
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

// --- API INITIALIZATION ---
// --- API INITIALIZATION ---
import OneSignal from 'react-onesignal';

const initOneSignal = async (userId?: string) => {
  try {
    await OneSignal.init({
      appId: CONFIG.ONESIGNAL_APP_ID || "YOUR_ONESIGNAL_APP_ID",
      allowLocalhostAsSecureOrigin: true,
    });
    console.log("OneSignal Initialized");

    if (userId) {
      await OneSignal.login(userId);
      console.log("OneSignal User Logged In:", userId);
    }
  } catch (err) {
    console.error("OneSignal Init Error:", err);
  }
};

export const sendPushNotification = async (title: string, message: string) => {
  console.log(`[PUSH] ${title}: ${message}`);
  // In a real app with OneSignal REST API access, we'd call a Cloud Function here.
  // For the frontend, we can use OneSignal's local notification if available or just log it.
  try {
    // react-onesignal doesn't expose a simple 'showNotification' for local use easily,
    // but we can simulate the UI feedback or use native plugins if on mobile.
  } catch (err) {
    console.error("Push Error:", err);
  }
};

export const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10);
  }
};

export const GreenGlow = () => (
  <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#00D68F] opacity-[0.15] blur-[120px] rounded-full pointer-events-none z-0"></div>
);

// Define global callback for Google Maps
(window as any).initMap = () => {
  console.log("Google Maps API loaded successfully");
};


const App = () => {
  const [theme, setTheme] = useState<Theme>('light');

  // App State
  const [isLoading, setIsLoading] = useState(true); // Splash Screen State
  const [screen, setScreen] = useState<Screen | null>(null); // Start as null to avoid flash

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('app_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('app_cart', JSON.stringify(cart));
  }, [cart]);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [prefilledDestination, setPrefilledDestination] = useState<string | null>(null);

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<any>(null);
  const [showAssistant, setShowAssistant] = useState(false);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings>({
    min_ride_price: 350,
    min_delivery_fee: 50,
    driver_search_radius_km: 5,
    referral_reward_amount: 50,
    currency_symbol: 'D',
    commission_percentage: 10,
    rating_window_limit: 50,
    is_rating_enabled: true
  });

  const [history, setHistory] = useState<Screen[]>([]);

  const [user, setUser] = useState<UserData>({
    name: '',
    phone: '',
    email: '',
    location: 'Banjul, The Gambia',
    photo: null,
    rating: 4.8
  });

  const userRef = useRef<UserData>(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initialize Services & Check Session on Mount
  useEffect(() => {
    initOneSignal();

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase.from('app_settings').select('*').limit(1).single();
        if (error) throw error;
        if (data) setSettings(data);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    };

    fetchSettings();

    const fetchBusinesses = async () => {
      try {
        console.log("Fetching businesses from Supabase...");
        const { data, error } = await supabase
          .from('businesses')
          .select(`*, products (*)`);

        if (error) throw error;

        if (data) {
          const mappedBusinesses: Business[] = data.map((b: any) => ({
            id: b.id,
            name: b.name,
            category: b.category,
            description: b.description,
            rating: b.rating || 5.0,
            reviews: 0,
            deliveryTime: '30-45 min',
            image: b.image_url || 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=800&q=80',
            logo: b.image_url,
            phone: '',
            location: b.location_address || '',
            isOpen: b.is_open,
            distance: '2.5 km',
            products: (b.products || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              image: p.image_url || 'https://via.placeholder.com/150',
              description: p.description,
              stock: p.stock,
              mainCategory: p.category,
              categories: [p.category]
            }))
          }));
          setBusinesses(mappedBusinesses);
        }
      } catch (err) {
        console.error("Failed to fetch businesses:", err);
      }
    };

    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('business_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) throw error;
        if (data) {
          setCategories(data.map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            displayOrder: c.display_order
          })));
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };

    const fetchFavorites = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('user_favorite_businesses')
          .select('business_id')
          .eq('user_id', userId);

        if (error) throw error;
        if (data) {
          setFavorites(data.map(f => f.business_id));
        }
      } catch (err) {
        console.error("Failed to fetch favorites:", err);
      }
    };

    const fetchActivities = async (userId: string) => {
      try {
        // Fetch recent rides
        const { data: rides, error: ridesError } = await supabase
          .from('rides')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch recent orders
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        const activities: Activity[] = [];

        // Map rides to activities
        if (rides) {
          rides.forEach((r: any) => {
            activities.push({
              id: r.id,
              type: 'ride',
              title: r.destination || 'Ride',
              subtitle: r.vehicle_type || 'Standard Car',
              price: r.total_price || 0,
              date: new Date(r.created_at).toLocaleDateString(),
              status: r.status || 'completed'
            });
          });
        }

        // Map orders to activities
        if (orders) {
          orders.forEach((o: any) => {
            activities.push({
              id: o.id,
              type: 'order',
              title: o.business_name || 'Order',
              subtitle: `${o.total_items || 0} Items`,
              price: o.total_price || 0,
              date: new Date(o.created_at).toLocaleDateString(),
              status: o.status || 'completed'
            });
          });
        }

        // Sort by date (most recent first) and limit to 10
        activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecentActivity(activities.slice(0, 10));
      } catch (err) {
        console.error("Failed to fetch activities:", err);
        setRecentActivity([]); // Set empty if error
      }
    };

    const subscribeToChanges = (userId?: string) => {
      console.log("Initializing Realtime Subscriptions...");

      const channel = supabase.channel('app-db-changes');

      // Global changes
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        console.log('Realtime Settings Change:', payload);
        fetchSettings();
      });

      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'business_categories' }, (payload) => {
        console.log('Realtime Category Change:', payload);
        fetchCategories();
      });

      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => fetchBusinesses());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchBusinesses());

      // User specific changes
      if (userId) {
        channel.on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        }, (payload) => {
          console.log('Realtime Profile Change:', payload);
          const p = payload.new as any;
          setUser(prev => ({
            ...prev,
            name: p.full_name || prev.name,
            phone: p.phone || prev.phone,
            email: p.email || prev.email,
            location: p.location || prev.location,
            photo: p.avatar_url || prev.photo,
            rating: p.average_rating ? Number(p.average_rating) : prev.rating,
            referralCode: p.referral_code || prev.referralCode,
            referralBalance: p.referral_balance !== undefined ? Number(p.referral_balance) : prev.referralBalance
          }));
        });

        channel.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcasts'
        }, (payload) => {
          const broadcast = payload.new as any;
          const currentUser = userRef.current;

          console.log('Realtime Broadcast Received:', broadcast, 'Current User:', currentUser);

          // Role-based filtering
          const target = broadcast.target_audience; // 'customer', 'driver', 'all'
          const userRole = currentUser.role || 'customer';

          if (target === 'all' || target === userRole) {
            sendPushNotification(broadcast.title, broadcast.message);
          }
        });
      }

      channel.subscribe();
      return channel;
    };

    const initializeApp = async () => {
      const minSplashTime = new Promise(resolve => setTimeout(resolve, 1500));
      let currentUserId = '';

      const checkSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session && session.user) {
            currentUserId = session.user.id;
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              setUser({
                name: profile.full_name || '',
                phone: profile.phone || '',
                email: profile.email || '',
                location: profile.location || 'Banjul, The Gambia',
                photo: profile.avatar_url || null,
                rating: Number(profile.average_rating) || 5.0,
                referralCode: profile.referral_code,
                referralBalance: Number(profile.referral_balance) || 0
              });
              fetchFavorites(session.user.id);
            }
            setScreen('dashboard');
            initOneSignal(currentUserId);
          } else {
            setScreen('onboarding');
            initOneSignal();
          }
        } catch (e) {
          console.error("Session Check Error:", e);
          setScreen('onboarding');
        }
      };

      try {
        await Promise.all([minSplashTime, checkSession(), fetchBusinesses(), fetchCategories(), fetchSettings()]);
      } catch (err) {
        console.error("App Initialization Error:", err);
        // We still want to stop loading even if some secondary data fails
      } finally {
        setIsLoading(false);
      }

      if (currentUserId) {
        fetchActivities(currentUserId);
      }

      const channel = subscribeToChanges(currentUserId);
      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = initializeApp();
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, []);

  const navigate = (scr: Screen, addToHistory: boolean = false) => {
    triggerHaptic();
    if (addToHistory) {
      setHistory(prev => [...prev, screen]);
    } else {
      if (['dashboard', 'marketplace', 'earn', 'profile', 'ride'].includes(scr)) {
        setHistory([]);
      }
    }
    setScreen(scr);
  };

  const goBack = () => {
    triggerHaptic();
    if (history.length > 0) {
      const newHistory = [...history];
      const prevScreen = newHistory.pop();
      setHistory(newHistory);
      if (prevScreen) setScreen(prevScreen);
    } else {
      setScreen('dashboard');
    }
  };

  const toggleTheme = () => {
    triggerHaptic();
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Please login to save favorites!");
      return;
    }

    const isFavorited = favorites.includes(id);

    if (isFavorited) {
      // Remove from DB
      const { error } = await supabase
        .from('user_favorite_businesses')
        .delete()
        .eq('user_id', session.user.id)
        .eq('business_id', id);

      if (!error) {
        setFavorites(prev => prev.filter(f => f !== id));
      } else {
        console.error("Error unfavoriting:", error);
      }
    } else {
      if (favorites.length >= 4) {
        alert("You can only have up to 4 favorites!");
        return;
      }

      // Add to DB
      const { error } = await supabase
        .from('user_favorite_businesses')
        .insert({
          user_id: session.user.id,
          business_id: id
        });

      if (!error) {
        setFavorites(prev => [...prev, id]);
      } else {
        console.error("Error favoriting:", error);
      }
    }
  };

  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;

    // Hide nav when scrolling down, show when scrolling up
    if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
      if (isNavVisible) setIsNavVisible(false);
    } else if (currentScrollY < lastScrollY.current) {
      if (!isNavVisible) setIsNavVisible(true);
    }

    lastScrollY.current = currentScrollY;

    setIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
      // Auto show nav when scroll stops for a bit (optional but feels safe)
      setIsNavVisible(true);
    }, 400); // Increased timeout for a more stable feel
  };

  const renderScreen = () => {
    switch (screen) {
      case 'onboarding':
        return <OnboardingScreen theme={theme} navigate={navigate} setUser={setUser} />;
      case 'dashboard':
        return <DashboardScreen user={user} theme={theme} navigate={navigate} toggleTheme={toggleTheme} setShowAssistant={setShowAssistant} favorites={favorites} businesses={businesses} recentActivity={recentActivity} setRecentActivity={setRecentActivity} setSelectedBusiness={setSelectedBusiness} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} setPrefilledDestination={setPrefilledDestination} setMarketSearchQuery={setMarketSearchQuery} settings={settings} />;
      case 'marketplace':
        return <MarketplaceScreen theme={theme} navigate={navigate} businesses={businesses} categories={categories} setSelectedBusiness={setSelectedBusiness} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} toggleFavorite={toggleFavorite} favorites={favorites} searchQuery={marketSearchQuery} setSearchQuery={setMarketSearchQuery} />;
      case 'earn':
        return <EarnScreen theme={theme} navigate={navigate} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} settings={settings} />;
      case 'business-detail':
        return <BusinessDetailScreen theme={theme} navigate={navigate} goBack={goBack} selectedBusiness={selectedBusiness} cart={cart} setCart={setCart} />;
      case 'checkout':
        return <CheckoutScreen theme={theme} navigate={navigate} goBack={goBack} cart={cart} setCart={setCart} user={user} settings={settings} />;
      case 'profile':
        return <ProfileScreen theme={theme} navigate={navigate} setScreen={setScreen} user={user} setUser={setUser} recentActivity={recentActivity} favorites={favorites} businesses={businesses} isScrolling={isScrolling} isNavVisible={isNavVisible} handleScroll={handleScroll} settings={settings} />;
      case 'order-tracking':
        return <OrderTrackingScreen theme={theme} navigate={navigate} user={user} setRecentActivity={setRecentActivity} />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex h-[100dvh] w-full ${theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-black'} transition-colors overflow-hidden`}>
      {isLoading && <SplashScreen theme={theme} />}
      {!isLoading && screen !== 'onboarding' && <Sidebar active={screen} navigate={navigate} theme={theme} />}
      <div className={`flex-1 relative flex justify-center bg-gray-100 dark:bg-black/50 overflow-hidden ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>
        <div className="w-full h-full md:max-w-[480px] md:shadow-2xl md:border-x md:border-gray-200 dark:md:border-gray-800 bg-white dark:bg-black relative overflow-hidden">
          <div key={screen} className="h-full w-full animate-scale-in">
            {screen && renderScreen()}
          </div>

          {!isLoading && screen !== 'ride' && screen !== 'checkout' && (
            <FloatingCartButton
              cart={cart}
              theme={theme}
              onClick={() => navigate('checkout', true)}
            />
          )}

          {/* Persistent Ride Layer */}
          <div className={`absolute inset-0 z-[5] ${screen === 'ride' ? 'block' : 'hidden'}`}>
            <RideScreen
              theme={theme}
              navigate={navigate}
              goBack={goBack}
              setRecentActivity={setRecentActivity}
              user={user}
              prefilledDestination={prefilledDestination}
              clearPrefilled={() => setPrefilledDestination(null)}
              active={screen === 'ride'}
              handleScroll={handleScroll}
              settings={settings}
            />
          </div>
        </div>
      </div>
      {showAssistant && <SmartAssistant onClose={() => setShowAssistant(false)} theme={theme} />}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
