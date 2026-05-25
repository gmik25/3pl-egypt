-- CreateEnum
CREATE TYPE "StorePlatform" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'SALLA', 'ZID');

-- CreateEnum
CREATE TYPE "StoreConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "StoreConnection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" "StorePlatform" NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "status" "StoreConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "accessTokenEncrypted" TEXT,
    "webhookSecretEncrypted" TEXT,
    "scopes" TEXT,
    "oauthState" TEXT,
    "installedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreConnection_shopDomain_key" ON "StoreConnection"("shopDomain");

-- CreateIndex
CREATE INDEX "StoreConnection_clientId_idx" ON "StoreConnection"("clientId");

-- AddForeignKey
ALTER TABLE "StoreConnection" ADD CONSTRAINT "StoreConnection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

