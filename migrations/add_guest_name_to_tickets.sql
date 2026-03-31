-- Migration: Add guest_name column to tickets table
-- Purpose: Store guest names and anonymized deleted user names
-- Date: 2026-03-21

USE sahlalik_db;

-- Add guest_name column (nullable, for guests and deleted accounts)
ALTER TABLE tickets 
ADD COLUMN `guest_name` VARCHAR(150) DEFAULT NULL AFTER `id_client`;

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sahlalik_db' 
  AND TABLE_NAME = 'tickets' 
  AND COLUMN_NAME = 'guest_name';
