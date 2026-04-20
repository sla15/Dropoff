# Dropoff Customer App - Production Hardening Log

This log documents the architectural and security hardening steps taken to prepare the Customer App for production launch.

## 1. Fail-Closed Pricing Security
- **Goal**: Prevent booking with manipulated or stale pricing.
- **Changes**:
    - Implemented a mandatory `AppSettings` validation layer in the "Book Ride" flow.
    - Booking is now explicitly disabled until authoritative settings (min fees, multipliers) are verified from the server.
    - Integrated a professional `RequestErrorModal` to handle network failures during pricing initialization, providing a clear recovery path.

## 2. Unified Ride Intelligence (Heartbeat)
- **Goal**: Eliminate polling fragmentation and improve state recovery.
- **Changes**:
    - Centralized all ride monitoring logic into a single 4-second `Heartbeat` loop in `Ride.tsx`.
    - Handles driver search, status tracking, and failsafe timeouts in one consistent cycle.
    - Improved resume logic to instantly synchronize state when returning from the background.

## 3. Communication Resilience
- **Goal**: Ensure reliable push notifications.
- **Changes**:
    - **FCM Retry Logic**: Implemented an exponential backoff retry utility for token synchronization.
    - Ensures that push notification registration survives intermittent network drops.

## 4. Onboarding UI Resiliency
- **Goal**: Guarantee flawless UI presentation on all devices and fix layout shifting.
- **Changes**:
    - Replaced native emoji flags with `flagcdn.com` image assets to bypass Android WebView text-fallback bugs (where flags render as raw letters like "GM").
    - Refactored the phone input container to use strict flex-row bounding, eliminating layout shifting when typing.
    - Locked the Country Picker Drawer to a consistent `90vh` height so it doesn't jarringly shrink/expand dynamically when filtering search results.
    - Changed top action buttons from `fixed` to `absolute` relative to an `overflow-hidden` container to guarantee they act as a true navbar that never shifts upward when the virtual keyboard is active.

---
*Date: 2026-04-20*
*Status: HARDENED*
