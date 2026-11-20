// Firebase web-app settings (Firebase console → Project settings → Your apps).
// While `firebaseConfig` is null, the tracker and Mission Control run in clearly-labelled DEMO MODE:
// fictional accounts, a simulated database kept in this browser, and a simulated copy of the security rules.
// The web config is NOT a secret — real security comes from firestore.rules on Google's servers.
export const firebaseConfig = null;

// ⚠ UNVERIFIED CONFIGURATION — the school's Google Workspace domain has NOT been confirmed.
// Replace the placeholder with the confirmed domain(s) (staff and students may differ), set
// domainVerified = true, and make the same change in schoolDomains() inside firestore.rules.
export const allowedDomains = ["UNVERIFIED-DOMAIN.invalid"];
export const domainVerified = false;
