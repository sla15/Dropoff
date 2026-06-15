-- 1. Fix user_activities table
ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS reference_id UUID;

-- 2. Update log_user_activity to store reference_id and pickup details
CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_type text;
  v_title text;
  v_subtitle text;
  v_price numeric;
  v_status text;
  v_ref_id uuid;
  v_distance numeric;
  v_pickup_address text;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_dropoff_lat numeric;
  v_dropoff_lng numeric;
  v_requested_vehicle_type text;
BEGIN
  v_ref_id := NEW.id;
  v_status := LOWER(NEW.status::text);
  
  IF TG_TABLE_NAME = 'rides' THEN
    v_user_id := NEW.customer_id;
    v_price := NEW.price;
    v_distance := NEW.distance_km;
    v_pickup_address := NEW.pickup_address;
    v_pickup_lat := NEW.pickup_lat;
    v_pickup_lng := NEW.pickup_lng;
    v_dropoff_lat := NEW.dropoff_lat;
    v_dropoff_lng := NEW.dropoff_lng;
    v_requested_vehicle_type := NEW.requested_vehicle_type::text;
    
    IF NEW.ride_type = 'delivery' THEN
      v_type := 'delivery';
    ELSE
      v_type := 'ride';
    END IF;

    v_type := v_type || '_' || v_status;
    
    v_title := COALESCE(NEW.dropoff_address, 'Ride to Unknown');
    v_subtitle := INITCAP(v_status) || ' • ' || TO_CHAR(NEW.created_at, 'DD Mon, HH24:MI');
    
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_user_id := NEW.customer_id;
    v_price := NEW.total_amount;
    v_type := 'order_' || v_status;
    v_title := 'Order from ' || COALESCE((SELECT name FROM businesses WHERE id = NEW.business_id), 'Market');
    v_subtitle := INITCAP(v_status) || ' • ' || TO_CHAR(NEW.created_at, 'DD Mon, HH24:MI');
  END IF;

  IF v_status IN ('completed', 'cancelled') THEN
    INSERT INTO public.user_activities (
      user_id, type, title, subtitle, price, status, reference_id, distance_km,
      pickup_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, requested_vehicle_type
    ) VALUES (
      v_user_id, v_type, COALESCE(v_title, 'Activity'), COALESCE(v_subtitle, 'Updated'), 
      COALESCE(v_price, 0), v_status, v_ref_id, v_distance,
      v_pickup_address, v_pickup_lat, v_pickup_lng, v_dropoff_lat, v_dropoff_lng, v_requested_vehicle_type
    )
    ON CONFLICT (reference_id) DO UPDATE SET
      type = EXCLUDED.type,
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      price = EXCLUDED.price,
      status = EXCLUDED.status,
      distance_km = EXCLUDED.distance_km,
      pickup_address = EXCLUDED.pickup_address,
      pickup_lat = EXCLUDED.pickup_lat,
      pickup_lng = EXCLUDED.pickup_lng,
      dropoff_lat = EXCLUDED.dropoff_lat,
      dropoff_lng = EXCLUDED.dropoff_lng,
      requested_vehicle_type = EXCLUDED.requested_vehicle_type,
      created_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Customer notification for Ride Updates
CREATE OR REPLACE FUNCTION public.notify_customer_on_ride_update()
RETURNS trigger AS $$
DECLARE
    customer_player_id TEXT;
    notif_title TEXT;
    notif_msg TEXT;
BEGIN
    -- Only notify on status change
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT onesignal_player_id INTO customer_player_id
        FROM public.profiles
        WHERE id = NEW.customer_id;

        IF (customer_player_id IS NOT NULL) THEN
            CASE NEW.status
                WHEN 'accepted' THEN
                    notif_title := 'Driver is coming! 🚗';
                    notif_msg := 'Your ride request has been accepted.';
                WHEN 'arrived' THEN
                    notif_title := 'Driver has arrived! 📍';
                    notif_msg := 'Your driver is at the pickup location.';
                WHEN 'in-progress' THEN
                    notif_title := 'Trip started 🚀';
                    notif_msg := 'We are on our way to ' || NEW.dropoff_address;
                WHEN 'completed' THEN
                    notif_title := 'Destination reached! ✅';
                    notif_msg := 'You have arrived at your destination. Hope you enjoyed the ride!';
                WHEN 'cancelled' THEN
                    IF (OLD.status = 'searching') THEN
                        -- Ignored, customer cancelled themselves before accept
                        RETURN NEW;
                    ELSE
                        notif_title := 'Ride Cancelled ❌';
                        notif_msg := 'The driver has cancelled the ride.';
                    END IF;
                ELSE
                    RETURN NEW;
            END CASE;

            PERFORM net.http_post(
                url := 'https://uuiqtfzgdisuuqtefrgb.supabase.co/functions/v1/send-onesignal-notification',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                    'player_ids', jsonb_build_array(customer_player_id),
                    'title', notif_title,
                    'message', notif_msg,
                    'target', 'customer',
                    'data', jsonb_build_object('ride_id', NEW.id::text, 'type', 'RIDE_UPDATE', 'status', NEW.status::text)
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_notify_customer_on_ride_update ON public.rides;
CREATE TRIGGER tr_notify_customer_on_ride_update
    AFTER UPDATE ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION notify_customer_on_ride_update();

-- 4. Customer notification for Order Updates
CREATE OR REPLACE FUNCTION public.notify_customer_on_order_update()
RETURNS trigger AS $$
DECLARE
    customer_player_id TEXT;
    notif_title TEXT;
    notif_msg TEXT;
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT onesignal_player_id INTO customer_player_id
        FROM public.profiles
        WHERE id = NEW.customer_id;

        IF (customer_player_id IS NOT NULL) THEN
            CASE NEW.status
                WHEN 'accepted' THEN
                    notif_title := 'Order Accepted! 📦';
                    notif_msg := 'The merchant has accepted your order.';
                WHEN 'preparing' THEN
                    notif_title := 'In the Kitchen! 🍳';
                    notif_msg := 'Your order is being prepared.';
                WHEN 'ready' THEN
                    notif_title := 'Order Ready! ✨';
                    notif_msg := 'Your order is ready and waiting for a driver.';
                WHEN 'delivering' THEN
                    notif_title := 'Out for Delivery! 🚚';
                    notif_msg := 'A driver is on the way with your order.';
                WHEN 'completed' THEN
                    notif_title := 'Enjoy your meal! 🍴';
                    notif_msg := 'Your order has been delivered.';
                WHEN 'cancelled' THEN
                    notif_title := 'Order Cancelled ❌';
                    notif_msg := 'The merchant has cancelled your order.';
                ELSE
                    RETURN NEW;
            END CASE;

            PERFORM net.http_post(
                url := 'https://uuiqtfzgdisuuqtefrgb.supabase.co/functions/v1/send-onesignal-notification',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                    'player_ids', jsonb_build_array(customer_player_id),
                    'title', notif_title,
                    'message', notif_msg,
                    'target', 'customer',
                    'data', jsonb_build_object('order_id', NEW.id::text, 'type', 'ORDER_UPDATE', 'status', NEW.status::text)
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_notify_customer_on_order_update ON public.orders;
CREATE TRIGGER tr_notify_customer_on_order_update
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_customer_on_order_update();

-- 5. Broadcast notification (Target Customers correctly)
CREATE OR REPLACE FUNCTION public.notify_on_broadcast()
RETURNS trigger AS $$
DECLARE
    player_ids_array TEXT[];
BEGIN
    -- Get player IDs based on target audience (Smart and efficient)
    IF NEW.target_audience = 'all' THEN
        SELECT ARRAY_AGG(onesignal_player_id) INTO player_ids_array
        FROM public.profiles
        WHERE onesignal_player_id IS NOT NULL;
    ELSIF NEW.target_audience = 'drivers' THEN
        SELECT ARRAY_AGG(p.onesignal_player_id) INTO player_ids_array
        FROM public.profiles p
        WHERE p.role IN ('driver', 'both') AND p.onesignal_player_id IS NOT NULL;
    ELSIF NEW.target_audience = 'customers' THEN
        SELECT ARRAY_AGG(p.onesignal_player_id) INTO player_ids_array
        FROM public.profiles p
        WHERE p.role IN ('customer', 'both') AND p.onesignal_player_id IS NOT NULL;
    ELSIF NEW.target_audience = 'merchants' THEN
        SELECT ARRAY_AGG(p.onesignal_player_id) INTO player_ids_array
        FROM public.profiles p
        WHERE p.role = 'merchant' AND p.onesignal_player_id IS NOT NULL;
    END IF;

    IF player_ids_array IS NOT NULL AND array_length(player_ids_array, 1) > 0 THEN
        PERFORM net.http_post(
            url := 'https://uuiqtfzgdisuuqtefrgb.supabase.co/functions/v1/send-onesignal-notification',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := jsonb_build_object(
                'player_ids', to_jsonb(player_ids_array),
                'title', NEW.title,
                'message', NEW.message,
                'target', CASE 
                    WHEN NEW.target_audience = 'drivers' THEN 'driver'
                    WHEN NEW.target_audience = 'merchants' THEN 'merchant'
                    ELSE 'customer'
                END,
                'data', jsonb_build_object('type', 'BROADCAST', 'broadcast_id', NEW.id::text)
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
