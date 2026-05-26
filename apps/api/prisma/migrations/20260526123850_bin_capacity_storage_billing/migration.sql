-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE 'STORAGE_FEE';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "storagePerBinPerDayPiastres" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "capacityUnits" INTEGER;

