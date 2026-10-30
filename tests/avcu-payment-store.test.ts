import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  acquireLease, releaseLease, renewLease, claimPaymentOperation,
  ingestProviderEvent, postBalancedJournal, reverseJournal, closePaymentStore,
} from '../base44/functions/_shared/paymentStore.ts';

const enabled = !!Deno.env.get('AVCU_LEDGER_TEST_DATABASE_URL');
Deno.test({
  name: 'AVCU PostgreSQL payment store integration',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const key = `test-${crypto.randomUUID()}`;
    try {
      const claims = await Promise.all(Array.from({length:20},()=>claimPaymentOperation({
        operationType:'integration_test', idempotencyKey:key, request:{amount:100,nonce:key}
      })));
      assertEquals(claims.filter(x=>x.created).length,1);
      assertEquals(new Set(claims.map(x=>x.id)).size,1);

      const mismatch = await assertRejects(()=>claimPaymentOperation({
        operationType:'integration_test', idempotencyKey:key, request:{amount:101,nonce:key}
      }));
      assert(mismatch.message.includes('IDEMPOTENCY_CONFLICT'));

      const eventKey=`evt-${crypto.randomUUID()}`;
      const eventInput={providerId:'test-provider',environment:'sandbox' as const,
        providerEventId:eventKey,eventType:'TEST',payload:{eventKey,amount:1},verifiedAt:new Date().toISOString()};
      const events=await Promise.all(Array.from({length:10},()=>ingestProviderEvent(eventInput)));
      assertEquals(events.filter(x=>!x.duplicate).length,1);
      assertEquals(new Set(events.map(x=>x.id)).size,1);

      const lockName=`test-lock-${crypto.randomUUID()}`;
      const ownerA=crypto.randomUUID(), ownerB=crypto.randomUUID();
      const leaseA=await acquireLease(lockName,ownerA,15);
      assert(leaseA);
      assertEquals(await acquireLease(lockName,ownerB,15),null);
      await new Promise(resolve=>setTimeout(resolve,16000));
      const leaseB=await acquireLease(lockName,ownerB,15);
      assert(leaseB);
      assert(leaseB!.fencingToken>leaseA!.fencingToken);
      assertEquals(await renewLease(leaseA!,15),false);
      assertEquals(await releaseLease(leaseA!),false);
      assertEquals(await renewLease(leaseB!,15),true);
      assertEquals(await releaseLease(leaseB!),true);

      const accountA=crypto.randomUUID(), accountB=crypto.randomUUID();
      // Test fixture accounts are intentionally unique and isolated.
      const postgres = (await import('npm:postgres@3.4.7')).default;
      const db=postgres(Deno.env.get('AVCU_LEDGER_TEST_DATABASE_URL')!,{ssl:'require',prepare:false});
      await db`INSERT INTO avcu_payments.ledger_accounts(id,external_account_ref,account_type) VALUES
        (${accountA},${'test:'+accountA},'member_deposit'),
        (${accountB},${'test:'+accountB},'bank_clearing')`;
      try {
        const journal=await postBalancedJournal({sourceType:'test',sourceId:key,idempotencyKey:`journal-${key}`,
          description:'Integration test journal',entries:[
            {ledgerAccountId:accountA,amountCents:1000},{ledgerAccountId:accountB,amountCents:-1000}
          ]});
        assertEquals(journal.duplicate,false);
        const retries=await Promise.all(Array.from({length:8},()=>postBalancedJournal({
          sourceType:'test',sourceId:key,idempotencyKey:`journal-${key}`,
          description:'Integration test journal',entries:[
            {ledgerAccountId:accountA,amountCents:1000},{ledgerAccountId:accountB,amountCents:-1000}
          ]
        })));
        assertEquals(new Set(retries.map(x=>x.journalId)).size,1);
        assertEquals(retries.filter(x=>!x.duplicate).length,0);
        assertEquals(retries[0].journalId,journal.journalId);
        const reversal=await reverseJournal({originalJournalId:journal.journalId,
          idempotencyKey:`reversal-${key}`,actorId:'integration-test',reason:'Integration test reversal'});
        assertEquals(reversal.duplicate,false);
      } finally {
        // The test database is disposable; ledger rows are append-only by design.
        await db.end({timeout:5});
      }
    } finally {
      await closePaymentStore();
    }
  }
});
