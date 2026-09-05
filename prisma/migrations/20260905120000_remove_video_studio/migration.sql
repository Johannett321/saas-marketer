-- AlterEnum
BEGIN;
-- The video studio is gone: its history lines no longer describe anything the
-- app can show, and the enum values cannot be dropped while rows still use them.
DELETE FROM "Activity" WHERE "type" IN ('VIDEO_GENERATED', 'VIDEO_EXTENDED');
CREATE TYPE "ActivityType_new" AS ENUM ('CREATED', 'MOVED', 'TITLE_CHANGED', 'ANGLE_CHANGED', 'DESCRIPTION_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'SCRIPT_GENERATED', 'SCRIPT_IMPROVED', 'SCRIPT_EDITED', 'COMMENTED');
ALTER TABLE "Activity" ALTER COLUMN "type" TYPE "ActivityType_new" USING ("type"::text::"ActivityType_new");
ALTER TYPE "ActivityType" RENAME TO "ActivityType_old";
ALTER TYPE "ActivityType_new" RENAME TO "ActivityType";
DROP TYPE "public"."ActivityType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "VideoGeneration" DROP CONSTRAINT "VideoGeneration_cardId_fkey";

-- DropForeignKey
ALTER TABLE "VideoGeneration" DROP CONSTRAINT "VideoGeneration_createdById_fkey";

-- DropForeignKey
ALTER TABLE "VideoGeneration" DROP CONSTRAINT "VideoGeneration_storyboardId_fkey";

-- DropForeignKey
ALTER TABLE "VideoStoryboard" DROP CONSTRAINT "VideoStoryboard_cardId_fkey";

-- DropForeignKey
ALTER TABLE "VideoStoryboard" DROP CONSTRAINT "VideoStoryboard_createdById_fkey";

-- DropTable
DROP TABLE "VideoGeneration";

-- DropTable
DROP TABLE "VideoStoryboard";

-- DropEnum
DROP TYPE "StoryboardStatus";

-- DropEnum
DROP TYPE "VideoStatus";

