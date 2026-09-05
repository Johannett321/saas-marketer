-- CreateEnum
CREATE TYPE "StoryboardStatus" AS ENUM ('PLANNING', 'RENDERING', 'READY', 'FAILED');

-- DropForeignKey
ALTER TABLE "VideoGeneration" DROP CONSTRAINT "VideoGeneration_extendsId_fkey";

-- AlterTable
ALTER TABLE "VideoGeneration" DROP COLUMN "extendsId",
ADD COLUMN     "covers" TEXT,
ADD COLUMN     "spokenLine" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "storyboardId" TEXT NOT NULL,
ALTER COLUMN "aspectRatio" SET DEFAULT '16:9',
ALTER COLUMN "segment" DROP DEFAULT;

-- CreateTable
CREATE TABLE "VideoStoryboard" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" "StoryboardStatus" NOT NULL DEFAULT 'PLANNING',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "continuous" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VideoStoryboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoStoryboard_cardId_createdAt_idx" ON "VideoStoryboard"("cardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoGeneration_storyboardId_segment_key" ON "VideoGeneration"("storyboardId", "segment");

-- AddForeignKey
ALTER TABLE "VideoStoryboard" ADD CONSTRAINT "VideoStoryboard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VideoCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoStoryboard" ADD CONSTRAINT "VideoStoryboard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "VideoStoryboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

