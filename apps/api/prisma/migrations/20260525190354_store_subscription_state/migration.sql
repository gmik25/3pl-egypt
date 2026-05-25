-- AlterTable
ALTER TABLE "StoreConnection" ADD COLUMN     "lastBackfillAt" TIMESTAMP(3),
ADD COLUMN     "webhookTopics" TEXT[] DEFAULT ARRAY[]::TEXT[];

