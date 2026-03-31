-- ═══════════════════════════════════════════════════════════════════════════════
-- OFF SMS Table - Offline SMS Reminder Settings
-- ═══════════════════════════════════════════════════════════════════════════════

-- TABLE: off_sms (Client SMS reminder settings for offline queue updates)
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

SELECT '✅ off_sms table created successfully!' AS message;
