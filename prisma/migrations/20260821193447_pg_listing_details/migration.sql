-- CreateEnum
CREATE TYPE "PgGender" AS ENUM ('BOYS', 'GIRLS', 'CO_LIVING');

-- CreateEnum
CREATE TYPE "Cooling" AS ENUM ('AC', 'NON_AC', 'BOTH');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Pg" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cooling" "Cooling",
ADD COLUMN     "deposit" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "foodDetails" TEXT,
ADD COLUMN     "foodIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gender" "PgGender",
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "price" INTEGER,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verification" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PgRoomType" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "roomCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerBed" INTEGER NOT NULL,
    "totalBeds" INTEGER NOT NULL DEFAULT 0,
    "availableBeds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PgRoomType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PgRoomType_pgId_type_key" ON "PgRoomType"("pgId", "type");

-- AddForeignKey
ALTER TABLE "PgRoomType" ADD CONSTRAINT "PgRoomType_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "Pg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
