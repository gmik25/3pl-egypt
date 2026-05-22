-- DropIndex
DROP INDEX "CourierCoverage_courier_governorate_key";

-- DropIndex
DROP INDEX "Shipment_courier_idx";

-- AlterTable
ALTER TABLE "CourierCoverage" DROP COLUMN "courier",
ADD COLUMN     "courierId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "courier",
ADD COLUMN     "courierId" TEXT;

-- DropEnum
DROP TYPE "CourierName";

-- CreateTable
CREATE TABLE "CourierAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiBaseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "webhookSecretEncrypted" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierAccount_code_key" ON "CourierAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourierCoverage_courierId_governorate_key" ON "CourierCoverage"("courierId", "governorate");

-- CreateIndex
CREATE INDEX "Shipment_courierId_idx" ON "Shipment"("courierId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierCoverage" ADD CONSTRAINT "CourierCoverage_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "CourierAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

