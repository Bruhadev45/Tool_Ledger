# Seed Script Fix Summary

## Issue
The seed script is failing with:
```
Argument `resourceId` is missing.
```

The error shows credential audit log entries with `resourceId: undefined` that shouldn't exist in the current seed script.

## Root Cause
1. **Server has old seed script**: The deployed version may still have credential audit log entries
2. **Migration not applied**: The database migration to make `resourceId` optional may not have been run on the server
3. **Prisma client not regenerated**: The Prisma client on the server may not reflect the schema changes

## Current State (Local)
- ✅ Seed script only has invoice audit logs (no credential entries)
- ✅ Schema has `resourceId` as optional (`String?`)
- ✅ Migration file exists
- ✅ Prisma client regenerated locally

## Solution
The server needs:
1. **Latest seed script** (already pushed in commit `1e2da95`)
2. **Migration applied**: Run `npx prisma migrate deploy` on the server
3. **Prisma client regenerated**: Run `npx prisma generate` on the server

## Verification
The local seed script at line 652 only contains:
- 2 invoice audit log entries (UPLOAD and APPROVE)
- No credential audit log entries
- All entries have valid `resourceId` values

The error from the server shows credential entries that don't exist in the current codebase, confirming the server is running an outdated version.
