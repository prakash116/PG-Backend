-- CreateEnum
CREATE TYPE "ReferralPayoutStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "ReferralPayout" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "upiId" TEXT NOT NULL,
    "status" "ReferralPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,

    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralPayout_customerId_idx" ON "ReferralPayout"("customerId");

-- CreateIndex
CREATE INDEX "ReferralPayout_status_idx" ON "ReferralPayout"("status");

-- AddForeignKey
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

