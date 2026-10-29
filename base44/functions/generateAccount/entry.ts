import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACCOUNT_CREATION_ROLES = new Set([
  'admin',
  'super_administrator',
  'administrator',
  'operations_manager',
]);

const ACCOUNT_TYPES = new Set([
  'Checking',
  'Savings',
  'Money Market',
  'CD',
  'Joint',
  'Business',
]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ACCOUNT_CREATION_ROLES.has(user.role)) {
      return Response.json({ error: 'Forbidden: account creation requires an authorized operator' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'A valid JSON object is required' }, { status: 400 });
    }

    const { user_id, account_type, account_name, application_id } = body;
    if (typeof user_id !== 'string' || !user_id.trim() ||
        typeof application_id !== 'string' || !application_id.trim() ||
        typeof account_name !== 'string' || !account_name.trim() ||
        account_name.length > 120 ||
        !ACCOUNT_TYPES.has(account_type)) {
      return Response.json({
        error: 'A valid target user, application, account type, and account name are required',
      }, { status: 400 });
    }

    // The application must exist, belong to the target member, and already be approved.
    const application = await base44.asServiceRole.entities.Application.get(application_id);
    if (!application || application.user_id !== user_id ||
        application.application_status !== 'approved') {
      return Response.json({
        error: 'An approved application for this member is required',
      }, { status: 409 });
    }

    // An application may produce at most one account, including on retries.
    const existingForApplication = await base44.asServiceRole.entities.Account.filter({
      application_id,
    });
    if (existingForApplication?.length) {
      return Response.json({ error: 'An account already exists for this application' }, { status: 409 });
    }

    // Opening balances are not accepted from callers. Funding requires a separate
    // authorized ledger/provider workflow and must never be created by this endpoint.
    const existingAccounts = await base44.asServiceRole.entities.Account.list('-created_date', 1000);
    const existingNumbers = new Set((existingAccounts || []).map((a: any) => a.account_number).filter(Boolean));

    let accountNumber = '';
    for (let attempts = 0; attempts < 100; attempts++) {
      const random = new Uint32Array(2);
      crypto.getRandomValues(random);
      const candidate = String(1000000000 + ((random[0] * 0x100000000 + random[1]) % 9000000000)).slice(0, 10);
      if (!existingNumbers.has(candidate)) {
        accountNumber = candidate;
        break;
      }
    }
    if (!accountNumber) {
      return Response.json({ error: 'Could not issue a unique account number; retry later' }, { status: 503 });
    }

    const routingNumber = '021000021';
    const account = await base44.asServiceRole.entities.Account.create({
      user_id,
      account_type,
      account_name: account_name.trim(),
      account_number: accountNumber,
      routing_number: routingNumber,
      balance: 0,
      status: 'active',
      application_id,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id,
      title: 'Account Opened',
      message: `Your ${account_type} account has been opened. Account ending in ${accountNumber.slice(-4)}.`,
      type: 'success',
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'account_created',
      description: `Account created for approved application ${application_id}`,
      details: `Account ending in ${accountNumber.slice(-4)}; opening balance: 0`,
      target_user_id: user_id,
      user_id: user.id,
      admin_name: user.full_name || user.email || 'Authorized operator',
    });

    return Response.json({
      success: true,
      account_id: account.id,
      account_number: accountNumber,
      routing_number: routingNumber,
      account_type,
      account_name: account_name.trim(),
      balance: 0,
    });
  } catch {
    return Response.json({ error: 'Account creation failed; no success can be confirmed' }, { status: 500 });
  }
});
