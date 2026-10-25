-- The activity log: who did what in the app, and what changed.

-- CreateEnum
CREATE TYPE "AuditKind" AS ENUM ('CHANGE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "AuditKind" NOT NULL,
    "actor_id" UUID,
    "actor_name" TEXT,
    "actor_role" "Role",
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "method" TEXT,
    "path" TEXT,
    "change_count" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_change_count_check" CHECK ("change_count" >= 0)
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_category_created_at_idx" ON "audit_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_kind_created_at_idx" ON "audit_logs"("kind", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
