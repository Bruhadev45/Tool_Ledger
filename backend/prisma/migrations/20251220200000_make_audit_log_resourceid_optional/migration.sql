-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "resourceId" DROP NOT NULL;

-- AlterTable
-- Note: Changing metadata from String to Json type
-- This will convert existing JSON strings to proper JSON type
ALTER TABLE "audit_logs" ALTER COLUMN "metadata" TYPE JSONB USING metadata::jsonb;
