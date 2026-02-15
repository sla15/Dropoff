
export type Theme = 'light' | 'dark';
export type Screen = 'onboarding' | 'dashboard' | 'ride' | 'marketplace' | 'earn' | 'profile' | 'checkout' | 'business-detail' | 'store' | 'order-tracking';
export type RideStatus = 'idle' | 'payment-select' | 'searching' | 'accepted' | 'arrived' | 'in-progress' | 'completed' | 'review' | 'cancelled' | 'cancelled_by_driver';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  displayOrder: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  stock: number;
  mainCategory: string;
  categories: string[];
}

export interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  reviews: number;
  deliveryTime: string;
  image: string;
  logo: string;
  products: Product[];
  phone: string;
  waveNumber?: string;
  owner_id?: string;
  location: string;
  isOpen: boolean;
  distance: string;
}

export interface CartItem extends Product {
  businessId: string;
  businessName: string;
  quantity: number;
  originalProductId: string; // Preserves the actual UUID for database inserts
}

export interface Activity {
  id: string;
  type: 'ride' | 'order';
  ride_type?: 'ride' | 'delivery';
  title: string;
  subtitle: string;
  price: number;
  date: string;
  created_at?: string;
  status: 'completed' | 'cancelled';
  rating?: number;
  requested_vehicle_type?: string;
  distance_km?: number;
  reference_id?: string;
}

export interface SavedLocation {
  id: string;
  label: string; // 'Home' | 'Work' | 'Gym'
  emoji: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface UserData {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string | null;
  photo: string | null;
  rating: number;
  role?: 'customer' | 'driver' | 'merchant' | 'both';
  referralCode?: string;
  referralBalance?: number;
  last_lat?: number;
  last_lng?: number;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  type: string;
  discountAmount: number;
  isPercentage: boolean;
  expiryDate: string;
  isUsed: boolean;
}

export interface AppSettings {
  id?: string;
  min_ride_price: number;
  min_delivery_fee: number;
  driver_search_radius_km: number;
  referral_reward_amount: number;
  currency_symbol: string;
  commission_percentage: number;
  rating_window_limit: number;
  is_rating_enabled: boolean;
  max_driver_cash_amount: number;
  multiplier_scooter: number;
  multiplier_economy: number;
  multiplier_premium: number;
  price_per_km: number;
  waiting_fee_per_min: number;
}
