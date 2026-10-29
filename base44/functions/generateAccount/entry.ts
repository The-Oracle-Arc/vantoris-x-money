import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { user_id, account_type, account_name, application_id, opening_balance } = body;

    if (!user_id || !account_type || !account_name) {
      return Response.json({ error: 'user_id, account_type, and account_name are required' }, { status: 400 });
    }

    // Generate a unique 10-digit account number and 9-digit routing number
    const existingAccounts = await base44.asServiceRole.entities.Account.list('-created_date', 500);
    const existingNumbers = new Set((existingAccounts || []).map(a => a.account_number).filter(Boolean));

    let accountNumber;
    let attempts = 0;
    do {
      accountNumber = String(Math.floor(1000000000 + Math.random() * 9000000000));
      attempts++;
    } while (existingNumbers.has(accountNumber) && attempts < 100);

    // Vantoris institutional routing number (fixed, as it's a single institution)
    const routingNumber = '021000021';

    const account = await base44.asServiceRole.entities.Account.create({
      user_id,
      account_type,
      account_name,
      account_number: accountNumber,
      routing_number: routingNumber,
      balance: opening_balance || 0,
      status: 'active',
      application_id: application_id || null,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id,
      title: 'Account Opened',
      message: `Your ${account_type} account has been opened. Account Number: ${accountNumber}, Routing Number: ${routingNumber}.`,
      type: 'success',
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'account_created',
      description: `Account created via AI Assistant: ${account_type} for user ${user_id}`,
      details: `Account #: ${accountNumber}, Routing #: ${routingNumber}`,
      target_user_id: user_id,
      user_id: user.id,
      admin_name: user.full_name || user.email || 'Admin',
    });

    return Response.json({
      success: true,
      account_id: account.id,
      account_number: accountNumber,
      routing_number: routingNumber,
      account_type,
      account_name,
      balance: opening_balance || 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});