-- The chat is for teachers and students only: admins have no conversations.
-- Direct conversations with an admin and groups an admin created are deleted
-- (with their messages); admins are taken out of the remaining groups.
DELETE FROM "conversations" AS c
WHERE (
    c."type" = 'DIRECT' AND EXISTS (
        SELECT 1
        FROM "conversation_members" AS m
        JOIN "users" AS u ON u."id" = m."user_id"
        WHERE m."conversation_id" = c."id" AND u."role" = 'ADMIN'
    )
) OR (
    c."type" = 'GROUP' AND c."created_by_id" IN (
        SELECT "id" FROM "users" WHERE "role" = 'ADMIN'
    )
);

DELETE FROM "conversation_members" AS m
USING "users" AS u
WHERE u."id" = m."user_id" AND u."role" = 'ADMIN';
