-- MySQL Schema Backup
-- Date: 2026-06-08T12:27:14.578Z

CREATE TABLE `corretor_specialties` (
  `corretor_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`corretor_id`,`specialty`),
  CONSTRAINT `corretor_specialties_ibfk_1` FOREIGN KEY (`corretor_id`) REFERENCES `corretores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `corretores` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creci` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `whatsapp` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Pendente','Aprovado','Rejeitado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pendente',
  `photo_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rating` decimal(3,2) NOT NULL DEFAULT '5.00',
  `responding_rate` int NOT NULL DEFAULT '100',
  `closed_deals` int NOT NULL DEFAULT '0',
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `ident_doc_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creci_doc_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `creci` (`creci`),
  KEY `idx_corretor_status` (`status`),
  KEY `idx_corretor_email` (`email`),
  KEY `idx_corretor_creci` (`creci`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `demand_neighborhoods` (
  `demand_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `neighborhood` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`demand_id`,`neighborhood`),
  CONSTRAINT `demand_neighborhoods_ibfk_1` FOREIGN KEY (`demand_id`) REFERENCES `demands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `demands` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('apartamento','casa','terreno','cobertura','comercial','outro') COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` enum('venda','locação') COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_price` decimal(15,2) NOT NULL,
  `bedrooms` int NOT NULL DEFAULT '0',
  `parking_spots` int NOT NULL DEFAULT '0',
  `min_area` decimal(10,2) NOT NULL DEFAULT '0.00',
  `urgency` enum('baixa','média','alta') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'média',
  `payment_method` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `ia_raw_text` text COLLATE utf8mb4_unicode_ci,
  `use_ia` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('Ativo','Inativo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Ativo',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cover_photo` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_demands_city_status` (`city`,`status`),
  KEY `idx_demands_max_price` (`max_price`),
  KEY `idx_demands_created_by` (`created_by`),
  CONSTRAINT `demands_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `corretores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `favorites` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `broker_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `favorite_type` enum('property','demand','broker') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_favorites_lookup` (`broker_id`,`favorite_type`,`target_id`),
  CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`broker_id`) REFERENCES `corretores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `match_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `match_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Novo','Visualizado','Em contato','Em negociação','Fechado','Perdido') COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `match_id` (`match_id`),
  CONSTRAINT `match_history_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `matches` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `property_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `demand_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `score` int NOT NULL,
  `status` enum('Novo','Visualizado','Em contato','Em negociação','Fechado','Perdido') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Novo',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `insights` text COLLATE utf8mb4_unicode_ci COMMENT 'AI insights cache',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_property_demand` (`property_id`,`demand_id`),
  KEY `idx_matches_score` (`score`),
  KEY `idx_matches_status` (`status`),
  KEY `demand_id` (`demand_id`),
  CONSTRAINT `matches_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `matches_ibfk_2` FOREIGN KEY (`demand_id`) REFERENCES `demands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `broker_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('match','verification','partnership','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_broker_read` (`broker_id`,`is_read`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`broker_id`) REFERENCES `corretores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `properties` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('apartamento','casa','terreno','cobertura','comercial','outro') COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` enum('venda','locação') COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `neighborhood` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `bedrooms` int NOT NULL DEFAULT '0',
  `bathrooms` int NOT NULL DEFAULT '0',
  `parking_spots` int NOT NULL DEFAULT '0',
  `area` decimal(10,2) NOT NULL DEFAULT '0.00',
  `commission` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accepts_partnership` tinyint(1) NOT NULL DEFAULT '1',
  `condo_fee` decimal(12,2) DEFAULT NULL,
  `iptu` decimal(12,2) DEFAULT NULL,
  `virtual_tour` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `video_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Ativo','Inativo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Ativo',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `photos` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_prop_search` (`city`,`neighborhood`,`status`),
  KEY `idx_prop_price` (`price`),
  KEY `idx_prop_created_by` (`created_by`),
  KEY `idx_prop_type_purpose` (`type`,`purpose`),
  CONSTRAINT `properties_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `corretores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `property_features` (
  `property_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `feature` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`property_id`,`feature`),
  CONSTRAINT `property_features_ibfk_1` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ratings` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `broker_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating_by` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `score` int NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ratings_broker` (`broker_id`),
  CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`broker_id`) REFERENCES `corretores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

