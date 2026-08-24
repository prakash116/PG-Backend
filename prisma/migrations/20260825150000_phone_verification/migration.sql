-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "requirePhoneVerification" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "widgetId" TEXT NOT NULL,
    "tokenAuth" TEXT NOT NULL,
    "authkey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SmsSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneVerification_phone_verifiedAt_idx" ON "PhoneVerification"("phone", "verifiedAt");

-- AddForeignKey
ALTER TABLE "SmsSetting" ADD CONSTRAINT "SmsSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

