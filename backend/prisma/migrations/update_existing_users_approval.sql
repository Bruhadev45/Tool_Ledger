-- Migration to update existing users to APPROVED status
-- This ensures existing users in the database are not blocked after adding approval workflow

UPDATE "users" 
SET "approvalStatus" = 'APPROVED' 
WHERE "approvalStatus" IS NULL OR "approvalStatus" = 'PENDING_APPROVAL';
