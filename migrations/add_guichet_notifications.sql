-- ═══════════════════════════════════════════════════════════════════════════════
-- SAHLA-LIK Database Migration - Add Guichet Notifications Support
-- Date: 2026-03-19
-- Purpose: Add id_guichet column to notifications table for guichet broadcasts
-- ═══════════════════════════════════════════════════════════════════════════════

USE sahlalik_db;

-- Add id_guichet column to notifications table
ALTER TABLE `notifications` 
ADD COLUMN `id_guichet` INT NULL AFTER `id_client`,
ADD FOREIGN KEY (`id_guichet`) REFERENCES `guichets`(`id_guichet`) ON DELETE CASCADE,
ADD INDEX `idx_id_guichet` (`id_guichet`);

-- Verify the change
SELECT '✅ id_guichet column added to notifications table' AS status;

-- Show table structure
DESCRIBE notifications;
