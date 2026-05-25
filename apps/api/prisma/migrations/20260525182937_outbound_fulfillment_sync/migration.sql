-- CreateEnum
CREATE TYPE "StoreSyncStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SYNCED', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "storeConnectionId" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "storeFulfillmentId" TEXT,
ADD COLUMN     "storeSyncError" TEXT,
ADD COLUMN     "storeSyncStatus" "StoreSyncStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "storeSyncedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeConnectionId_fkey" FOREIGN KEY ("storeConnectionId") REFERENCES "StoreConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

