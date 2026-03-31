-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Add Working Hours Columns to Agences
-- Date: 2026-03-21
-- Purpose: Remove default values and make working hours REQUIRED
-- ═══════════════════════════════════════════════════════════════════════════════

USE sahlalik_db;

-- Step 1: Add new columns if they don't exist (for older databases)
ALTER TABLE agences 
ADD COLUMN IF NOT EXISTS `heure_ouv_matin` TIME,
ADD COLUMN IF NOT EXISTS `heure_ferm_matin` TIME,
ADD COLUMN IF NOT EXISTS `heure_ouv_soir` TIME,
ADD COLUMN IF NOT EXISTS `heure_ferm_soir` TIME;

-- Step 2: Update existing agencies with default values (migration data)
-- This ensures existing agencies have valid working hours before making columns NOT NULL
UPDATE agences 
SET 
  `heure_ouv_matin` = COALESCE(`heure_ouv_matin`, '08:00:00'),
  `heure_ferm_matin` = COALESCE(`heure_ferm_matin`, '12:00:00'),
  `heure_ouv_soir` = COALESCE(`heure_ouv_soir`, '14:00:00'),
  `heure_ferm_soir` = COALESCE(`heure_ferm_soir`, '17:00:00'),
  `heure_pause_debut` = COALESCE(`heure_pause_debut`, '12:00:00'),
  `heure_pause_fin` = COALESCE(`heure_pause_fin`, '14:00:00'),
  `horaire_ouverture` = COALESCE(`horaire_ouverture`, '08:00:00'),
  `horaire_fermeture` = COALESCE(`horaire_fermeture`, '17:00:00')
WHERE 
  `heure_ouv_matin` IS NULL OR 
  `heure_ferm_matin` IS NULL OR 
  `heure_ouv_soir` IS NULL OR 
  `heure_ferm_soir` IS NULL;

-- Step 3: Modify columns to be NOT NULL (no defaults allowed)
ALTER TABLE agences 
MODIFY COLUMN `horaire_ouverture` TIME NOT NULL,
MODIFY COLUMN `horaire_fermeture` TIME NOT NULL,
MODIFY COLUMN `heure_pause_debut` TIME NOT NULL,
MODIFY COLUMN `heure_pause_fin` TIME NOT NULL,
MODIFY COLUMN `heure_ouv_matin` TIME NOT NULL,
MODIFY COLUMN `heure_ferm_matin` TIME NOT NULL,
MODIFY COLUMN `heure_ouv_soir` TIME NOT NULL,
MODIFY COLUMN `heure_ferm_soir` TIME NOT NULL;

-- Step 4: Verify the changes
SELECT 
  id_agence, 
  nom_agence,
  heure_ouv_matin,
  heure_ferm_matin,
  heure_ouv_soir,
  heure_ferm_soir,
  heure_pause_debut,
  heure_pause_fin,
  horaire_ouverture,
  horaire_fermeture
FROM agences;
