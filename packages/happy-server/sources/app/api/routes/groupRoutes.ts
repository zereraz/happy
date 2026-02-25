import { eventRouter, buildNewGroupUpdate, buildUpdateGroupUpdate, buildDeleteGroupUpdate, buildUpdateSessionGroupUpdate } from "@/app/events/eventRouter";
import { db } from "@/storage/db";
import { Fastify } from "../types";
import { z } from "zod";
import { randomKeyNaked } from "@/utils/randomKeyNaked";
import { allocateUserSeq } from "@/storage/seq";
import { log } from "@/utils/log";

export function groupRoutes(app: Fastify) {

    // GET /v1/groups - List all groups for the account
    app.get('/v1/groups', {
        preHandler: app.authenticate,
    }, async (request, reply) => {
        const userId = request.userId;
        const groups = await db.group.findMany({
            where: { accountId: userId },
            orderBy: { sortOrder: 'asc' },
        });
        return reply.send({
            groups: groups.map(g => ({
                id: g.id,
                name: g.name,
                sortOrder: g.sortOrder,
                seq: g.seq,
                createdAt: g.createdAt.getTime(),
                updatedAt: g.updatedAt.getTime(),
            }))
        });
    });

    // POST /v1/groups - Create a new group (idempotent by name)
    app.post('/v1/groups', {
        preHandler: app.authenticate,
        schema: {
            body: z.object({
                name: z.string().min(1).max(100),
                sortOrder: z.number().int().optional(),
            })
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const { name, sortOrder } = request.body;

        // Idempotent: return existing group with same name
        const existing = await db.group.findFirst({
            where: { accountId: userId, name }
        });
        if (existing) {
            return reply.send({
                group: {
                    id: existing.id,
                    name: existing.name,
                    sortOrder: existing.sortOrder,
                    seq: existing.seq,
                    createdAt: existing.createdAt.getTime(),
                    updatedAt: existing.updatedAt.getTime(),
                }
            });
        }

        const updSeq = await allocateUserSeq(userId);
        const group = await db.group.create({
            data: {
                accountId: userId,
                name,
                sortOrder: sortOrder ?? 0,
            }
        });

        const updatePayload = buildNewGroupUpdate(group, updSeq, randomKeyNaked(12));
        eventRouter.emitUpdate({
            userId,
            payload: updatePayload,
            recipientFilter: { type: 'user-scoped-only' }
        });

        return reply.send({
            group: {
                id: group.id,
                name: group.name,
                sortOrder: group.sortOrder,
                seq: group.seq,
                createdAt: group.createdAt.getTime(),
                updatedAt: group.updatedAt.getTime(),
            }
        });
    });

    // POST /v1/groups/:id - Update a group
    app.post('/v1/groups/:id', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({ id: z.string() }),
            body: z.object({
                name: z.string().min(1).max(100).optional(),
                sortOrder: z.number().int().optional(),
            })
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const groupId = request.params.id;
        const { name, sortOrder } = request.body;

        const group = await db.group.findFirst({
            where: { id: groupId, accountId: userId }
        });
        if (!group) {
            return reply.code(404).send({ error: 'Group not found' });
        }

        const data: Record<string, any> = {};
        if (name !== undefined) data.name = name;
        if (sortOrder !== undefined) data.sortOrder = sortOrder;

        if (Object.keys(data).length === 0) {
            return reply.send({ success: true });
        }

        await db.group.update({
            where: { id: groupId },
            data,
        });

        const updSeq = await allocateUserSeq(userId);
        const updatePayload = buildUpdateGroupUpdate(groupId, updSeq, randomKeyNaked(12), name, sortOrder);
        eventRouter.emitUpdate({
            userId,
            payload: updatePayload,
            recipientFilter: { type: 'user-scoped-only' }
        });

        return reply.send({ success: true });
    });

    // DELETE /v1/groups/:id - Delete a group (sessions get groupId nullified via onDelete: SetNull)
    app.delete('/v1/groups/:id', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({ id: z.string() }),
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const groupId = request.params.id;

        const group = await db.group.findFirst({
            where: { id: groupId, accountId: userId }
        });
        if (!group) {
            return reply.code(404).send({ error: 'Group not found' });
        }

        // Nullify groupId on sessions first (explicit, in case onDelete doesn't fire)
        await db.session.updateMany({
            where: { groupId },
            data: { groupId: null },
        });

        await db.group.delete({
            where: { id: groupId }
        });

        const updSeq = await allocateUserSeq(userId);
        const updatePayload = buildDeleteGroupUpdate(groupId, updSeq, randomKeyNaked(12));
        eventRouter.emitUpdate({
            userId,
            payload: updatePayload,
            recipientFilter: { type: 'user-scoped-only' }
        });

        return reply.send({ success: true });
    });

    // POST /v1/sessions/:id/group - Assign a session to a group (or unassign)
    app.post('/v1/sessions/:id/group', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({ id: z.string() }),
            body: z.object({
                groupId: z.string().nullable(),
            })
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const sessionId = request.params.id;
        const { groupId } = request.body;

        const session = await db.session.findFirst({
            where: { id: sessionId, accountId: userId }
        });
        if (!session) {
            return reply.code(404).send({ error: 'Session not found' });
        }

        // Verify group belongs to user if not null
        if (groupId) {
            const group = await db.group.findFirst({
                where: { id: groupId, accountId: userId }
            });
            if (!group) {
                return reply.code(404).send({ error: 'Group not found' });
            }
        }

        await db.session.update({
            where: { id: sessionId },
            data: { groupId },
        });

        const updSeq = await allocateUserSeq(userId);
        const updatePayload = buildUpdateSessionGroupUpdate(sessionId, groupId, updSeq, randomKeyNaked(12));
        eventRouter.emitUpdate({
            userId,
            payload: updatePayload,
            recipientFilter: { type: 'user-scoped-only' }
        });

        return reply.send({ success: true });
    });
}
