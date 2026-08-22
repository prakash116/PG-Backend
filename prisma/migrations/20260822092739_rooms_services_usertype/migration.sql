-- Rooms become real records, services become billable, and Occupation is
-- replaced by the UserType a Find-PG user already chose.

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "floor" TEXT,
    "totalBeds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidentService" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResidentService_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Resident" ADD COLUMN "roomId" TEXT,
ADD COLUMN     "userType" "UserType";

-- Carry the existing room counts across as real rooms, so nothing an owner
-- already entered is lost. Numbers are placeholders they can rename.
INSERT INTO "Room" ("id", "pgId", "number", "type", "totalBeds", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    rt."pgId",
    CASE rt."type"
        WHEN 'SINGLE'  THEN 'S'
        WHEN 'DOUBLE'  THEN 'D'
        WHEN 'TRIPLE'  THEN 'T'
        ELSE 'P'
    END || g.i::text,
    rt."type",
    CASE rt."type"
        WHEN 'SINGLE'  THEN 1
        WHEN 'DOUBLE'  THEN 2
        WHEN 'TRIPLE'  THEN 3
        ELSE 1
    END,
    NOW(),
    NOW()
FROM "PgRoomType" rt
CROSS JOIN LATERAL generate_series(1, rt."roomCount") AS g(i)
WHERE rt."roomCount" > 0;

-- AlterTable: counts now come from the rows above.
ALTER TABLE "PgRoomType" DROP COLUMN "roomCount",
DROP COLUMN "totalBeds";

-- AlterTable: Occupation duplicated UserType.
ALTER TABLE "Resident" DROP COLUMN "occupation";

-- DropEnum
DROP TYPE "Occupation";

-- CreateIndex
CREATE INDEX "Room_pgId_type_idx" ON "Room"("pgId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Room_pgId_number_key" ON "Room"("pgId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentService_residentId_name_key" ON "ResidentService"("residentId", "name");

-- AddForeignKey
ALTER TABLE "Resident" ADD CONSTRAINT "Resident_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "Pg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_pgId_type_fkey" FOREIGN KEY ("pgId", "type") REFERENCES "PgRoomType"("pgId", "type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentService" ADD CONSTRAINT "ResidentService_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
