/** Enforce maker-checker separation: a requester cannot review, approve, reject, or submit their own transfer. */
export function assertStaffIsNotRequester(staffId: string, requesterId: string): void {
  if (!staffId || !requesterId) throw new Error('SEPARATION_OF_DUTIES_ID_REQUIRED');
  if (staffId === requesterId) throw new Error('SEPARATION_OF_DUTIES_REQUESTER_CONFLICT');
}
