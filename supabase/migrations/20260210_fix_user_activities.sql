-- 1. Fix user_activities table
ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS reference_id UUID;

-- 2. Update log_user_activity to store reference_id
CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS trigger AS $$
BEGIN
    IF (TG_TABLE_NAME = 'rides') THEN
        IF (NEW.status = 'completed') THEN
            INSERT INTO public.user_activities (user_id, price, status, type, title, subtitle, reference_id)
            VALUES (
                NEW.customer_id, 
                NEW.price, 
                'completed', 
                'ride', 
                NEW.dropoff_address, 
                COALESCE(NEW.requested_vehicle_type::text, 'Economic'),
                NEW.id
            );
        ELSIF (NEW.status = 'cancelled') THEN
             INSERT INTO public.user_activities (user_id, price, status, type, title, subtitle, reference_id)
            VALUES (
                NEW.customer_id, 
                0, 
                'cancelled', 
                'ride', 
                NEW.dropoff_address, 
                COALESCE(NEW.requested_vehicle_type::text, 'Economic'),
                NEW.id
            );
        END IF;
    ELSIF (TG_TABLE_NAME = 'orders') THEN
        IF (NEW.status = 'completed') THEN
            INSERT INTO public.user_activities (user_id, price, status, type, title, subtitle, reference_id)
            VALUES (
                NEW.customer_id, 
                NEW.total_amount, 
                'completed', 
                'order', 
                'Marketplace Order', 
                'ID: ' || substring(NEW.id::text from 1 for 8),
                NEW.id
            );
        ELSIF (NEW.status = 'cancelled') THEN
            INSERT INTO public.user_activities (user_id, price, status, type, title, subtitle, reference_id)
            VALUES (
                NEW.customer_id, 
                0, 
                'cancelled', 
                'order', 
                'Marketplace Order', 
                'ID: ' || substring(NEW.id::text from 1 for 8),
                NEW.id
            );
        END IF;
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
                url := 'https://jndlmfxjaujjmksbacaz.supabase.co/functions/v1/send-onesignal-notification',
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
                url := 'https://jndlmfxjaujjmksbacaz.supabase.co/functions/v1/send-onesignal-notification',
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
            url := 'https://jndlmfxjaujjmksbacaz.supabase.co/functions/v1/send-onesignal-notification',
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
