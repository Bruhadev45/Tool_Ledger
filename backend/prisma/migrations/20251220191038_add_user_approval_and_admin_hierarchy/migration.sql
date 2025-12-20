-- CreateEnum
CREATE TYPE "UserApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approvalStatus" "UserApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
ADD COLUMN     "assignedAdminId" TEXT;

-- CreateIndex
CREATE INDEX "users_assignedAdminId_idx" ON "users"("assignedAdminId");

-- CreateIndex
CREATE INDEX "users_approvalStatus_idx" ON "users"("approvalStatus");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
