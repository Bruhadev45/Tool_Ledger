/**
 * Delete All Data Script
 * 
 * WARNING: This script will permanently delete ALL data from the database.
 * This includes:
 * - All organizations
 * - All users
 * - All credentials
 * - All invoices
 * - All teams
 * - All comments
 * - All notifications
 * - All audit logs
 * - All refresh tokens
 * 
 * This action CANNOT be undone!
 * 
 * Usage: npx ts-node prisma/delete-all-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllData() {
  console.log('⚠️  WARNING: This will delete ALL data from the database!');
  console.log('Press Ctrl+C within 5 seconds to cancel...\n');
  
  // Wait 5 seconds for user to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    console.log('🗑️  Starting deletion process...\n');
    
    // Count data before deletion
    const initialOrgCount = await prisma.organization.count();
    const initialUserCount = await prisma.user.count();
    const initialCredentialCount = await prisma.credential.count();
    const initialInvoiceCount = await prisma.invoice.count();
    const initialTeamCount = await prisma.team.count();
    
    console.log('📊 Current data:');
    console.log(`   Organizations: ${initialOrgCount}`);
    console.log(`   Users: ${initialUserCount}`);
    console.log(`   Credentials: ${initialCredentialCount}`);
    console.log(`   Invoices: ${initialInvoiceCount}`);
    console.log(`   Teams: ${initialTeamCount}\n`);
    
    // Delete all refresh tokens first
    console.log('1. Deleting refresh tokens...');
    const refreshTokenCount = await prisma.refreshToken.deleteMany({});
    console.log(`   ✅ Deleted ${refreshTokenCount.count} refresh token(s)\n`);
    
    // Delete all credential shares (user-based shares)
    console.log('2. Deleting credential shares...');
    const shareCount = await prisma.credentialShare.deleteMany({});
    console.log(`   ✅ Deleted ${shareCount.count} credential share(s)\n`);
    
    // Delete all team credential shares
    console.log('3. Deleting team credential shares...');
    const teamShareCount = await prisma.credentialTeamShare.deleteMany({});
    console.log(`   ✅ Deleted ${teamShareCount.count} team share(s)\n`);
    
    // Delete all invoice credential links
    console.log('4. Deleting invoice credential links...');
    const invoiceLinkCount = await prisma.invoiceCredentialLink.deleteMany({});
    console.log(`   ✅ Deleted ${invoiceLinkCount.count} invoice credential link(s)\n`);
    
    // Delete all comments
    console.log('5. Deleting comments...');
    const commentCount = await prisma.comment.deleteMany({});
    console.log(`   ✅ Deleted ${commentCount.count} comment(s)\n`);
    
    // Delete all notifications
    console.log('6. Deleting notifications...');
    const notificationCount = await prisma.notification.deleteMany({});
    console.log(`   ✅ Deleted ${notificationCount.count} notification(s)\n`);
    
    // Delete all audit logs
    console.log('7. Deleting audit logs...');
    const auditLogCount = await prisma.auditLog.deleteMany({});
    console.log(`   ✅ Deleted ${auditLogCount.count} audit log(s)\n`);
    
    // Delete all credentials
    console.log('8. Deleting credentials...');
    const deletedCredentials = await prisma.credential.deleteMany({});
    console.log(`   ✅ Deleted ${deletedCredentials.count} credential(s)\n`);
    
    // Delete all invoices
    console.log('9. Deleting invoices...');
    const deletedInvoices = await prisma.invoice.deleteMany({});
    console.log(`   ✅ Deleted ${deletedInvoices.count} invoice(s)\n`);
    
    // Delete all teams
    console.log('10. Deleting teams...');
    const deletedTeams = await prisma.team.deleteMany({});
    console.log(`   ✅ Deleted ${deletedTeams.count} team(s)\n`);
    
    // Delete all users
    console.log('11. Deleting users...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`   ✅ Deleted ${deletedUsers.count} user(s)\n`);
    
    // Finally, delete all organizations
    console.log('12. Deleting organizations...');
    const deletedOrgs = await prisma.organization.deleteMany({});
    console.log(`   ✅ Deleted ${deletedOrgs.count} organization(s)\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All data has been deleted from the database!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 To recreate data, run: npx prisma db seed\n');
    
  } catch (error) {
    console.error('❌ Error deleting data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteAllData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
