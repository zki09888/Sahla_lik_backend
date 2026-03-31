-- ═══════════════════════════════════════════════════════════════════════════════
-- SAHLA-LIK Database Triggers v2.0
-- Production-ready triggers for automatic data management
-- ═══════════════════════════════════════════════════════════════════════════════

USE sahlalik_db;

DELIMITER $$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 1: auto_increment_ticket_number
-- Automatically increments ticket number when new ticket is created
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `auto_increment_ticket_number`$$
CREATE TRIGGER `auto_increment_ticket_number`
BEFORE INSERT ON `tickets`
FOR EACH ROW
BEGIN
  DECLARE current_max INT DEFAULT 0;
  
  -- Get the current max ticket number for today's queue file
  SELECT COALESCE(MAX(numero_ticket), 0) INTO current_max
  FROM tickets
  WHERE id_file = NEW.id_file AND DATE(heure_prise) = CURDATE();
  
  -- Set new ticket number
  SET NEW.numero_ticket = current_max + 1;
END$$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 2: update_queue_count_on_ticket_create
-- Updates queue count when a new ticket is created
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `update_queue_count_on_ticket_create`$$
CREATE TRIGGER `update_queue_count_on_ticket_create`
AFTER INSERT ON `tickets`
FOR EACH ROW
BEGIN
  -- Increment waiting count in file_attente
  UPDATE files_attente
  SET nb_personnes_restantes = nb_personnes_restantes + 1
  WHERE id_file = NEW.id_file;
END$$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 3: update_queue_count_on_ticket_status
-- Updates queue count when ticket status changes (served, cancelled, etc.)
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `update_queue_count_on_ticket_status`$$
CREATE TRIGGER `update_queue_count_on_ticket_status`
AFTER UPDATE ON `tickets`
FOR EACH ROW
BEGIN
  -- If ticket was served or cancelled, decrement queue count
  IF (OLD.status = 'attente' AND NEW.status IN ('servi', 'annule')) OR
     (OLD.status = 'en_cours' AND NEW.status = 'servi') THEN
    UPDATE files_attente
    SET nb_personnes_restantes = GREATEST(nb_personnes_restantes - 1, 0)
    WHERE id_file = NEW.id_file;
  END IF;
END$$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 4: update_guichet_count
-- Updates active counter count in statistiques when guichet status changes
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `update_guichet_count`$$
CREATE TRIGGER `update_guichet_count`
AFTER UPDATE ON `guichets`
FOR EACH ROW
BEGIN
  DECLARE active_count INT;
  
  -- Count active guichets for this agency
  SELECT COUNT(*) INTO active_count
  FROM guichets
  WHERE id_agence = NEW.id_agence AND status = 'actif';
  
  -- Update statistiques
  UPDATE statistiques
  SET active_counters = active_count
  WHERE id_agence = NEW.id_agence AND date_stat = CURDATE();
END$$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 5: update_agency_rating
-- Updates agency rating when a new service rating is submitted
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `update_agency_rating`$$
CREATE TRIGGER `update_agency_rating`
AFTER INSERT ON `service_ratings`
FOR EACH ROW
BEGIN
  DECLARE avg_rating DECIMAL(3,2);
  DECLARE rating_count INT;
  DECLARE agency_id INT;
  
  -- Get agency ID from ticket
  SELECT id_agence INTO agency_id
  FROM tickets
  WHERE id_ticket = NEW.id_ticket;
  
  -- Calculate new average rating
  SELECT AVG(sr.rating), COUNT(*)
  INTO avg_rating, rating_count
  FROM service_ratings sr
  JOIN tickets t ON sr.id_ticket = t.id_ticket
  WHERE t.id_agence = agency_id;
  
  -- Update agency rating
  UPDATE agences
  SET rating = COALESCE(avg_rating, 0),
      nb_ratings = COALESCE(rating_count, 0)
  WHERE id_agence = agency_id;
END$$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 6: log_ticket_to_visit_history
-- Logs completed tickets to a visit history for analytics
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `log_ticket_to_visit_history`$$
CREATE TRIGGER `log_ticket_to_visit_history`
AFTER UPDATE ON `tickets`
FOR EACH ROW
BEGIN
  -- When ticket is marked as served, insert into visit log
  IF OLD.status = 'en_cours' AND NEW.status = 'servi' THEN
    INSERT INTO rapports (id_guichet, id_agence, date_rapport, nombre_clients, nombre_tickets, date_creation)
    VALUES (
      COALESCE(NEW.id_guichet, 1),
      NEW.id_agence,
      CURDATE(),
      1,
      1,
      NOW()
    )
    ON DUPLICATE KEY UPDATE
      nombre_clients = nombre_clients + 1,
      nombre_tickets = nombre_tickets + 1;
  END IF;
END$$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 7: auto_create_daily_stats
-- Automatically creates daily statistics entry for each agency at first ticket
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `auto_create_daily_stats`$$
CREATE TRIGGER `auto_create_daily_stats`
AFTER INSERT ON `tickets`
FOR EACH ROW
BEGIN
  DECLARE active_count INT;
  DECLARE queue_count INT;
  
  -- Count active guichets
  SELECT COUNT(*) INTO active_count
  FROM guichets
  WHERE id_agence = NEW.id_agence AND status = 'actif';
  
  -- Get current queue count
  SELECT COALESCE(SUM(nb_personnes_restantes), 0) INTO queue_count
  FROM files_attente
  WHERE id_agence = NEW.id_agence;
  
  -- Insert or ignore daily stats (will be updated by other triggers)
  INSERT IGNORE INTO statistiques 
    (id_agence, date_stat, total_tickets, active_counters, total_queue)
  VALUES 
    (NEW.id_agence, CURDATE(), 1, active_count, queue_count);
END$$

-- ───────────────────────────────────────────────────────────────────────────────
-- TRIGGER 8: update_ticket_stats_on_status
-- Updates statistics when ticket status changes
-- ───────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS `update_ticket_stats_on_status`$$
CREATE TRIGGER `update_ticket_stats_on_status`
AFTER UPDATE ON `tickets`
FOR EACH ROW
BEGIN
  -- Update daily statistics
  IF NEW.status = 'servi' AND OLD.status != 'servi' THEN
    UPDATE statistiques
    SET tickets_servis = tickets_servis + 1,
        total_tickets = total_tickets + 1
    WHERE id_agence = NEW.id_agence AND date_stat = CURDATE();
  END IF;
  
  IF NEW.status = 'annule' AND OLD.status != 'annule' THEN
    UPDATE statistiques
    SET tickets_annules = tickets_annules + 1,
        total_tickets = total_tickets + 1
    WHERE id_agence = NEW.id_agence AND date_stat = CURDATE();
  END IF;
END$$

DELIMITER ;

-- Verify triggers
SELECT '✅ Triggers created successfully!' AS message;
SELECT COUNT(*) AS trigger_count FROM information_schema.triggers WHERE trigger_schema = 'sahlalik_db';
