-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'MOVED', 'TITLE_CHANGED', 'ANGLE_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'SCRIPT_GENERATED', 'SCRIPT_IMPROVED', 'SCRIPT_EDITED', 'COMMENTED');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "detail" TEXT,
    "fromValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_cardId_createdAt_idx" ON "Activity"("cardId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "VideoCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
