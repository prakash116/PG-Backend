-- CreateEnum
CREATE TYPE "PlatformPaymentStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "Pg" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "referredById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PlatformPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPayment_pgId_key" ON "PlatformPayment"("pgId");

-- CreateIndex
CREATE INDEX "PlatformPayment_status_idx" ON "PlatformPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_pgId_key" ON "ReferralReward"("pgId");

-- CreateIndex
CREATE INDEX "ReferralReward_customerId_idx" ON "ReferralReward"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "Pg" ADD CONSTRAINT "Pg_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "Pg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "Pg"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill 1: every PG that already exists stays public.
--
-- `isPublished` defaults to false so a NEW listing is private until its fee is
-- paid. Applying that default to the listings already live would take them
-- down, which is not what a migration should do to working data.
UPDATE "Pg"
SET "isPublished" = true,
    "publishedAt" = "createdAt"
WHERE "isPublished" = false;

-- ---------------------------------------------------------------------------
-- Backfill 2: customers who registered before referral codes existed get one.
--
-- Derived from the row id so it is deterministic and unique. `translate` maps
-- 0 and 1 to 2 and 3, keeping the code inside the same unambiguous alphabet
-- `pg-code.ts` uses — no 0/1/I/O to misread. A collision would fail the unique
-- index below rather than pass silently.
UPDATE "User"
SET "referralCode" = 'PZR-' || translate(upper(substr(md5("id"), 1, 6)), '01', '23')
WHERE "role" = 'USER'
  AND "referralCode" IS NULL;
