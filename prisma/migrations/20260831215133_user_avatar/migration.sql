-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarData" BYTEA,
ADD COLUMN     "avatarType" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3);
