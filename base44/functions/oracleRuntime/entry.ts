import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { boot } from '../../shared/runtime/bootLoader.ts';
import { logger } from '../../shared/runtime/logger.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { message, context, action = 'process' } = body;

    // Boot the runtime (cached after first call)
    const { services, runtime, stages: bootStages } = await boot(base44);

    // Health check endpoint
    if (action === 'health') {
      const health = await services.health.runAll();
      return Response.json({ status: 'ok', health, stages: bootStages || [] });
    }

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build the AI request through the Oracle pipeline:
    // User → Bud → Oracle → Guardian → Nexus → Capability Registry → Platform Services / Spark / Orbit → Oracle → Bud
    const request = {
      id: crypto.randomUUID(),
      userId: user.id,
      message,
      context: {
        userId: user.id,
        sessionId: context?.sessionId || crypto.randomUUID(),
        userRole: user.role,
        timestamp: new Date().toISOString(),
        source: 'bud',
      },
      capabilities: context?.capabilities || ['reasoning', 'knowledge'],
      priority: context?.priority || 'normal',
    };

    const response = await runtime.oracle.process(request);

    // Persist conversation via ConversationService (not owned by Bud)
    const thread = await services.conversation.getOrCreateThread(user.id, 'AI Assistant');
    await services.conversation.addMessage(thread.id, user.id, 'user', message);
    await services.conversation.addMessage(thread.id, user.id, 'assistant', response.content);

    // Record metrics via MetricsService
    await services.metrics.increment('ai_requests', 1, { userId: user.id });

    // === Case Workspace & Recommendation Persistence ===
    // Each member interaction creates/updates a shared case workspace.
    // If the assistant produced a structured recommendation, persist it for staff approval.
    let workspaceId = null;
    let recommendationId = null;
    let pendingApproval = false;

    try {
      // Find or create the case workspace for this member
      const existingWorkspaces = await base44.asServiceRole.entities.CaseWorkspace.filter({
        user_id: user.id,
        status: { $in: ['open', 'pending_review'] },
      });

      let workspace;
      if (existingWorkspaces.length > 0) {
        workspace = existingWorkspaces[0];
        // Update with latest specialist if routed
        const specialists = workspace.specialists || [];
        const newSpecialist = response.routing?.specialist;
        if (newSpecialist && !specialists.includes(newSpecialist)) {
          specialists.push(newSpecialist);
        }
        const timeline = workspace.timeline ? JSON.parse(workspace.timeline) : [];
        timeline.push({
          timestamp: new Date().toISOString(),
          event: 'member_message',
          specialist: newSpecialist,
          summary: message.substring(0, 200),
        });
        workspace = await base44.asServiceRole.entities.CaseWorkspace.update(workspace.id, {
          specialists,
          thread_id: thread.id,
          conversation_summary: message.substring(0, 500),
          timeline: JSON.stringify(timeline.slice(-20)),
          status: response.recommendation ? 'pending_review' : workspace.status,
        });
      } else {
        const timeline = [{
          timestamp: new Date().toISOString(),
          event: 'case_created',
          specialist: response.routing?.specialist,
          summary: message.substring(0, 200),
        }];
        workspace = await base44.asServiceRole.entities.CaseWorkspace.create({
          user_id: user.id,
          subject: message.substring(0, 120),
          status: 'open',
          specialists: response.routing?.specialist ? [response.routing.specialist] : [],
          thread_id: thread.id,
          conversation_summary: message.substring(0, 500),
          timeline: JSON.stringify(timeline),
          priority: response.escalate ? 'high' : 'normal',
        });
      }
      workspaceId = workspace.id;

      // Persist structured recommendation if one was produced
      if (response.recommendation) {
        const rec = response.recommendation;
        const isEscalation = rec.is_escalation || response.escalate || false;

        const recommendation = await base44.asServiceRole.entities.AssistantRecommendation.create({
          workspace_id: workspace.id,
          user_id: user.id,
          specialist: response.routing?.specialist || 'banking',
          member_message: message,
          summary: rec.summary || 'Recommendation prepared for staff review.',
          supporting_evidence: rec.supporting_evidence || '',
          confidence_level: rec.confidence_level || response.routing?.confidence || 'medium',
          potential_risks: rec.potential_risks || '',
          applicable_policies: rec.applicable_policies || '',
          recommended_action: rec.recommended_action || '',
          required_approver: response.routing?.specialist === 'compliance' ? 'compliance' : 'admin',
          status: isEscalation ? 'escalated' : 'pending',
          is_action_impacting: true,
          escalation_reason: isEscalation ? (rec.escalation_reason || 'Low confidence or conflicting evidence — escalated for staff review.') : '',
          collaboration_notes: response.routing?.collaborators?.length
            ? `Collaborating specialists: ${response.routing.collaborators.join(', ')}`
            : '',
        });
        recommendationId = recommendation.id;
        pendingApproval = true;

        // Audit the recommendation creation
        await services.audit.log({
          actionType: 'recommendation_created',
          description: `Assistant recommendation created by ${response.routing?.specialist || 'banking'} specialist`,
          details: JSON.stringify({
            workspaceId: workspace.id,
            recommendationId: recommendation.id,
            specialist: response.routing?.specialist,
            confidence: rec.confidence_level,
            escalated: isEscalation,
          }),
          targetUserId: user.id,
        });
      }
    } catch (persistError) {
      logger.error('Case workspace persistence failed', { error: persistError.message });
      // Don't fail the request — the member still gets their response
    }

    return Response.json({
      response: response.content,
      requestId: response.requestId,
      metadata: response.metadata,
      sources: response.sources,
      capabilities: response.capabilities,
      routing: response.routing,
      workspaceId,
      recommendationId,
      pendingApproval,
      escalated: response.escalate || false,
    });
  } catch (error) {
    logger.error('Oracle runtime error', { error: error.message });
    return Response.json({ error: error.message }, { status: 500 });
  }
}