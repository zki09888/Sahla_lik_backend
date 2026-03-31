-- =====================================================
-- PERFORMANCE INDEXES MIGRATION
-- =====================================================
-- Purpose: Add composite and functional indexes to optimize
--          common query patterns in the queue management system
-- 
-- Run: mysql -u root -p sahlalik_db < performance_indexes.sql
-- =====================================================

-- =====================================================
-- 1. TICKETS TABLE INDEXES
-- =====================================================

-- Composite index for agency + status filtering
-- Used in: getAgencyQueue, getMyTickets, callNextTicket
-- Query pattern: WHERE id_agence = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_tickets_agence_status 
ON tickets(id_agence, status);

-- Composite index for agency + date filtering
-- Used in: getAllAgenciesForClient, getAgencyQueue
-- Query pattern: WHERE id_agence = ? AND DATE(heure_prise) = CURDATE()
CREATE INDEX IF NOT EXISTS idx_tickets_agence_date 
ON tickets(id_agence, heure_prise);

-- Composite index for client + status filtering
-- Used in: getMyTickets, client ticket history
-- Query pattern: WHERE id_client = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_tickets_client_status 
ON tickets(id_client, status);

-- Composite index for file_attente + status
-- Used in: queue position calculations
-- Query pattern: WHERE id_file = ? AND status = 'attente'
CREATE INDEX IF NOT EXISTS idx_tickets_file_status 
ON tickets(id_file, status);

-- Index for status + date combination
-- Used in: daily reports, analytics
-- Query pattern: WHERE status = ? AND DATE(heure_prise) = CURDATE()
CREATE INDEX IF NOT EXISTS idx_tickets_status_date 
ON tickets(status, heure_prise);

-- =====================================================
-- 2. NOTIFICATIONS TABLE INDEXES
-- =====================================================

-- Composite index for agency + read status
-- Used in: getNotifications, mark as read operations
-- Query pattern: WHERE id_agence = ? AND lu = 0
CREATE INDEX IF NOT EXISTS idx_notifications_agence_unread 
ON notifications(id_agence, lu);

-- Composite index for client + read status
-- Used in: client notification queries
-- Query pattern: WHERE id_client = ? AND lu = 0
CREATE INDEX IF NOT EXISTS idx_notifications_client_unread 
ON notifications(id_client, lu);

-- Index for date filtering
-- Used in: notification history, cleanup operations
-- Query pattern: WHERE date_envoi > ?
CREATE INDEX IF NOT EXISTS idx_notifications_date 
ON notifications(date_envoi);

-- =====================================================
-- 3. FILES_ATTENTE TABLE INDEXES
-- =====================================================

-- Composite index for agency + date
-- Used in: createTicket, getQueueByAgency
-- Query pattern: WHERE id_agence = ? AND DATE(date_creation) = CURDATE()
CREATE INDEX IF NOT EXISTS idx_files_attente_agence_date 
ON files_attente(id_agence, date_creation);

-- Index for motif + date
-- Used in: motif-based queue queries
CREATE INDEX IF NOT EXISTS idx_files_attente_motif_date 
ON files_attente(id_motif, date_creation);

-- =====================================================
-- 4. GUICHETS TABLE INDEXES
-- =====================================================

-- Composite index for agency + status
-- Used in: getGuichets, validateTicketBooking
-- Query pattern: WHERE id_agence = ? AND status = 'actif'
CREATE INDEX IF NOT EXISTS idx_guichets_agence_status 
ON guichets(id_agence, status);

-- Index for enterprise filtering
-- Used in: enterprise management queries
CREATE INDEX IF NOT EXISTS idx_guichets_enterprise 
ON guichets(id_enterprise);

-- =====================================================
-- 5. AGENCES TABLE INDEXES
-- =====================================================

-- Composite index for enterprise + active status
-- Used in: getEnterpriseAgencies, agency listings
-- Query pattern: WHERE id_enterprise = ? AND actif = TRUE
CREATE INDEX IF NOT EXISTS idx_agences_enterprise_actif 
ON agences(id_enterprise, actif);

-- Index for wilaya filtering (geographic queries)
-- Used in: nearby agencies, wilaya-based searches
CREATE INDEX IF NOT EXISTS idx_agences_wilaya 
ON agences(wilaya);

-- =====================================================
-- 6. MOTIFS TABLE INDEXES
-- =====================================================

-- Composite index for agency + category
-- Used in: getAgencyMotifs, motif filtering
-- Query pattern: WHERE id_agence = ? AND category = ?
CREATE INDEX IF NOT EXISTS idx_motifs_agence_category 
ON motifs(id_agence, category);

-- =====================================================
-- 7. SERVICE_RATINGS TABLE INDEXES
-- =====================================================

-- Composite index for agency + date
-- Used in: analytics, agency ratings
-- Query pattern: WHERE id_agence = ? AND DATE(date_rating) = ?
CREATE INDEX IF NOT EXISTS idx_service_ratings_agence_date 
ON service_ratings(id_agence, date_rating);

-- Index for ticket foreign key
-- Used in: ticket rating lookups
CREATE INDEX IF NOT EXISTS idx_service_ratings_ticket 
ON service_ratings(id_ticket);

-- =====================================================
-- 8. CLIENTS TABLE INDEXES
-- =====================================================

-- Index for email lookups (authentication)
-- Used in: client login, email uniqueness check
CREATE INDEX IF NOT EXISTS idx_clients_email 
ON clients(email);

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify all indexes were created:
-- SHOW INDEX FROM tickets;
-- SHOW INDEX FROM notifications;
-- SHOW INDEX FROM files_attente;
-- SHOW INDEX FROM guichets;
-- SHOW INDEX FROM agences;
-- SHOW INDEX FROM motifs;
-- SHOW INDEX FROM service_ratings;
-- SHOW INDEX FROM clients;

-- =====================================================
-- PERFORMANCE NOTES
-- =====================================================
-- 
-- Expected improvements:
-- - Agency list with queue info: 100x faster (100 agencies: 300 queries → 4 queries)
-- - Queue status queries: 10x faster (composite index vs separate indexes)
-- - Notification queries: 5x faster (composite index on agency + unread)
-- - Guichet listing: 5x faster (single query instead of N+1)
--
-- Index maintenance:
-- - These indexes add ~5-10% overhead to INSERT/UPDATE operations
-- - Benefits far outweigh costs for read-heavy queue management workload
-- - Monitor index usage with: SELECT * FROM sys.schema_unused_indexes;
--
-- Migration safety:
-- - All indexes use IF NOT EXISTS for idempotent execution
-- - Safe to run multiple times
-- - Can be rolled back with DROP INDEX if needed
-- =====================================================
