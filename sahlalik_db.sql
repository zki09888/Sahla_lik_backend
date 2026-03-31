-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 22, 2026 at 08:36 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sahlalik_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `absence_logs`
--

CREATE TABLE `absence_logs` (
  `id_absence` int(11) NOT NULL,
  `id_guichet` int(11) NOT NULL,
  `date_debut` date NOT NULL,
  `date_fin` date NOT NULL,
  `raison` varchar(200) DEFAULT NULL,
  `guichet_remplacement` int(11) DEFAULT NULL,
  `statut` enum('planifie','en_cours','termine') DEFAULT 'planifie',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `agences`
--

CREATE TABLE `agences` (
  `id_agence` int(11) NOT NULL,
  `id_enterprise` int(11) NOT NULL,
  `nom_agence` varchar(150) NOT NULL,
  `adresse` text DEFAULT NULL,
  `wilaya` varchar(50) DEFAULT NULL,
  `commune` varchar(100) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `motpass` varchar(255) NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `status` enum('open','busy','closed') DEFAULT 'open',
  `rating` decimal(3,2) DEFAULT 0.00,
  `nb_ratings` int(11) DEFAULT 0,
  `horaire_ouverture` time DEFAULT '08:00:00',
  `horaire_fermeture` time DEFAULT '17:00:00',
  `heure_pause_debut` time DEFAULT '12:00:00',
  `heure_pause_fin` time DEFAULT '13:00:00',
  `heure_ouv_matin` time DEFAULT '08:00:00',
  `heure_ferm_matin` time DEFAULT '12:00:00',
  `heure_ouv_soir` time DEFAULT '14:00:00',
  `heure_ferm_soir` time DEFAULT '17:00:00',
  `actif` tinyint(1) DEFAULT 1,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `agences`
--

INSERT INTO `agences` (`id_agence`, `id_enterprise`, `nom_agence`, `adresse`, `wilaya`, `commune`, `email`, `motpass`, `latitude`, `longitude`, `status`, `rating`, `nb_ratings`, `horaire_ouverture`, `horaire_fermeture`, `heure_pause_debut`, `heure_pause_fin`, `heure_ouv_matin`, `heure_ferm_matin`, `heure_ouv_soir`, `heure_ferm_soir`, `actif`, `date_creation`) VALUES
(2, 2, 'Test Agency', '123 Main St', 'Algiers', 'Algiers', 'admin@test.com', '$2a$12$/84a9woDm8bWgIdmKzuQMOqRyW4RopH8YigoP5DURRCckMO/EFO1S', NULL, NULL, 'open', 0.00, 0, '08:00:00', '17:00:00', '12:00:00', '13:00:00', '08:00:00', '12:00:00', '14:00:00', '17:00:00', 1, '2026-03-19 19:25:00'),
(3, 3, 'alg - nj', 'JMP8+WX2, Sebdou', 'Blida', 'nj', 'zakaria9@gmail.com', '$2a$12$zdhesxYJ1lsxzrEHO8zioet91zE75nxwNyhB1Tj.WjgJc8fj3E.eG', NULL, NULL, 'open', 0.00, 0, '08:00:00', '17:00:00', '12:00:00', '13:00:00', '08:00:00', '12:00:00', '14:00:00', '17:00:00', 1, '2026-03-20 20:04:51'),
(5, 5, 'alg - zx', ',mz', 'Jijel', 'zx', 'zakaria8@gmail.com', '$2a$12$pRlwYoeZrB3W3d1BHaubsukT4kgEy.SVqXJG3q02Bpq1AmqkgipxK', NULL, NULL, 'open', 0.00, 0, '08:00:00', '23:00:00', '13:00:00', '14:00:00', '08:00:00', '13:00:00', '14:00:00', '23:00:00', 1, '2026-03-21 17:50:29'),
(7, 7, 'SXA - m', 'mm,', 'Tiaret', 'm', 'zakaria7@gmail.com', '$2a$12$u0CGYDsXSQqzbH/y0NzYaODhDt65eyZekjwQlmgL4mS3XxFCEsnc2', NULL, NULL, 'open', 0.00, 0, '08:00:00', '23:30:00', '12:00:00', '13:00:00', '08:00:00', '12:00:00', '13:00:00', '23:30:00', 1, '2026-03-22 17:57:03');

-- --------------------------------------------------------

--
-- Table structure for table `app_ratings`
--

CREATE TABLE `app_ratings` (
  `id_app_rating` int(11) NOT NULL,
  `id_client` int(11) NOT NULL,
  `rating` int(11) NOT NULL,
  `commentaire` text DEFAULT NULL,
  `nombre_tickets_avant_eval` int(11) DEFAULT 2,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Table structure for table `broadcasts`
--

CREATE TABLE `broadcasts` (
  `id_broadcast` int(11) NOT NULL,
  `id_agence` int(11) NOT NULL,
  `titre` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `type_broadcast` varchar(50) DEFAULT 'PUSH',
  `statut` enum('planifie','en_cours','envoye','annule') DEFAULT 'planifie',
  `date_envoi` datetime DEFAULT NULL,
  `nombre_destinataires` int(11) DEFAULT 0,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `broadcasts`
--

INSERT INTO `broadcasts` (`id_broadcast`, `id_agence`, `titre`, `message`, `type_broadcast`, `statut`, `date_envoi`, `nombre_destinataires`, `date_creation`) VALUES
(9, 3, 'URGENT', 'Shift change at 13:00.', 'all', 'envoye', NULL, 1, '2026-03-21 13:42:45'),
(10, 3, 'INFO', 'Counter overload — pause and redirect.', 'all', 'envoye', NULL, 1, '2026-03-21 13:43:04'),
(11, 5, 'URGENT', 'Counter overload — pause and redirect.', 'paused', 'envoye', NULL, 2, '2026-03-22 17:33:00');

-- --------------------------------------------------------

--
-- Table structure for table `clients`
--

CREATE TABLE `clients` (
  `id_client` int(11) NOT NULL,
  `nom_complete` varchar(150) NOT NULL,
  `email` varchar(100) NOT NULL,
  `motpass` varchar(255) NOT NULL,
  `date_premiere_visite` timestamp NOT NULL DEFAULT current_timestamp(),
  `nombre_tickets` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `clients`
--

INSERT INTO `clients` (`id_client`, `nom_complete`, `email`, `motpass`, `date_premiere_visite`, `nombre_tickets`) VALUES
(1, 'Test', 'test@test.com', '$2a$12$8fMtmuaqvomE1Zgxcs3Qr.RC1U9JxcbJ4Nq9avVlyofx34NecN0J6', '2026-03-20 17:04:14', 0),
(3, 'Imane Lklba', 'z@gmail.com', '$2a$12$GfJNWMEtFiDblZ9cuC6rBuo3BOlgiSufiKmkpjhEb9HYvdA2H81Su', '2026-03-22 17:21:45', 4);

-- --------------------------------------------------------

--
-- Table structure for table `enterprises`
--

CREATE TABLE `enterprises` (
  `id_enterprise` int(11) NOT NULL,
  `nom_entreprise` varchar(150) NOT NULL,
  `category` varchar(100) NOT NULL,
  `actif` tinyint(1) DEFAULT 1,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enterprises`
--

INSERT INTO `enterprises` (`id_enterprise`, `nom_entreprise`, `category`, `actif`, `date_creation`) VALUES
(1, 'alg', 'Internet & Fibre optique', 1, '2026-03-19 19:18:39'),
(2, 'Test Corp', 'General', 1, '2026-03-19 19:25:00'),
(3, 'alg', 'Internet & Fibre optique', 1, '2026-03-20 20:04:51'),
(5, 'alg', 'Internet & Fibre optique', 1, '2026-03-21 17:50:29'),
(6, 'alg', 'Internet & Fibre optique', 1, '2026-03-22 17:55:01'),
(7, 'SXA', 'Internet & Fibre optique', 1, '2026-03-22 17:57:03');

-- --------------------------------------------------------

--
-- Table structure for table `files_attente`
--

CREATE TABLE `files_attente` (
  `id_file` int(11) NOT NULL,
  `id_agence` int(11) NOT NULL,
  `id_guichet` int(11) DEFAULT NULL,
  `id_motif` int(11) DEFAULT NULL,
  `numero_ticket` int(11) NOT NULL DEFAULT 0,
  `nb_personnes_restantes` int(11) DEFAULT 0,
  `temps_attente_estime` int(11) DEFAULT NULL,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `files_attente`
--

INSERT INTO `files_attente` (`id_file`, `id_agence`, `id_guichet`, `id_motif`, `numero_ticket`, `nb_personnes_restantes`, `temps_attente_estime`, `date_creation`) VALUES
(26, 5, NULL, 9, 9, 0, NULL, '2026-03-21 20:01:09'),
(27, 5, NULL, 9, 6, 0, NULL, '2026-03-22 17:21:58');

-- --------------------------------------------------------

--
-- Table structure for table `guichets`
--

CREATE TABLE `guichets` (
  `id_guichet` int(11) NOT NULL,
  `id_enterprise` int(11) NOT NULL,
  `id_agence` int(11) NOT NULL,
  `nom` varchar(150) NOT NULL,
  `email` varchar(100) NOT NULL,
  `motpass` varchar(255) NOT NULL,
  `category_guichet` varchar(100) DEFAULT NULL,
  `status` enum('actif','pause','hors_service') DEFAULT 'actif',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `guichets`
--

INSERT INTO `guichets` (`id_guichet`, `id_enterprise`, `id_agence`, `nom`, `email`, `motpass`, `category_guichet`, `status`, `date_creation`) VALUES
(1, 2, 2, 'Guichet 1', 'guichet1@test.com', '$2a$12$uIKJyTcAzrzx/RB3L0jBherRArptQJAFq7Sx.DTjwQNyTU9ve4s4C', 'General', 'actif', '2026-03-19 19:35:23'),
(2, 2, 2, 'Guichet 2', 'guichet2@test.com', '$2a$12$K90lNY0kqUCP7jo.0xii/ue5F4sJFiKhObH4yXETbxkpJoIXmih3e', 'Payments', 'actif', '2026-03-19 19:40:06'),
(8, 3, 3, 'Counter 1', 'z@gmail.com', '$2a$12$qwEqdaaYQQlP/6Zgx7tEW.6kFczRcRi7eV3KUHf9UfrudO5BgHpLm', 'Registration', 'actif', '2026-03-20 20:05:21'),
(16, 5, 5, 'Counter 1', 'y@gmail.com', '$2a$12$7pRJVo3H/Z1cwqDofnq1M.MqfUKsJzezJlLqxfQ4k2znc6K.foRLe', 'Registration', 'actif', '2026-03-21 21:38:57');

--
-- Triggers `guichets`
--
DELIMITER $$
CREATE TRIGGER `after_guichet_update` AFTER UPDATE ON `guichets` FOR EACH ROW BEGIN
  DECLARE active_count INT;
  SELECT COUNT(*) INTO active_count FROM guichets
  WHERE id_agence = NEW.id_agence AND status = 'actif';
  UPDATE statistiques SET active_counters = active_count
  WHERE id_agence = NEW.id_agence AND date_stat = CURDATE();
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `motifs`
--

CREATE TABLE `motifs` (
  `id_motif` int(11) NOT NULL,
  `id_agence` int(11) NOT NULL,
  `nom_motif` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `temps_moyen_service` int(11) DEFAULT 15,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `motifs`
--

INSERT INTO `motifs` (`id_motif`, `id_agence`, `nom_motif`, `description`, `temps_moyen_service`, `date_creation`) VALUES
(1, 2, 'Accueil & Information', 'Service: Accueil & Information', 5, '2026-03-21 19:36:48'),
(2, 2, 'Service Général', 'Service: Service Général', 5, '2026-03-21 19:36:48'),
(3, 2, 'Renseignements', 'Service: Renseignements', 5, '2026-03-21 19:36:48'),
(4, 2, 'Traitement de dossiers', 'Service: Traitement de dossiers', 5, '2026-03-21 19:36:48'),
(5, 3, 'Accueil & Information', 'Service: Accueil & Information', 5, '2026-03-21 19:36:48'),
(6, 3, 'Service Général', 'Service: Service Général', 5, '2026-03-21 19:36:48'),
(7, 3, 'Renseignements', 'Service: Renseignements', 5, '2026-03-21 19:36:48'),
(8, 3, 'Traitement de dossiers', 'Service: Traitement de dossiers', 5, '2026-03-21 19:36:48'),
(9, 5, 'Accueil & Information', 'Service: Accueil & Information', 5, '2026-03-21 19:36:48'),
(10, 5, 'Service Général', 'Service: Service Général', 5, '2026-03-21 19:36:48'),
(11, 5, 'Renseignements', 'Service: Renseignements', 5, '2026-03-21 19:36:48'),
(12, 5, 'Traitement de dossiers', 'Service: Traitement de dossiers', 5, '2026-03-21 19:36:48');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id_notif` int(11) NOT NULL,
  `id_agence` int(11) NOT NULL,
  `id_client` int(11) DEFAULT NULL,
  `type_notif` varchar(50) NOT NULL,
  `titre` varchar(200) DEFAULT NULL,
  `message` text NOT NULL,
  `lu` tinyint(1) DEFAULT 0,
  `date_envoi` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_lecture` datetime DEFAULT NULL,
  `id_guichet` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id_notif`, `id_agence`, `id_client`, `type_notif`, `titre`, `message`, `lu`, `date_envoi`, `date_lecture`, `id_guichet`) VALUES
(7, 3, NULL, 'all', 'URGENT', 'Shift change at 13:00.', 0, '2026-03-21 13:42:45', NULL, 8),
(8, 3, NULL, 'all', 'INFO', 'Counter overload — pause and redirect.', 0, '2026-03-21 13:43:04', NULL, 8),
(9, 5, 3, 'paused', 'URGENT', 'Counter overload — pause and redirect.', 0, '2026-03-22 17:33:00', NULL, NULL),
(10, 5, NULL, 'paused', 'URGENT', 'Counter overload — pause and redirect.', 0, '2026-03-22 17:33:00', NULL, 16);

-- --------------------------------------------------------

--
-- Table structure for table `off_sms`
--

CREATE TABLE `off_sms` (
  `id` int(11) NOT NULL,
  `id_client` int(11) NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `is_actif` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `otp_codes`
--

CREATE TABLE `otp_codes` (
  `id_otp` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `otp_code` varchar(10) NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_expires` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rapports`
--

CREATE TABLE `rapports` (
  `id_rapport` int(11) NOT NULL,
  `id_guichet` int(11) NOT NULL,
  `id_agence` int(11) NOT NULL,
  `date_rapport` date NOT NULL,
  `nombre_clients` int(11) DEFAULT 0,
  `nombre_tickets` int(11) DEFAULT 0,
  `temps_moyen_service` int(11) DEFAULT NULL,
  `observations` text DEFAULT NULL,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `rapports`
--

INSERT INTO `rapports` (`id_rapport`, `id_guichet`, `id_agence`, `date_rapport`, `nombre_clients`, `nombre_tickets`, `temps_moyen_service`, `observations`, `date_creation`) VALUES
(10, 8, 3, '2026-03-20', 0, 0, NULL, 'hi', '2026-03-20 20:06:17'),
(11, 8, 3, '2026-03-21', 0, 0, NULL, 'hi admin', '2026-03-21 11:30:21'),
(12, 8, 3, '2026-03-21', 0, 0, NULL, 'hi admin', '2026-03-21 11:51:38'),
(13, 8, 3, '2026-03-21', 0, 0, NULL, 'hi', '2026-03-21 12:52:05'),
(14, 8, 3, '2026-03-21', 0, 0, NULL, 'hid', '2026-03-21 13:42:32'),
(16, 16, 5, '2026-03-21', 0, 0, NULL, 'hi admin 88', '2026-03-21 21:40:03'),
(17, 16, 5, '2026-03-22', 0, 0, NULL, 'hi admin', '2026-03-22 17:32:21');

-- --------------------------------------------------------

--
-- Table structure for table `service_ratings`
--

CREATE TABLE `service_ratings` (
  `id_rating` int(11) NOT NULL,
  `id_ticket` int(11) NOT NULL,
  `id_guichet` int(11) DEFAULT NULL,
  `rating` int(11) NOT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `commentaire` text DEFAULT NULL,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `service_ratings`
--
DELIMITER $$
CREATE TRIGGER `after_rating_insert` AFTER INSERT ON `service_ratings` FOR EACH ROW BEGIN
  DECLARE avg_rating DECIMAL(3,2);
  DECLARE rating_count INT;
  DECLARE agency_id INT;
  SELECT id_agence INTO agency_id FROM tickets WHERE id_ticket = NEW.id_ticket;
  SELECT AVG(sr.rating), COUNT(*) INTO avg_rating, rating_count
  FROM service_ratings sr 
  JOIN tickets t ON sr.id_ticket = t.id_ticket
  WHERE t.id_agence = agency_id;
  UPDATE agences SET rating = COALESCE(avg_rating, 0), nb_ratings = COALESCE(rating_count, 0)
  WHERE id_agence = agency_id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `statistiques`
--

CREATE TABLE `statistiques` (
  `id_stat` int(11) NOT NULL,
  `id_agence` int(11) NOT NULL,
  `date_stat` date NOT NULL,
  `total_clients` int(11) DEFAULT 0,
  `total_tickets` int(11) DEFAULT 0,
  `tickets_servis` int(11) DEFAULT 0,
  `tickets_annules` int(11) DEFAULT 0,
  `temps_moyen_attente` int(11) DEFAULT NULL,
  `temps_moyen_service` int(11) DEFAULT NULL,
  `taux_satisfaction` decimal(5,2) DEFAULT NULL,
  `active_counters` int(11) DEFAULT 0,
  `total_queue` int(11) DEFAULT 0,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `statistiques`
--

INSERT INTO `statistiques` (`id_stat`, `id_agence`, `date_stat`, `total_clients`, `total_tickets`, `tickets_servis`, `tickets_annules`, `temps_moyen_attente`, `temps_moyen_service`, `taux_satisfaction`, `active_counters`, `total_queue`, `date_creation`) VALUES
(2, 2, '2026-03-19', 0, 0, 0, 0, NULL, NULL, NULL, 2, 0, '2026-03-19 19:25:00'),
(3, 3, '2026-03-20', 0, 0, 0, 0, NULL, NULL, NULL, 0, 0, '2026-03-20 20:04:51'),
(4, 3, '2026-03-21', 0, 1, 6, 1, NULL, NULL, NULL, 1, 0, '2026-03-21 16:07:51'),
(12, 5, '2026-03-21', 0, 0, 9, 4, NULL, NULL, NULL, 1, 0, '2026-03-21 17:50:29'),
(28, 5, '2026-03-22', 0, 1, 6, 0, NULL, NULL, NULL, 1, 0, '2026-03-22 17:21:58'),
(35, 7, '2026-03-22', 0, 0, 0, 0, NULL, NULL, NULL, 0, 0, '2026-03-22 17:57:03');

-- --------------------------------------------------------

--
-- Table structure for table `tickets`
--

CREATE TABLE `tickets` (
  `id_ticket` int(11) NOT NULL,
  `id_client` int(11) DEFAULT NULL,
  `guest_name` varchar(150) DEFAULT NULL,
  `id_agence` int(11) NOT NULL,
  `id_motif` int(11) DEFAULT NULL,
  `id_file` int(11) DEFAULT NULL,
  `id_guichet` int(11) DEFAULT NULL,
  `numero_ticket` int(11) NOT NULL,
  `status` enum('attente','en_cours','termine','annule','reporte') DEFAULT 'attente',
  `heure_prise` timestamp NOT NULL DEFAULT current_timestamp(),
  `heure_appel` datetime DEFAULT NULL,
  `heure_service` datetime DEFAULT NULL,
  `temps_attente` int(11) DEFAULT NULL,
  `temps_attente_estime` int(11) DEFAULT NULL,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tickets`
--

INSERT INTO `tickets` (`id_ticket`, `id_client`, `guest_name`, `id_agence`, `id_motif`, `id_file`, `id_guichet`, `numero_ticket`, `status`, `heure_prise`, `heure_appel`, `heure_service`, `temps_attente`, `temps_attente_estime`, `date_creation`) VALUES
(14, NULL, NULL, 5, 9, 26, NULL, 1, 'annule', '2026-03-21 20:01:09', NULL, NULL, NULL, 0, '2026-03-21 20:01:09'),
(15, NULL, NULL, 5, 9, 26, NULL, 2, 'termine', '2026-03-21 20:01:39', '2026-03-21 21:11:02', '2026-03-21 21:11:08', 9, 0, '2026-03-21 20:01:39'),
(16, NULL, NULL, 5, 9, 26, NULL, 3, 'termine', '2026-03-21 20:13:05', '2026-03-21 21:41:58', '2026-03-21 21:42:00', 28, 0, '2026-03-21 20:13:05'),
(17, NULL, NULL, 5, 9, 26, NULL, 4, 'termine', '2026-03-21 20:45:36', '2026-03-21 21:45:52', '2026-03-21 21:46:00', 0, 0, '2026-03-21 20:45:36'),
(18, NULL, NULL, 5, 9, 26, 16, 5, 'termine', '2026-03-21 22:00:52', '2026-03-21 23:01:05', '2026-03-21 23:01:15', 0, 0, '2026-03-21 22:00:52'),
(19, NULL, NULL, 5, 9, 26, 16, 6, 'termine', '2026-03-21 22:26:26', '2026-03-21 23:26:42', '2026-03-21 23:26:49', 0, 0, '2026-03-21 22:26:26'),
(20, NULL, NULL, 5, 9, 26, NULL, 7, 'annule', '2026-03-21 22:27:56', NULL, NULL, NULL, 0, '2026-03-21 22:27:56'),
(21, NULL, NULL, 5, 9, 26, 16, 8, 'termine', '2026-03-21 22:28:33', '2026-03-21 23:28:44', '2026-03-21 23:29:08', 0, 0, '2026-03-21 22:28:33'),
(22, NULL, NULL, 5, 9, 26, NULL, 9, 'annule', '2026-03-21 22:56:54', NULL, NULL, NULL, 0, '2026-03-21 22:56:54'),
(23, 3, NULL, 5, 9, 27, 16, 1, 'termine', '2026-03-22 17:21:58', '2026-03-22 18:22:28', '2026-03-22 18:22:46', 0, 0, '2026-03-22 17:21:58'),
(24, 3, NULL, 5, 9, 27, 16, 2, 'termine', '2026-03-22 17:23:28', '2026-03-22 18:24:22', '2026-03-22 18:24:35', 1, 0, '2026-03-22 17:23:28'),
(25, NULL, NULL, 5, 9, 27, 16, 3, 'termine', '2026-03-22 17:24:09', '2026-03-22 18:24:45', '2026-03-22 18:25:16', 1, 5, '2026-03-22 17:24:09'),
(26, 3, NULL, 5, 9, 27, 16, 4, 'termine', '2026-03-22 17:27:10', '2026-03-22 18:27:42', '2026-03-22 18:27:49', 0, 0, '2026-03-22 17:27:10'),
(27, 3, NULL, 5, 9, 27, 16, 5, 'termine', '2026-03-22 17:28:26', '2026-03-22 18:29:04', '2026-03-22 18:29:06', 0, 0, '2026-03-22 17:28:26'),
(28, NULL, NULL, 5, 9, 27, 16, 6, 'termine', '2026-03-22 17:38:44', '2026-03-22 18:39:32', '2026-03-22 18:39:43', 0, 0, '2026-03-22 17:38:44');

--
-- Triggers `tickets`
--
DELIMITER $$
CREATE TRIGGER `after_first_ticket` AFTER INSERT ON `tickets` FOR EACH ROW BEGIN
  DECLARE active_count INT;
  SELECT COUNT(*) INTO active_count FROM guichets
  WHERE id_agence = NEW.id_agence AND status = 'actif';
  INSERT IGNORE INTO statistiques (id_agence, date_stat, total_tickets, active_counters)
  VALUES (NEW.id_agence, CURDATE(), 1, active_count);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_ticket_insert` AFTER INSERT ON `tickets` FOR EACH ROW BEGIN
  UPDATE files_attente 
  SET nb_personnes_restantes = nb_personnes_restantes + 1
  WHERE id_file = NEW.id_file;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_ticket_served` AFTER UPDATE ON `tickets` FOR EACH ROW BEGIN
  IF NEW.status = 'termine' AND OLD.status != 'termine' THEN
    UPDATE statistiques SET tickets_servis = tickets_servis + 1
    WHERE id_agence = NEW.id_agence AND date_stat = CURDATE();
  END IF;
  IF NEW.status = 'annule' AND OLD.status != 'annule' THEN
    UPDATE statistiques SET tickets_annules = tickets_annules + 1
    WHERE id_agence = NEW.id_agence AND date_stat = CURDATE();
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_ticket_update` AFTER UPDATE ON `tickets` FOR EACH ROW BEGIN
  IF (OLD.status = 'attente' AND NEW.status IN ('termine', 'annule')) OR
     (OLD.status = 'en_cours' AND NEW.status = 'termine') THEN
    UPDATE files_attente
    SET nb_personnes_restantes = GREATEST(nb_personnes_restantes - 1, 0)
    WHERE id_file = NEW.id_file;
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `before_ticket_insert` BEFORE INSERT ON `tickets` FOR EACH ROW BEGIN
  DECLARE current_max INT DEFAULT 0;
  SELECT COALESCE(MAX(numero_ticket), 0) INTO current_max
  FROM tickets 
  WHERE id_file = NEW.id_file 
    AND DATE(heure_prise) = CURDATE();
  SET NEW.numero_ticket = current_max + 1;
END
$$
DELIMITER ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `absence_logs`
--
ALTER TABLE `absence_logs`
  ADD PRIMARY KEY (`id_absence`),
  ADD KEY `guichet_remplacement` (`guichet_remplacement`),
  ADD KEY `idx_id_guichet` (`id_guichet`),
  ADD KEY `idx_statut` (`statut`);

--
-- Indexes for table `agences`
--
ALTER TABLE `agences`
  ADD PRIMARY KEY (`id_agence`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_id_enterprise` (`id_enterprise`),
  ADD KEY `idx_wilaya` (`wilaya`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_coordinates` (`latitude`,`longitude`);

--
-- Indexes for table `app_ratings`
--
ALTER TABLE `app_ratings`
  ADD PRIMARY KEY (`id_app_rating`),
  ADD KEY `idx_id_client` (`id_client`),
  ADD KEY `idx_rating` (`rating`);

--
-- Indexes for table `broadcasts`
--
ALTER TABLE `broadcasts`
  ADD PRIMARY KEY (`id_broadcast`),
  ADD KEY `idx_id_agence` (`id_agence`),
  ADD KEY `idx_statut` (`statut`);

--
-- Indexes for table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id_client`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`);

--
-- Indexes for table `enterprises`
--
ALTER TABLE `enterprises`
  ADD PRIMARY KEY (`id_enterprise`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_actif` (`actif`);

--
-- Indexes for table `files_attente`
--
ALTER TABLE `files_attente`
  ADD PRIMARY KEY (`id_file`),
  ADD KEY `id_guichet` (`id_guichet`),
  ADD KEY `id_motif` (`id_motif`),
  ADD KEY `idx_id_agence` (`id_agence`),
  ADD KEY `idx_numero_ticket` (`numero_ticket`);

--
-- Indexes for table `guichets`
--
ALTER TABLE `guichets`
  ADD PRIMARY KEY (`id_guichet`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_id_enterprise` (`id_enterprise`),
  ADD KEY `idx_id_agence` (`id_agence`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_email` (`email`);

--
-- Indexes for table `motifs`
--
ALTER TABLE `motifs`
  ADD PRIMARY KEY (`id_motif`),
  ADD KEY `idx_id_agence` (`id_agence`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id_notif`),
  ADD KEY `idx_id_agence` (`id_agence`),
  ADD KEY `idx_id_client` (`id_client`),
  ADD KEY `idx_lu` (`lu`),
  ADD KEY `fk_notifications_guichet` (`id_guichet`);

--
-- Indexes for table `off_sms`
--
ALTER TABLE `off_sms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_client` (`id_client`);

--
-- Indexes for table `otp_codes`
--
ALTER TABLE `otp_codes`
  ADD PRIMARY KEY (`id_otp`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_otp_code` (`otp_code`);

--
-- Indexes for table `rapports`
--
ALTER TABLE `rapports`
  ADD PRIMARY KEY (`id_rapport`),
  ADD KEY `idx_id_guichet` (`id_guichet`),
  ADD KEY `idx_id_agence` (`id_agence`),
  ADD KEY `idx_date_rapport` (`date_rapport`);

--
-- Indexes for table `service_ratings`
--
ALTER TABLE `service_ratings`
  ADD PRIMARY KEY (`id_rating`),
  ADD KEY `id_guichet` (`id_guichet`),
  ADD KEY `idx_id_ticket` (`id_ticket`),
  ADD KEY `idx_rating` (`rating`);

--
-- Indexes for table `statistiques`
--
ALTER TABLE `statistiques`
  ADD PRIMARY KEY (`id_stat`),
  ADD UNIQUE KEY `unique_stat` (`id_agence`,`date_stat`),
  ADD KEY `idx_id_agence` (`id_agence`),
  ADD KEY `idx_date_stat` (`date_stat`);

--
-- Indexes for table `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`id_ticket`),
  ADD KEY `id_motif` (`id_motif`),
  ADD KEY `id_file` (`id_file`),
  ADD KEY `id_guichet` (`id_guichet`),
  ADD KEY `idx_id_client` (`id_client`),
  ADD KEY `idx_id_agence` (`id_agence`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_numero_ticket` (`numero_ticket`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `absence_logs`
--
ALTER TABLE `absence_logs`
  MODIFY `id_absence` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `agences`
--
ALTER TABLE `agences`
  MODIFY `id_agence` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `app_ratings`
--
ALTER TABLE `app_ratings`
  MODIFY `id_app_rating` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `broadcasts`
--
ALTER TABLE `broadcasts`
  MODIFY `id_broadcast` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `clients`
--
ALTER TABLE `clients`
  MODIFY `id_client` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `enterprises`
--
ALTER TABLE `enterprises`
  MODIFY `id_enterprise` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `files_attente`
--
ALTER TABLE `files_attente`
  MODIFY `id_file` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `guichets`
--
ALTER TABLE `guichets`
  MODIFY `id_guichet` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `motifs`
--
ALTER TABLE `motifs`
  MODIFY `id_motif` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id_notif` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `off_sms`
--
ALTER TABLE `off_sms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `otp_codes`
--
ALTER TABLE `otp_codes`
  MODIFY `id_otp` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rapports`
--
ALTER TABLE `rapports`
  MODIFY `id_rapport` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `service_ratings`
--
ALTER TABLE `service_ratings`
  MODIFY `id_rating` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `statistiques`
--
ALTER TABLE `statistiques`
  MODIFY `id_stat` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- AUTO_INCREMENT for table `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id_ticket` int(11) NOT NULL AUTO_INCREMENT, ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `absence_logs`
--
ALTER TABLE `absence_logs`
  ADD CONSTRAINT `absence_logs_ibfk_1` FOREIGN KEY (`id_guichet`) REFERENCES `guichets` (`id_guichet`) ON DELETE CASCADE,
  ADD CONSTRAINT `absence_logs_ibfk_2` FOREIGN KEY (`guichet_remplacement`) REFERENCES `guichets` (`id_guichet`) ON DELETE SET NULL;

--
-- Constraints for table `agences`
--
ALTER TABLE `agences`
  ADD CONSTRAINT `agences_ibfk_1` FOREIGN KEY (`id_enterprise`) REFERENCES `enterprises` (`id_enterprise`) ON DELETE CASCADE;

--
-- Constraints for table `app_ratings`
--
ALTER TABLE `app_ratings`
  ADD CONSTRAINT `app_ratings_ibfk_1` FOREIGN KEY (`id_client`) REFERENCES `clients` (`id_client`) ON DELETE CASCADE;

--
-- Constraints for table `broadcasts`
--
ALTER TABLE `broadcasts`
  ADD CONSTRAINT `broadcasts_ibfk_1` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE;

--
-- Constraints for table `files_attente`
--
ALTER TABLE `files_attente`
  ADD CONSTRAINT `files_attente_ibfk_1` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE,
  ADD CONSTRAINT `files_attente_ibfk_2` FOREIGN KEY (`id_guichet`) REFERENCES `guichets` (`id_guichet`) ON DELETE SET NULL,
  ADD CONSTRAINT `files_attente_ibfk_3` FOREIGN KEY (`id_motif`) REFERENCES `motifs` (`id_motif`) ON DELETE SET NULL;

--
-- Constraints for table `guichets`
--
ALTER TABLE `guichets`
  ADD CONSTRAINT `guichets_ibfk_1` FOREIGN KEY (`id_enterprise`) REFERENCES `enterprises` (`id_enterprise`) ON DELETE CASCADE,
  ADD CONSTRAINT `guichets_ibfk_2` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE;

--
-- Constraints for table `motifs`
--
ALTER TABLE `motifs`
  ADD CONSTRAINT `motifs_ibfk_1` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_guichet` FOREIGN KEY (`id_guichet`) REFERENCES `guichets` (`id_guichet`) ON DELETE SET NULL,
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`id_client`) REFERENCES `clients` (`id_client`) ON DELETE SET NULL;

--
-- Constraints for table `off_sms`
--
ALTER TABLE `off_sms`
  ADD CONSTRAINT `off_sms_ibfk_1` FOREIGN KEY (`id_client`) REFERENCES `clients` (`id_client`) ON DELETE CASCADE;

--
-- Constraints for table `rapports`
--
ALTER TABLE `rapports`
  ADD CONSTRAINT `rapports_ibfk_1` FOREIGN KEY (`id_guichet`) REFERENCES `guichets` (`id_guichet`) ON DELETE CASCADE,
  ADD CONSTRAINT `rapports_ibfk_2` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE;

--
-- Constraints for table `service_ratings`
--
ALTER TABLE `service_ratings`
  ADD CONSTRAINT `service_ratings_ibfk_1` FOREIGN KEY (`id_ticket`) REFERENCES `tickets` (`id_ticket`) ON DELETE CASCADE,
  ADD CONSTRAINT `service_ratings_ibfk_2` FOREIGN KEY (`id_guichet`) REFERENCES `guichets` (`id_guichet`) ON DELETE SET NULL;

--
-- Constraints for table `statistiques`
--
ALTER TABLE `statistiques`
  ADD CONSTRAINT `statistiques_ibfk_1` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE;

--
-- Constraints for table `tickets`
--
ALTER TABLE `tickets`
  ADD CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`id_client`) REFERENCES `clients` (`id_client`) ON DELETE SET NULL,
  ADD CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`id_agence`) REFERENCES `agences` (`id_agence`) ON DELETE CASCADE,
  ADD CONSTRAINT `tickets_ibfk_3` FOREIGN KEY (`id_motif`) REFERENCES `motifs` (`id_motif`) ON DELETE SET NULL,
  ADD CONSTRAINT `tickets_ibfk_4` FOREIGN KEY (`id_file`) REFERENCES `files_attente` (`id_file`) ON DELETE SET NULL,
  ADD CONSTRAINT `tickets_ibfk_5` FOREIGN KEY (`id_guichet`) REFERENCES `guichets` (`id_guichet`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
