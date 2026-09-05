-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('QUEUED', 'GENERATING', 'READY', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'VIDEO_GENERATED';
ALTER TYPE "ActivityType" ADD VALUE 'VIDEO_EXTENDED';

-- CreateTable
CREATE TABLE "VideoGeneration" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'QUEUED',
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 8,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "operationName" TEXT,
    "sourceUri" TEXT,
    "error" TEXT,
    "data" BYTEA,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "extendsId" TEXT,
    "segment" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VideoGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoGeneration_cardId_createdAt_idx" ON "VideoGeneration"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoGeneration_status_idx" ON "VideoGeneration"("status");

-- AddForeignKey
ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VideoCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_extendsId_fkey" FOREIGN KEY ("extendsId") REFERENCES "VideoGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
