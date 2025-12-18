-- AlterTable
ALTER TABLE "credentials" ADD COLUMN     "hasAutopay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false;
