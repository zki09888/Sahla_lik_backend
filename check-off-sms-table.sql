-- Check if off_sms table exists and create if not
USE sahlalik_db;

-- Check if table exists
SELECT 'Checking off_sms table...' AS status;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS `off_sms` (
  `id_off_sms` INT PRIMARY KEY AUTO_INCREMENT,
  `id_client` INT NOT NULL UNIQUE,
  `phone_number` VARCHAR(20) NOT NULL,
  `is_actif` BOOLEAN DEFAULT TRUE,
  `date_creation` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `date_modification` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`id_client`) REFERENCES `clients`(`id_client`) ON DELETE CASCADE,
  INDEX `idx_id_client` (`id_client`),
  INDEX `idx_is_actif` (`is_actif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Show table structure
DESCRIBE off_sms;

-- Show existing records
SELECT * FROM off_sms;

SELECT 'Table check complete' AS status;
