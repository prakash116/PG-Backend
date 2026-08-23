-- Closing an account sets `deletedAt` instead of removing the row. The purge
-- job hard-deletes it 30 days later, which is the window a Super Admin has to
-- restore it. Additive and nullable: no existing row is touched.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
