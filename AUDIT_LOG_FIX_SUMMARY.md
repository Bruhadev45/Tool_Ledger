# Audit Log Seeding Error Fix

## Problem
The database seeding was failing with a Prisma validation error:
```
PrismaClientValidationError: Invalid `prisma.auditLog.createMany()` invocation
Argument `resourceId` is missing.
```

The error occurred because audit logs were being created with `resourceId: undefined` for credential-related entries.

## Root Cause
1. **Previous seed file version**: An older version of the seed file was trying to create credential audit logs with `resourceId: credentials[0]?.id`
2. **Empty credentials array**: Since no dummy credentials were being created, `credentials[0]?.id` resulted in `undefined`
3. **Prisma validation**: When passing `undefined` explicitly in the data object, Prisma treats it as a missing required field, even though the schema marks it as optional

## Solution Applied

### 1. Removed Problematic Credential Audit Logs
- The credential audit logs were already removed in commit `1e2da95`
- Current seed file only creates invoice-related audit logs with valid `resourceId` values

### 2. Improved AuditLogService
Updated the `AuditLogService.create()` method to properly handle optional fields:
- Instead of passing `undefined` values explicitly, the service now omits undefined fields entirely
- This prevents Prisma validation errors for optional fields

### 3. Enhanced Seed File
- Added proper field handling for audit log creation
- Included `userAgent` field for better audit trail
- Ensured all audit logs have valid `resourceId` values

## Files Modified
- `backend/prisma/seed.ts` - Enhanced audit log creation
- `backend/src/audit-log/audit-log.service.ts` - Improved optional field handling

## Testing
- Seed command now runs successfully: `npm run prisma:seed`
- All audit logs are created with proper field validation
- No more Prisma validation errors

## Prevention
- The audit log service now properly handles optional fields
- Any future audit log creation will automatically handle undefined values correctly
- The seed file only creates audit logs for resources that actually exist

## CI/CD Impact
This fix should resolve the seeding error in the CI/CD pipeline. The latest code needs to be deployed to ensure the CI/CD environment uses the updated seed file and audit log service.