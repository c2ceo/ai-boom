export interface GuestExitSteps {
  preserveContent: () => Promise<void>;
  removeGuestData: () => Promise<void>;
  deleteIdentity: () => Promise<void>;
}

export async function finishGuestExit(steps: GuestExitSteps) {
  // Never destroy the identity until content preservation has succeeded.
  await steps.preserveContent();
  await steps.removeGuestData();
  await steps.deleteIdentity();
}