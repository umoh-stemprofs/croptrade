-- CreateTable
CREATE TABLE "ManualRate" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "localPerForeign" DOUBLE PRECISION NOT NULL,
    "setOn" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualRate_farmId_idx" ON "ManualRate"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualRate_farmId_quote_key" ON "ManualRate"("farmId", "quote");

-- AddForeignKey
ALTER TABLE "ManualRate" ADD CONSTRAINT "ManualRate_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
