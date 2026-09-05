-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiKeyHint" TEXT,
ADD COLUMN     "aiKeySetAt" TIMESTAMP(3),
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiReasoningEffort" TEXT;
