-- Create a table to cache road distances between coordinates to save on Google API costs
CREATE TABLE IF NOT EXISTS public.distance_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_lat NUMERIC(8,4) NOT NULL,
    origin_lng NUMERIC(8,4) NOT NULL,
    dest_lat NUMERIC(8,4) NOT NULL,
    dest_lng NUMERIC(8,4) NOT NULL,
    distance_km NUMERIC(10,2) NOT NULL,
    duration_mins NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Index for fast lookups
    CONSTRAINT unique_route UNIQUE (origin_lat, origin_lng, dest_lat, dest_lng)
);

-- Index for searching nearby coordinates (rounding helps cache hits)
CREATE INDEX IF NOT EXISTS idx_distance_cache_lookup ON public.distance_cache (origin_lat, origin_lng, dest_lat, dest_lng);

-- RLS
ALTER TABLE public.distance_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read distance cache" ON public.distance_cache FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert distance cache" ON public.distance_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Cleanup function to remove expired entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_distance_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.distance_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
