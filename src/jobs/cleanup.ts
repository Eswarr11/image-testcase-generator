import cron from 'node-cron';
import authService from '../services/authService';

/**
 * Cleanup job that runs daily at 2 AM
 * - Removes expired sessions
 * - Removes inactive users (30+ days)
 */
export function startCleanupJob(): void {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Starting daily cleanup job...');
    
    try {
      // Clean up expired sessions
      const expiredSessions = await authService.cleanupExpiredSessions();
      console.log(`🗑️ Cleaned up ${expiredSessions} expired sessions`);
      
      // Clean up inactive users (30+ days)
      const inactiveUsers = await authService.cleanupInactiveUsers();
      console.log(`👋 Removed ${inactiveUsers} inactive users`);
      
      console.log('✅ Daily cleanup job completed');
    } catch (error) {
      console.error('❌ Cleanup job failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('⏰ Daily cleanup job scheduled (runs at 2:00 AM UTC)');
}

/**
 * Manual cleanup function for testing
 */
export async function runCleanupNow(): Promise<void> {
  console.log('🧹 Running manual cleanup...');
  
  try {
    const expiredSessions = await authService.cleanupExpiredSessions();
    const inactiveUsers = await authService.cleanupInactiveUsers();
    
    console.log(`✅ Manual cleanup completed: ${expiredSessions} sessions, ${inactiveUsers} users`);
  } catch (error) {
    console.error('❌ Manual cleanup failed:', error);
    throw error;
  }
}
