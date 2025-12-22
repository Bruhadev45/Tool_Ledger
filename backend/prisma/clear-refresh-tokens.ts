/**
 * Clear Refresh Tokens Script
 * 
 * This script clears all refresh tokens from the database.
 * Use this when updating JWT secrets - old tokens will be invalid anyway.
 * 
 * After running this:
 * - All users will need to re-login
 * - Existing sessions will be invalidated
 * - New tokens will be generated with the new secrets
 * 
 * Usage: npx ts-node prisma/clear-refresh-tokens.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearRefreshTokens() {
  console.log('🔐 Clearing Refresh Tokens...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Count tokens before deletion
    const tokenCount = await prisma.refreshToken.count();
    console.log(`📊 Found ${tokenCount} refresh token(s) in database\n`);

    if (tokenCount === 0) {
      console.log('✅ No refresh tokens found. Nothing to clear.');
      return;
    }

    // Show some token info (for debugging)
    const sampleTokens = await prisma.refreshToken.findMany({
      take: 5,
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('📋 Sample tokens (last 5):');
    sampleTokens.forEach((token, index) => {
      console.log(`   ${index + 1}. User: ${token.user.email} (${token.user.role})`);
      console.log(`      Created: ${token.createdAt.toISOString()}`);
      console.log(`      Expires: ${token.expiresAt.toISOString()}`);
    });
    console.log('');

    // Delete all refresh tokens
    console.log('🗑️  Deleting all refresh tokens...');
    const result = await prisma.refreshToken.deleteMany({});
    
    console.log(`\n✅ Successfully deleted ${result.count} refresh token(s)`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  IMPORTANT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   • All users will need to re-login');
    console.log('   • Existing sessions are now invalid');
    console.log('   • New tokens will be generated with updated JWT secrets');
    console.log('   • Make sure you have updated JWT_SECRET and JWT_REFRESH_SECRET');
    console.log('   • Restart your backend server after updating secrets');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error clearing refresh tokens:', error);
    throw error;
  }
}

clearRefreshTokens()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

