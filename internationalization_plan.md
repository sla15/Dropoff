# Internationalization and Payment Upgrade Plan

This plan outlines the steps to make the Dropoff Customer and Partner applications international and to integrate PayPal and automated Wave payments for driver commissions.

## User Review Required

> [!IMPORTANT]
> This transition requires structural changes to the Supabase schema to support multiple regions/countries.
> We will introduce a `regions` table to manage localized settings like currency, pricing, and support contacts. Each transaction (ride or order) will be tied to a specific region to ensure correct pricing.

> [!WARNING]
> Existing Gambian data will be migrated to a default 'Gambia' region. 
> All hardcoded strings in the frontend will be moved to translation files.

## Proposed Changes

---

### [Supabase Backend]

#### [NEW] `regions` table
A new table to store country-specific configurations.
- `id`: UUID (Primary Key)
- `name`: Text (e.g., 'Gambia', 'Senegal')
- `country_code`: Text (e.g., 'GM', 'SN')
- `currency_symbol`: Text (e.g., 'D', 'CFA')
- `currency_code`: Text (e.g., 'GMD', 'XOF')
- `support_phone`: Text
- `commission_percentage`: Decimal
- `min_ride_price`: Decimal
- `price_per_km`: Decimal
- `paypal_client_id`: Text (optional)
- `wave_business_id`: Text (optional)

#### [MODIFY] `app_settings` table
Instead of being the source for all prices, `app_settings` will focus on **Global Settings** that are common to all regions:
- `min_app_version`, `latest_app_version`: Global update management.
- `privacy_policy_url`, `terms_of_service_url`: Global legal links.
- `google_maps_api_key`: Shared infrastructure keys.
- `firebase_config`: Shared push notification setup.

Localized settings (prices, currency) will be removed from this table or ignored in favor of the `regions` table.

#### [MODIFY] `profiles` table
- Add `region_id` (FK to `regions`)
- Add `language_preference` (Text, default 'en')

#### [MODIFY] `drivers`, `businesses` tables
- Add `region_id` to allow regional filtering and search.

---

### [Customer & Partner Apps]

#### [NEW] Internationalization (i18n)
- Install `i18next` and `react-i18next`.
- Create `src/locales/` with `en.json`, `fr.json`, etc.
- Replace all hardcoded UI strings with `t('key')`.

#### [MODIFY] `ProfileContext.tsx`
- Update `appSettings` state to load from the `regions` table based on the user's `region_id`.
- Implement logic to detect region if not set (e.g., via IP or GPS on first launch).

#### [MODIFY] Payment Integration (Partner App)
- **PayPal**: Add a "Pay with PayPal" button in the Wallet/Commission screen using the region's `paypal_client_id`.
- **Wave**: Move from manual text to a more dynamic "Pay via Wave" component that uses the region's `wave_business_id`.
- **Currency Formatting**: Use `Intl.NumberFormat` across both apps to display prices correctly according to the local currency.

### [Regional Pricing Logic]
1. **Dynamic Defaults**: The `app_settings` catch-all row will be replaced by a lookup. When a customer opens the app, it detects their `region_id` (via GPS or last known profile location).
2. **Pricing Rules**: The `calculatePrice` function in both apps will pull `min_ride_price` and `price_per_km` from the active region instead of global settings.
3. **Cross-Border Safety**: If a user travels between regions, the app will prompt to update the region, ensuring they see correct local pricing (e.g., matching the local business's currency if they are ordering food).

### [Security & Data Integrity]
1. **Supabase RLS (Row Level Security)**: We will strengthen RLS policies to ensure that `region_id` cannot be manually changed by users to "hack" pricing. Only system-level updates or verified location changes will allow region updates.
2. **Official Payment SDKs**: For PayPal, we will use official, secure SDKs that never expose credentials in the frontend. All transaction signatures will be verified via Supabase Edge Functions.
3. **Commission Protection**: Commission debt calculations will remain server-side (via Supabase RPCs) to prevent drivers from manipulating their balance.
4. **Validation Logic**: Manual Wave transaction IDs will be strictly validated to prevent duplicate submissions or spoofing.

### [Geofenced Marketplace]
1. **Regional Filtering**: To ensure delivery feasibility, the Marketplace will filter merchants by the user's current `region_id`. A customer in Senegal will not see merchants in Sudan, as cross-border delivery is not currently supported.
2. **Search Radius**: Even within a region, the app will prioritize merchants within a specific delivery radius (e.g., 10-20km) to maintain service quality.
3. **Global Discovery (Optional)**: If you later decide to allow cross-border orders, we can add a "Global" toggle, but the current safe default will be regional.

## Verification Plan

### Automated Tests
- No existing automated tests were found. We will focus on manual verification for the UI and flow.

### Manual Verification
1. **Region Switch**: Manually change a user's `region_id` in Supabase and verify the app updates currency, pricing, and language.
2. **Translation Test**: Switch app language to French and verify all key UI elements are translated.
3. **PayPal Flow**: Test the PayPal sandbox integration in the Partner app for commission debt payment.
4. **Wave Instruction Locality**: Verify that Wave instructions show the correct business number for different regions.
