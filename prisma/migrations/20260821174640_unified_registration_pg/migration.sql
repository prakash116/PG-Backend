-- AlterTable
ALTER TABLE "User" ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "state" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "pincode" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Pg" (
    "id" TEXT NOT NULL,
    "pgCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pg_pgCode_key" ON "Pg"("pgCode");

-- CreateIndex
CREATE UNIQUE INDEX "Pg_ownerId_key" ON "Pg"("ownerId");

-- AddForeignKey
ALTER TABLE "Pg" ADD CONSTRAINT "Pg_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
