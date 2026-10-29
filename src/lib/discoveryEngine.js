/**
 * Fail-closed discovery automation adapter.
 * The previous implementation depended on unconfigured search/verification
 * providers and could auto-approve records. Keep automated writes disabled
 * until source retrieval, verification, review, and audit run server-side.
 */
function unavailable() {
  throw new Error('Discovery automation is not configured. No records were changed or approved.');
}
export async function executeDiscoveryRun() { return unavailable(); }
export async function checkFreshness() { return unavailable(); }
export async function refreshProductCatalog() { return unavailable(); }
export async function verifyDiscoveryRecord() { return unavailable(); }
export async function refreshStaleRecords() { return unavailable(); }
export async function detectProductChanges() { return unavailable(); }
