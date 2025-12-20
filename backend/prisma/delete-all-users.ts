/**
 * Delete All Users Script
 * 
 * WARNING: This script will permanently delete ALL users and their associated data.
 * This includes:
 * - All user accounts
 * - All credentials owned by users
 * - All invoices uploaded by users
 * - All comments made by users
 * - All notifications for users
 * - All audit logs
 * - All refresh tokens
 * 
 * This action CANNOT be undone!
 * 
 * Usage: npx ts-node prisma/delete-all-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllUsers() {
  console.log('⚠️  WARNING: This will delete ALL users and their data!');
  console.log('Press Ctrl+C within 5 seconds to cancel...\n');
  
  // Wait 5 seconds for user to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    console.log('🗑️  Starting deletion process...\n');
    
    // Count users before deletion
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} user(s) to delete\n`);
    
    if (userCount === 0) {
      console.log('✅ No users found. Nothing to delete.');
      return;
    }
    
    // Delete all refresh tokens first (they have foreign key to users)
    console.log('1. Deleting refresh tokens...');
    const refreshTokenCount = await prisma.refreshToken.deleteMany({});
    console.log(`   ✅ Deleted ${refreshTokenCount.count} refresh token(s)\n`);
    
    // Delete all credential shares (user-based shares)
    console.log('2. Deleting credential shares...');
    const shareCount = await prisma.credentialShare.deleteMany({});
    console.log(`   ✅ Deleted ${shareCount.count} credential share(s)\n`);
    
    // Delete all comments
    console.log('3. Deleting comments...');
    const commentCount = await prisma.comment.deleteMany({});
    console.log(`   ✅ Deleted ${commentCount.count} comment(s)\n`);
    
    // Delete all notifications
    console.log('4. Deleting notifications...');
    const notificationCount = await prisma.notification.deleteMany({});
    console.log(`   ✅ Deleted ${notificationCount.count} notification(s)\n`);
    
    // Delete all audit logs
    console.log('5. Deleting audit logs...');
    const auditLogCount = await prisma.auditLog.deleteMany({});
    console.log(`   ✅ Deleted ${auditLogCount.count} audit log(s)\n`);
    
    // Delete all credentials (cascade will handle owner relationships)
    console.log('6. Deleting credentials...');
    const credentialCount = await prisma.credential.deleteMany({});
    console.log(`   ✅ Deleted ${credentialCount.count} credential(s)\n`);
    
    // Delete all invoices (cascade will handle uploadedBy/approvedBy relationships)
    console.log('7. Deleting invoices...');
    const invoiceCount = await prisma.invoice.deleteMany({});
    console.log(`   ✅ Deleted ${invoiceCount.count} invoice(s)\n`);
    
    // Delete all team shares
    console.log('8. Deleting team credential shares...');
    const teamShareCount = await prisma.credentialTeamShare.deleteMany({});
    console.log(`   ✅ Deleted ${teamShareCount.count} team share(s)\n`);
    
    // Delete all teams (users will be removed from teams automatically)
    console.log('9. Deleting teams...');
    const teamCount = await prisma.team.deleteMany({});
    console.log(`   ✅ Deleted ${teamCount.count} team(s)\n`);
    
    // Finally, delete all users
    console.log('10. Deleting all users...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`   ✅ Deleted ${deletedUsers.count} user(s)\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All users and associated data have been deleted!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Note: Organizations are NOT deleted as they may be needed for future users
    
  } catch (error) {
    console.error('❌ Error deleting users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteAllUsers()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
