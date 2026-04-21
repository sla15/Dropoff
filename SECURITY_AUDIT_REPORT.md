# 🛡️ Dropoff & Partner App - Security & Infrastructure Audit Report

**Date**: 2026-04-21
**Status**: IN PROGRESS

This document outlines security hardening and infrastructure consistency steps for the Dropoff ecosystem.

---

## 🚨 Security Hardening (Supabase Protection)

These measures prevent unauthorized tampering with account status and financial data.

### 1. Driver Status & Debt Protection
- **Table**: `public.drivers`
- **Issue**: Standard RLS allows users to update their own rows.
- **Risk**: A driver could technically reset their own `commission_debt` or `is_suspended` status.
- **Remediation**: Implement a database trigger that prevents any `UPDATE` to these columns unless performed by an administrator. This does **not** affect initial onboarding (INSERT).

### 2. Business Approval Protection
- **Table**: `public.businesses`
- **Issue**: Standard RLS allows merchants to update their own rows.
- **Risk**: A merchant could technically set their own `approval_status = 'approved'`.
- **Remediation**: Restrict `approval_status` updates to administrators only.

---

## 🔑 Infrastructure & Secrets

### 3. Hardcoded Google Maps API Keys
- **Location**: `index.html` (both apps)
- **Key**: `AIzaSyAzyTbEutPdMN-962xPIZTX4FLePM1NRaY`
- **Risk**: Key theft. Unauthorized usage.
- **Recommendation**: Apply "HTTP Referrer" restrictions in the Google Cloud Console for `*.dropoffgambia.com`.

### 4. Stale Project ID in Triggers
- **Location**: Database Functions (`handle_ride_update`, `process_referral_reward`)
- **Issue**: Some triggers reference project ID `jndlmfxjaujjmksbacaz`, but the active project is `uuiqtfzgdisuuqtefrgb`.
- **Impact**: Potential failures in push notifications.
- **Remediation**: Update trigger SQL to use the correct project URL.

---

## 📱 App Store & Play Store Compliance

### 5. Mandatory Legal Links
- **Current State**: Onboarding refers to `/terms` via `window.open`.
- **Issue**: Relative paths fail on native devices.
- **Remediation**: Use the **Capacitor Browser plugin** to open absolute URLs in the **Default System Browser**.

### 6. Placeholder Removal
- **Requirement**: No "DUMMY" text should be visible to reviewers.
- **Action**: Ensure `rideCount` and other stats are real database values.

---

## 📋 Implementation Checklist
- [x] Clean up SECURITY_AUDIT_REPORT.md
- [x] Update legal links to use Capacitor Browser (iOS/Android compliance)
- [x] Update stale project URLs in DB triggers (Purged legacy project ID)
- [x] Harden `drivers` table RLS (`commission_debt`, `is_suspended` protected)
- [ ] Harden `businesses` table RLS (`approval_status`)
- [ ] Verify Location Justification strings in native config
- [ ] Replace hardcoded stats (e.g., `rideCount`) with real data
- [ ] Implement HTTP Referrer restrictions for Google Maps API keys

