-- =====================================================================
-- CONECTACORRETOR B2B - MySQL SCHEMA & INITIAL SEEDING
-- Target Platform: MySQL 8.0+ / MariaDB 10.4+
-- Generated for persistent relational database conversion
-- =====================================================================

CREATE DATABASE IF NOT EXISTS imob;

USE imob;

-- Disable constraint verification during table drops to prevent blockages
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS match_history;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS demand_neighborhoods;
DROP TABLE IF EXISTS demands;
DROP TABLE IF EXISTS property_features;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS corretor_specialties;
DROP TABLE IF EXISTS corretores;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- TABLE: corretores
-- Holds brokers credentials, status verification and overall reputational statistics
-- =====================================================================
CREATE TABLE corretores (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    creci VARCHAR(30) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    whatsapp VARCHAR(30) NULL,
    city VARCHAR(100) NOT NULL,
    status ENUM('Pendente', 'Aprovado', 'Rejeitado') NOT NULL DEFAULT 'Pendente',
    photo_url VARCHAR(512) NULL,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 5.0,
    responding_rate INT NOT NULL DEFAULT 100,
    closed_deals INT NOT NULL DEFAULT 0,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ident_doc_url VARCHAR(512) NULL,
    creci_doc_url VARCHAR(512) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_corretor_status(status),
    INDEX idx_corretor_email(email),
    INDEX idx_corretor_creci(creci)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: corretor_specialties
-- Many-to-many list or string array conversion for Broker specialized skills
-- =====================================================================
CREATE TABLE corretor_specialties (
    corretor_id VARCHAR(50) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    PRIMARY KEY (corretor_id, specialty),
    FOREIGN KEY (corretor_id) REFERENCES corretores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: properties
-- Property listings (Ofertas) registered by verified brokers
-- =====================================================================
CREATE TABLE properties (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type ENUM('apartamento', 'casa', 'terreno', 'cobertura', 'comercial', 'outro') NOT NULL,
    purpose ENUM('venda', 'locação') NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    city VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    bedrooms INT NOT NULL DEFAULT 0,
    bathrooms INT NOT NULL DEFAULT 0,
    parking_spots INT NOT NULL DEFAULT 0,
    area DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    commission VARCHAR(255) NOT NULL,
    accepts_partnership BOOLEAN NOT NULL DEFAULT TRUE,
    condo_fee DECIMAL(12, 2) NULL,
    iptu DECIMAL(12, 2) NULL,
    virtual_tour VARCHAR(512) NULL,
    video_url VARCHAR(512) NULL,
    photos TEXT NULL,
    status ENUM('Ativo', 'Inativo') NOT NULL DEFAULT 'Ativo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prop_search(city, neighborhood, status),
    INDEX idx_prop_price(price),
    INDEX idx_prop_created_by(created_by),
    INDEX idx_prop_type_purpose(type, purpose),
    FOREIGN KEY (created_by) REFERENCES corretores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: property_features
-- Property features/amenities array conversion for granular filtering
-- =====================================================================
CREATE TABLE property_features (
    property_id VARCHAR(50) NOT NULL,
    feature VARCHAR(100) NOT NULL,
    PRIMARY KEY (property_id, feature),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: demands
-- Buyer requirements profiles (Procuras) listed by verified brokers
-- =====================================================================
CREATE TABLE demands (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    type ENUM('apartamento', 'casa', 'terreno', 'cobertura', 'comercial', 'outro') NOT NULL,
    purpose ENUM('venda', 'locação') NOT NULL,
    city VARCHAR(100) NOT NULL,
    max_price DECIMAL(15, 2) NOT NULL,
    bedrooms INT NOT NULL DEFAULT 0,
    parking_spots INT NOT NULL DEFAULT 0,
    min_area DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    urgency ENUM('baixa', 'média', 'alta') NOT NULL DEFAULT 'média',
    payment_method VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    ia_raw_text TEXT NULL,
    use_ia BOOLEAN NOT NULL DEFAULT FALSE,
    cover_photo VARCHAR(512) NULL,
    status ENUM('Ativo', 'Inativo') NOT NULL DEFAULT 'Ativo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_demands_city_status(city, status),
    INDEX idx_demands_max_price(max_price),
    INDEX idx_demands_created_by(created_by),
    FOREIGN KEY (created_by) REFERENCES corretores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: demand_neighborhoods
-- Locations mapped to specific client demand profiles (Procura Bairros)
-- =====================================================================
CREATE TABLE demand_neighborhoods (
    demand_id VARCHAR(50) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL,
    PRIMARY KEY (demand_id, neighborhood),
    FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: matches
-- Cross-network automatic and smart match evaluations
-- =====================================================================
CREATE TABLE matches (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    property_id VARCHAR(50) NOT NULL,
    demand_id VARCHAR(50) NOT NULL,
    score INT NOT NULL,
    insights TEXT DEFAULT NULL COMMENT 'JSON com explanation, advice e scoreExplanation gerados por IA e cacheados',
    status ENUM('Novo', 'Visualizado', 'Em contato', 'Em negociação', 'Fechado', 'Perdido') NOT NULL DEFAULT 'Novo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_property_demand (property_id, demand_id),
    INDEX idx_matches_score(score),
    INDEX idx_matches_status(status),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: match_history
-- Historical audit trail documenting status transitions in negotiations
-- =====================================================================
CREATE TABLE match_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    match_id VARCHAR(50) NOT NULL,
    status ENUM('Novo', 'Visualizado', 'Em contato', 'Em negociação', 'Fechado', 'Perdido') NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(150) NOT NULL,
    notes TEXT NULL,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: favorites
-- Mapped entries favorited by each active broker (to easily track targets)
-- =====================================================================
CREATE TABLE favorites (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    broker_id VARCHAR(50) NOT NULL,
    favorite_type ENUM('property', 'demand', 'broker') NOT NULL,
    target_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_favorites_lookup(broker_id, favorite_type, target_id),
    FOREIGN KEY (broker_id) REFERENCES corretores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: notifications
-- Notification alerts for match changes, verification updates & system alerts
-- =====================================================================
CREATE TABLE notifications (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    broker_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('match', 'verification', 'partnership', 'admin') NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_broker_read(broker_id, is_read),
    FOREIGN KEY (broker_id) REFERENCES corretores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TABLE: ratings
-- Work performance reviews left from brokers to their partners in matching
-- =====================================================================
CREATE TABLE ratings (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    broker_id VARCHAR(50) NOT NULL,
    rating_by VARCHAR(150) NOT NULL,
    score INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ratings_broker(broker_id),
    FOREIGN KEY (broker_id) REFERENCES corretores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- INITIAL SEEDING DATA FOR FAST COMPATIBILITY TESTS & LIVE SIMULATIONS
-- Mirrors the initial seed configuration set in db.ts
-- =====================================================================

-- 1. Insert seed Corretores
INSERT INTO corretores (id, name, email, creci, phone, whatsapp, city, status, photo_url, rating, responding_rate, closed_deals, is_admin)
VALUES 
('broker-renato', 'Renato Albuquerque', 'renato@corretor.com.br', 'CRECI 12450-F', '+5571999991111', '5571999991111', 'Salvador', 'Aprovado', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80', 4.90, 98, 14, TRUE),
('broker-mariana', 'Mariana Silva', 'mariana@corretor.co', 'CRECI 98322-F', '+5571988882222', '5571988882222', 'Salvador', 'Aprovado', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80', 5.00, 100, 21, FALSE),
('broker-ana', 'Ana Costa', 'ana@conecta.com.br', 'CRECI 54229-F', '+5511977773333', '5511977773333', 'São Paulo', 'Aprovado', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80', 4.80, 95, 8, FALSE),
('broker-ricardo', 'Ricardo Mendes', 'ricardo@corretores.com', 'CRECI 87311-F', '+5571955554444', '5571955554444', 'Salvador', 'Pendente', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80', 4.50, 85, 3, FALSE);

-- Specialties for Corretores
INSERT INTO corretor_specialties (corretor_id, specialty) VALUES
('broker-renato', 'Alto Padrão'),
('broker-renato', 'Apartamentos na Pituba'),
('broker-renato', 'Casas em Barra'),
('broker-mariana', 'Lançamentos'),
('broker-mariana', 'Minha Casa Minha Vida'),
('broker-mariana', 'Investimentos'),
('broker-ana', 'Apartamentos Compactos'),
('broker-ana', 'Studio Itaim Bibi'),
('broker-ana', 'Locação de Alto Padrão'),
('broker-ricardo', 'Salas Comerciais'),
('broker-ricardo', 'Terrenos em Condomínio');

-- 2. Insert seed Properties
INSERT INTO properties (id, title, type, purpose, price, city, neighborhood, description, bedrooms, bathrooms, parking_spots, area, commission, accepts_partnership, condo_fee, iptu, photos, status, created_by, created_at)
VALUES 
('prop-pituba-1', 'Apartamento Reformado 3 Qts com Varanda Gourmet na Pituba', 'apartamento', 'venda', 750000.00, 'Salvador', 'Pituba', 'Maravilhoso apartamento andar alto na Pituba, reformado com piso em porcelanato 80x80, teto rebaixado com iluminação planejada de LED. Ampla sala de estar integrada a uma incrível varanda gourmet envidraçada com churrasqueira ecológica. São 3 quartos (1 suíte com closet), cozinha equipada, dependência completa de serviço, 2 garagens cobertas e soltas. Prédio com infraestrutura de lazer: piscina, sauna, quiosque, brinquedoteca, portaria 24h automatizada e hall decorado.', 3, 3, 2, 95.00, '6% de comissão (partilha de 50/50 garantida em contrato)', TRUE, 780.00, 1500.00, '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80","https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80","https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80","https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&auto=format&fit=crop&q=80"]', 'Ativo', 'broker-renato', DATE_SUB(NOW(), INTERVAL 3 DAY)),
('prop-itaim-2', 'Studio de Luxo Mobiliado de 40m² a uma quadra do Parque do Povo', 'apartamento', 'venda', 1100000.00, 'São Paulo', 'Itaim Bibi', 'Excelente oportunidade para investidor ou moradia com praticidade no coração do Itaim Bibi. Studio totalmente decorado e mobiliado por arquiteto renomado. Cozinha planejada com eletrodomésticos embutidos, ar condicionado inverter central, cama queen com armário espelhado de alto acabamento e banheiro espaçoso revestido com pastilhas finas. 1 vaga de estacionamento. Condomínio com lavanderia compartilhada, academia profissional de última geração administrada por assessoria esportiva, piscina climatizada de raia e espaço coworking de uso livre.', 1, 1, 1, 40.00, '5% de comissão (partilha rigorosa de 50% pro corretor parceiro)', TRUE, 500.00, 900.00, '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80","https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"]', 'Ativo', 'broker-ana', DATE_SUB(NOW(), INTERVAL 5 DAY));

-- Features/Amenities for Properties
INSERT INTO property_features (property_id, feature) VALUES
('prop-pituba-1', 'piscina'),
('prop-pituba-1', 'varanda gourmet'),
('prop-pituba-1', 'ar condicionado'),
('prop-pituba-1', 'reforma recente'),
('prop-pituba-1', 'andar alto'),
('prop-itaim-2', 'mobiliado'),
('prop-itaim-2', 'academia'),
('prop-itaim-2', 'piscina'),
('prop-itaim-2', 'churrasqueira'),
('prop-itaim-2', 'portaria automatizada');

-- 3. Insert seed Demands
INSERT INTO demands (id, type, purpose, city, max_price, bedrooms, parking_spots, min_area, urgency, payment_method, notes, status, created_by, created_at)
VALUES 
('dem-pituba-3', 'apartamento', 'venda', 'Salvador', 800000.00, 3, 2, 85.00, 'alta', 'Financiamento bancário Caixa já pré-aprovado', 'Cliente tem pressa, mudou-se de outro estado e busca apto com varanda gourmet de verdade na Pituba.', 'Ativo', 'broker-mariana', DATE_SUB(NOW(), INTERVAL 1 DAY)),
('dem-itaim-4', 'apartamento', 'venda', 'São Paulo', 1200000.00, 1, 1, 35.00, 'média', 'Pagamento à vista com recursos próprios', 'Investidor de Minas Gerais deseja adquirir unidade compacta de alto padrão pra aluguel por temporada.', 'Ativo', 'broker-ana', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- Neighborhoods for Demands
INSERT INTO demand_neighborhoods (demand_id, neighborhood) VALUES
('dem-pituba-3', 'Pituba'),
('dem-pituba-3', 'Caminho das Árvores'),
('dem-itaim-4', 'Itaim Bibi'),
('dem-itaim-4', 'Vila Olímpia');

-- 4. Insert seed Matches
INSERT INTO matches (id, property_id, demand_id, score, status, created_at)
VALUES 
('match-pituba', 'prop-pituba-1', 'dem-pituba-3', 95, 'Novo', NOW());

-- Match History for audited state transitions
INSERT INTO match_history (match_id, status, updated_by, notes)
VALUES 
('match-pituba', 'Novo', 'Sistema', 'Match estabelecido de forma automática pelo motor de cruzamento inteligente ConectaCorretor.');

-- 5. Insert seed Notifications
INSERT INTO notifications (id, broker_id, title, message, type, is_read, created_at)
VALUES 
('not-1', 'broker-renato', 'Novo Match de Negócio! 🎉', 'Seu anúncio \'Apartamento Reformado 3 Qts na Pituba\' obteve 95% de compatibilidade com a procura cadastrada por Mariana Silva.', 'match', FALSE, NOW()),
('not-2', 'broker-mariana', 'Match Promissor Encontrado! 🎯', 'A procura ativada para seu cliente na Pituba gerou Match de 95% com o imóvel oferecido por Renato Albuquerque.', 'match', FALSE, NOW());
