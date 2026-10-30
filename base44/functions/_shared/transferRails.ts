export type TransferRail = 'ACH' | 'FEDWIRE';

export interface BankTransferInstruction {
  transferRequestId: string;
  amountCents: number;
  currency: 'USD';
  idempotencyKey: string;
  beneficiary: {
    name: string;
    bankName: string;
    routingNumber: string;
    accountToken: string;
    accountLast4: string;
  };
  memo?: string;
}

export interface BankSubmission {
  providerId: string;
  bankReference: string;
  acceptedAt: string;
  status: 'submitted' | 'pending';
}

/**
 * Provider-specific ACH and Fedwire clients implement this contract only after
 * AVCU has an executed sponsor-bank/provider agreement and production credentials.
 * The default adapters deliberately fail closed and never simulate a submission.
 */
export interface TransferRailAdapter {
  readonly rail: TransferRail;
  readonly providerId: string;
  submit(instruction: BankTransferInstruction): Promise<BankSubmission>;
  verifyWebhook(rawBody: string, signature: string): Promise<boolean>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(rail: TransferRail) {
    super(`${rail} provider is not configured for production. No bank request was sent.`);
    this.name = 'ProviderNotConfiguredError';
  }
}

class UnconfiguredRailAdapter implements TransferRailAdapter {
  readonly providerId = 'not-configured';
  constructor(readonly rail: TransferRail) {}

  async submit(_instruction: BankTransferInstruction): Promise<BankSubmission> {
    throw new ProviderNotConfiguredError(this.rail);
  }

  async verifyWebhook(_rawBody: string, _signature: string): Promise<boolean> {
    return false;
  }
}

export const achAdapter: TransferRailAdapter = new UnconfiguredRailAdapter('ACH');
export const fedwireAdapter: TransferRailAdapter = new UnconfiguredRailAdapter('FEDWIRE');

export function getTransferRailAdapter(rail: TransferRail): TransferRailAdapter {
  return rail === 'ACH' ? achAdapter : fedwireAdapter;
}
