-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('KG', 'TRAY', 'LITRE');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('SIMULATED', 'LIVE');

-- CreateEnum
CREATE TYPE "FxSource" AS ENUM ('SIMULATED', 'LIVE', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTick" (
    "id" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "unit" "PriceUnit" NOT NULL,
    "source" "PriceSource" NOT NULL DEFAULT 'SIMULATED',

    CONSTRAINT "PriceTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "qtyKg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "farmId" TEXT NOT NULL,
    "localCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "exportCostPct" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("farmId")
);

-- CreateTable
CREATE TABLE "FxTick" (
    "id" TEXT NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'NGN',
    "quote" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "localPerForeign" DOUBLE PRECISION NOT NULL,
    "source" "FxSource" NOT NULL DEFAULT 'SIMULATED',

    CONSTRAINT "FxTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "qtyKg" DOUBLE PRECISION NOT NULL,
    "localPricePerKgKobo" INTEGER NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "grossForeign" DOUBLE PRECISION NOT NULL,
    "netForeign" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Farm_userId_idx" ON "Farm"("userId");

-- CreateIndex
CREATE INDEX "PriceTick_date_idx" ON "PriceTick"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTick_crop_date_key" ON "PriceTick"("crop", "date");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_farmId_fetchedAt_idx" ON "WeatherSnapshot"("farmId", "fetchedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_farmId_idx" ON "InventoryItem"("farmId");

-- CreateIndex
CREATE INDEX "FxTick_date_idx" ON "FxTick"("date");

-- CreateIndex
CREATE UNIQUE INDEX "FxTick_quote_date_key" ON "FxTick"("quote", "date");

-- CreateIndex
CREATE INDEX "Valuation_farmId_idx" ON "Valuation"("farmId");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

