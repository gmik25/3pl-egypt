-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "aisle" TEXT,
ADD COLUMN     "allocatedClientId" TEXT,
ADD COLUMN     "bin" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "rack" TEXT;

-- CreateIndex
CREATE INDEX "Location_allocatedClientId_idx" ON "Location"("allocatedClientId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_allocatedClientId_fkey" FOREIGN KEY ("allocatedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

