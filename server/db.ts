import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { Corretor, Property, Demand, Match, Favorite, Notification, Rating, MatchHistory, SystemSettings, City } from "../src/types.js";
import { hashPassword, comparePassword, hashPasswordSync } from "./auth.js";

const DATABASE_FILE = path.join(process.cwd(), "data", "database.json");

interface DatabaseSchema {
  brokers: Corretor[];
  properties: Property[];
  demands: Demand[];
  matches: Match[];
  favorites: Favorite[];
  notifications: Notification[];
  ratings: Rating[];
  cities?: City[];
  passwords?: Record<string, string>;
  settings?: SystemSettings;
}

export let pool: Pool | null = null;

export const dbStatus = {
  connected: false,
  error: "",
  host: "",
  port: 5432,
  user: "",
  database: "neondb",
  mode: "offline",
  writesLogged: 0,
  writesFailed: 0,
  initializedFromSQL: false
};

// Initialize background connection
async function initMySQL() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[neon] DATABASE_URL not set. Set it in .env or environment. Running in offline mode.");
    return false;
  }

  console.log(`Connecting to Neon PostgreSQL...`);
  try {
    const newPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000
    });

    const client = await newPool.connect();
    const { rows } = await client.query("SELECT version()");
    client.release();
    pool = newPool;
    dbStatus.connected = true;
    dbStatus.mode = "postgresql";
    dbStatus.error = "";
    console.log("Neon PostgreSQL connection established:", rows[0]?.version);
    return true;
  } catch (err: any) {
    dbStatus.connected = false;
    dbStatus.mode = "offline";
    dbStatus.error = err.message || String(err);
    console.warn("Could not establish live connection to Neon. Falling back to local offline JSON database.", err.message);
    return false;
  }
}

export class OfflineDB {
  public data: DatabaseSchema = {
    brokers: [],
    properties: [],
    demands: [],
    matches: [],
    favorites: [],
    notifications: [],
    ratings: [],
    cities: []
  };

  private _initPromise: Promise<void> | null = null;

  constructor() {
    this.loadLocal();
    if (this.data.brokers.length === 0) {
      this.seedLocal();
    }
    
    this.ensurePasswords();
    
    this._initPromise = this.bootstrapMySQL();
  }

  async waitForInit(): Promise<void> {
    await this._initPromise;
  }

  private async bootstrapMySQL() {
    const connected = await initMySQL();
    if (connected && pool) {
      this._startKeepalive();
      await this.pq("ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)");
      await this.pq("ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)");
      await this.pq("CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY DEFAULT 'main', data JSONB)");
      await this.pq("CREATE TABLE IF NOT EXISTS broker_passwords (broker_id TEXT PRIMARY KEY, hash TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW())");
      try {
        await this.syncFromMySQL();
      } catch (err: any) {
        console.error("Failed to sync from MySQL tables. Bootstrapping seeding to MySQL instead...", err.message);
        await this.seedToMySQL();
      }
      await this.syncPasswordsFromNeon();
      await this.syncSettingsFromNeon();
    } else {
      this._retryConnection();
    }
  }

  private async syncPasswordsFromNeon() {
    if (!pool) return;
    try {
      const { rows } = await pool.query("SELECT broker_id, hash FROM broker_passwords");
      if (rows.length > 0) {
        if (!this.data.passwords) this.data.passwords = {};
        for (const row of rows) {
          this.data.passwords[row.broker_id] = row.hash;
        }
        this.saveLocal();
        console.log(`[passwords] Loaded ${rows.length} passwords from Neon`);
      }
    } catch (err: any) {
      console.warn("[passwords] Could not load from Neon:", err.message);
    }
  }

  private async savePasswordToNeon(brokerId: string, hash: string) {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO broker_passwords (broker_id, hash, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (broker_id) DO UPDATE SET hash = $2, updated_at = NOW()`,
        [brokerId, hash]
      );
    } catch (err: any) {
      console.warn(`[passwords] Could not save to Neon for ${brokerId}:`, err.message);
    }
  }

  private async syncSettingsFromNeon() {
    if (!pool) return;
    try {
      const { rows } = await pool.query("SELECT data FROM app_settings WHERE id = 'main'");
      if (rows.length > 0 && rows[0].data) {
        const settings = rows[0].data;
        if (typeof settings === 'string') {
          this.data.settings = JSON.parse(settings);
        } else {
          this.data.settings = settings;
        }
        this.saveLocal();
        console.log("[settings] Loaded from Neon:", JSON.stringify(this.data.settings));
      }
    } catch (err: any) {
      console.warn("[settings] Could not load from Neon:", err.message);
    }
  }

  private async syncSettingsToNeon() {
    if (!pool) return;
    try {
      const data = JSON.stringify(this.data.settings || {});
      await pool.query(
        "INSERT INTO app_settings (id, data) VALUES ('main', $1::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
        [data]
      );
      console.log("[settings] Saved to Neon");
    } catch (err: any) {
      console.warn("[settings] Could not save to Neon:", err.message);
    }
  }

  private async _retryConnection() {
    for (let attempt = 1; attempt <= 10; attempt++) {
      await new Promise(r => setTimeout(r, 15000));
      console.log(`[reconnect] Attempt ${attempt}/10...`);
      const ok = await initMySQL();
      if (ok && pool) {
        console.log("[reconnect] Connected to Neon on retry!");
        this._startKeepalive();
        try {
          await this.syncFromMySQL();
        } catch (err: any) {
          console.error("[reconnect] Sync failed on retry:", err.message);
          await this.seedToMySQL();
        }
        break;
      }
    }
  }

  private _startKeepalive() {
    setInterval(() => {
      if (pool) {
        pool.query("SELECT 1").catch(() => {});
      }
    }, 240000);
  }

  // Load from offline state
  private loadLocal() {
    try {
      if (fs.existsSync(DATABASE_FILE)) {
        const fileContent = fs.readFileSync(DATABASE_FILE, "utf-8");
        this.data = JSON.parse(fileContent);
      }
    } catch (err) {
      console.error("Failed loading JSON database, operating in memory", err);
    }
  }

  public saveLocal() {
    try {
      const dir = path.dirname(DATABASE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATABASE_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed persisting database to disk", err);
    }
  }

  private seedLocal() {
    console.log("Seeding ConectaCorretor platform with live MVP assets locally...");

    const seedBrokers: Corretor[] = [
      {
        id: "broker-renato",
        name: "Renato Albuquerque",
        email: "renato@corretor.com.br",
        creci: "CRECI 12450-F",
        phone: "+5571999991111",
        whatsapp: "5571999991111",
        city: "Salvador",
        status: "Aprovado",
        photoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80",
        rating: 4.9,
        respondingRate: 98,
        closedDeals: 14,
        isAdmin: true,
        specialties: ["Alto Padrão", "Apartamentos na Pituba", "Casas em Barra"]
      },
      {
        id: "broker-mariana",
        name: "Mariana Silva",
        email: "mariana@corretor.co",
        creci: "CRECI 98322-F",
        phone: "+5571988882222",
        whatsapp: "5571988882222",
        city: "Salvador",
        status: "Aprovado",
        photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        rating: 5.0,
        respondingRate: 100,
        closedDeals: 21,
        specialties: ["Lançamentos", "Minha Casa Minha Vida", "Investimentos"]
      },
      {
        id: "broker-ana",
        name: "Ana Costa",
        email: "ana@conecta.com.br",
        creci: "CRECI 54229-F",
        phone: "+5511977773333",
        whatsapp: "5511977773333",
        city: "São Paulo",
        status: "Aprovado",
        photoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
        rating: 4.8,
        respondingRate: 95,
        closedDeals: 8,
        specialties: ["Apartamentos Compactos", "Studio Itaim Bibi", "Locação de Alto Padrão"]
      },
      {
        id: "broker-ricardo",
        name: "Ricardo Mendes",
        email: "ricardo@corretores.com",
        creci: "CRECI 87311-F",
        phone: "+5571955554444",
        whatsapp: "5571955554444",
        city: "Salvador",
        status: "Pendente",
        photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
        rating: 4.5,
        respondingRate: 85,
        closedDeals: 3,
        specialties: ["Salas Comerciais", "Terrenos em Condomínio"]
      },
      {
        id: "broker-1781118286367",
        name: "Mauricio Lopes",
        email: "mauricio010579@gmail.com",
        creci: "35400",
        phone: "+55981813448",
        whatsapp: "55981813448",
        city: "Salvador",
        status: "Pendente",
        photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        rating: 5.0,
        respondingRate: 100,
        closedDeals: 0,
        specialties: ["Lançamentos residenciais", "Parcerias ágeis"]
      }
    ];

    const hashed = hashPasswordSync("123456");
    this.data.passwords = {
      "broker-renato": hashed,
      "broker-mariana": hashed,
      "broker-ana": hashed,
      "broker-ricardo": hashed,
      "broker-1781118286367": hashed,
    };

    const seedProperties: Property[] = [
      {
        id: "prop-pituba-1",
        title: "Apartamento Reformado 3 Qts com Varanda Gourmet na Pituba",
        type: "apartamento",
        purpose: "venda",
        price: 750000,
        city: "Salvador",
        neighborhood: "Pituba",
        description: "Maravilhoso apartamento andar alto na Pituba, reformado com piso em porcelanato 80x80, teto rebaixado com iluminação planejada de LED. Ampla sala de estar integrada a uma incrível varanda gourmet envidraçada com churrasqueira ecológica. São 3 quartos (1 suíte com closet), cozinha equipada, dependência completa de serviço, 2 garagens cobertas e soltas. Prédio com infraestrutura de lazer: piscina, sauna, quiosque, brinquedoteca, portaria 24h automatizada e hall decorado.",
        bedrooms: 3,
        bathrooms: 3,
        parkingSpots: 2,
        area: 95,
        commission: "6% de comissão (partilha de 50/50 garantida em contrato)",
        acceptsPartnership: true,
        features: ["piscina", "varanda gourmet", "ar condicionado", "reforma recente", "andar alto"],
        condoFee: 780,
        iptu: 1500,
        photos: [
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&auto=format&fit=crop&q=80"
        ],
        status: "Ativo",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: "broker-renato"
      },
      {
        id: "prop-itaim-2",
        title: "Studio de Luxo Mobiliado de 40m² a uma quadra do Parque do Povo",
        type: "apartamento",
        purpose: "venda",
        price: 1100000,
        city: "São Paulo",
        neighborhood: "Itaim Bibi",
        description: "Excelente oportunidade para investidor ou moradia com praticidade no coração do Itaim Bibi. Studio totalmente decorado e mobiliado por arquiteto renomado. Cozinha planejada com eletrodomésticos embutidos, ar condicionado inverter central, cama queen com armário espelhado de alto acabamento e banheiro espaçoso revestido com pastilhas finas. 1 vaga de estacionamento. Condomínio com lavanderia compartilhada, academia profissional de última geração administrada por assessoria esportiva, piscina climatizada de raia e espaço coworking de uso livre.",
        bedrooms: 1,
        bathrooms: 1,
        parkingSpots: 1,
        area: 40,
        commission: "5% de comissão (partilha rigorosa de 50% pro corretor parceiro)",
        acceptsPartnership: true,
        features: ["mobiliado", "academia", "piscina", "churrasqueira", "portaria automatizada"],
        condoFee: 500,
        iptu: 900,
        photos: [
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80"
        ],
        status: "Ativo",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: "broker-ana"
      }
    ];

    const seedDemands: Demand[] = [
      {
        id: "dem-pituba-3",
        type: "apartamento",
        purpose: "venda",
        city: "Salvador",
        neighborhoods: ["Pituba", "Caminho das Árvores"],
        maxPrice: 800000,
        bedrooms: 3,
        parkingSpots: 2,
        minArea: 85,
        urgency: "alta",
        paymentMethod: "Financiamento bancário Caixa já pré-aprovado",
        notes: "Cliente tem pressa, mudou-se de outro estado e busca apto com varanda gourmet de verdade na Pituba.",
        coverPhoto: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&auto=format&fit=crop&q=80",
        status: "Ativo",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: "broker-mariana"
      },
      {
        id: "dem-itaim-4",
        type: "apartamento",
        purpose: "venda",
        city: "São Paulo",
        neighborhoods: ["Itaim Bibi", "Vila Olímpia"],
        maxPrice: 1200000,
        bedrooms: 1,
        parkingSpots: 1,
        minArea: 35,
        urgency: "média",
        paymentMethod: "Pagamento à vista com recursos próprios",
        notes: "Investidor de Minas Gerais deseja adquirir unidade compacta de alto padrão pra aluguel por temporada.",
        coverPhoto: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop&q=80",
        status: "Ativo",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: "broker-ana"
      }
    ];

    const seedMatches: Match[] = [
      {
        id: "match-pituba",
        propertyId: "prop-pituba-1",
        demandId: "dem-pituba-3",
        score: 95,
        status: "Novo",
        createdAt: new Date().toISOString(),
        history: [
          {
            status: "Novo",
            updatedAt: new Date().toISOString(),
            updatedBy: "Sistema",
            notes: "Match estabelecido de forma automática pelo motor de cruzamento inteligente ConectaCorretor."
          }
        ]
      }
    ];

    const seedNotifications: Notification[] = [
      {
        id: "not-1",
        brokerId: "broker-renato",
        title: "Novo Match de Negócio! 🎉",
        message: "Seu anúncio 'Apartamento Reformado 3 Qts na Pituba' obteve 95% de compatibilidade com a procura cadastrada por Mariana Silva.",
        type: "match",
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "not-2",
        brokerId: "broker-mariana",
        title: "Match Promissor Encontrado! 🎯",
        message: "A procura ativada para seu cliente na Pituba gerou Match de 95% com o imóvel oferecido por Renato Albuquerque.",
        type: "match",
        read: false,
        createdAt: new Date().toISOString()
      }
    ];

    this.data.brokers = seedBrokers;
    this.data.properties = seedProperties;
    this.data.demands = seedDemands;
    this.data.matches = seedMatches;
    this.data.notifications = seedNotifications;
    this.data.favorites = [];
    this.data.ratings = [];

    this.data.cities = [
      { id: "cidade-salvador", name: "Salvador", neighborhoods: ["Pituba", "Caminho das Árvores", "Barra", "Ondina", "Rio Vermelho", "Graça", "Brotas", "Itaigara", "Stiep", "Costa Azul"] },
      { id: "cidade-sp", name: "São Paulo", neighborhoods: ["Itaim Bibi", "Vila Olímpia", "Pinheiros", "Moema", "Jardins", "Vila Mariana", "Brooklin", "Paraíso", "Consolação", "Perdizes"] },
      { id: "cidade-rj", name: "Rio de Janeiro", neighborhoods: ["Copacabana", "Ipanema", "Leblon", "Barra da Tijuca", "Botafogo", "Flamengo", "Tijuca", "Lagoa", "Laranjeiras"] },
      { id: "cidade-bh", name: "Belo Horizonte", neighborhoods: ["Savassi", "Lourdes", "Funcionários", "Sion", "Santo Antônio", "Cidade Jardim", "Belvedere"] }
    ];

    this.saveLocal();
  }

  private ensurePasswords() {
    if (!this.data.passwords) {
      this.data.passwords = {};
    }
    for (const b of this.data.brokers) {
      if (!this.data.passwords[b.id]) {
        this.data.passwords[b.id] = hashPasswordSync("123456");
      }
    }
  }

  // ==========================================
  // SYNC FROM MYSQL UPON STARTUP
  // ==========================================
  public async syncFromMySQL() {
    if (!pool) return;
    try {
      console.log("Loading relational tables from Neon PostgreSQL...");
      
      // Save local-only brokers before overwriting (development seed data + new registrations not yet in Neon)
      const localBrokersBeforeSync = [...this.data.brokers];
      
      // 1. Corretores
      const { rows: rawBrokers }: any = await pool.query("SELECT * FROM corretores");
      const brokersMap: { [key: string]: Corretor } = {};
      for (const row of rawBrokers) {
        brokersMap[row.id] = {
          id: row.id,
          name: row.name,
          email: row.email,
          creci: row.creci,
          phone: row.phone,
          whatsapp: row.whatsapp || undefined,
          city: row.city,
          status: row.status,
          photoUrl: row.photo_url || undefined,
          rating: Number(row.rating),
          respondingRate: row.responding_rate,
          closedDeals: row.closed_deals,
          isAdmin: Boolean(row.is_admin),
          identDocUrl: row.ident_doc_url || undefined,
          creciDocUrl: row.creci_doc_url || undefined,
          specialties: []
        };
      }

      // Add Broker Specialties
      const { rows: rawSpecs }: any = await pool.query("SELECT * FROM corretor_specialties");
      for (const row of rawSpecs) {
        if (brokersMap[row.corretor_id]) {
          brokersMap[row.corretor_id].specialties?.push(row.specialty);
        }
      }

      // 2. Properties
      const { rows: rawProps }: any = await pool.query("SELECT * FROM properties");
      const propsMap: { [key: string]: Property } = {};
      for (const r of rawProps) {
        let photosArray: string[] = [];
        try {
          if (r.photos) {
            photosArray = typeof r.photos === "string" ? JSON.parse(r.photos) : r.photos;
          }
        } catch (e) {
          console.error("Failed parsing photos array for property:", r.id, e);
        }

        propsMap[r.id] = {
          id: r.id,
          title: r.title,
          type: r.type,
          purpose: r.purpose,
          price: Number(r.price),
          city: r.city,
          neighborhood: r.neighborhood,
          description: r.description,
          bedrooms: r.bedrooms,
          bathrooms: r.bathrooms,
          parkingSpots: r.parking_spots,
          area: Number(r.area),
          commission: r.commission,
          acceptsPartnership: Boolean(r.accepts_partnership),
          condoFee: r.condo_fee ? Number(r.condo_fee) : undefined,
          iptu: r.iptu ? Number(r.iptu) : undefined,
          virtualTour: r.virtual_tour || undefined,
          videoUrl: r.video_url || undefined,
          status: r.status,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          createdBy: r.created_by,
          features: [],
          photos: photosArray,
          latitude: r.latitude ? Number(r.latitude) : undefined,
          longitude: r.longitude ? Number(r.longitude) : undefined
        };
      }

      // Add Property Features
      const { rows: rawFeatures }: any = await pool.query("SELECT * FROM property_features");
      for (const f of rawFeatures) {
        if (propsMap[f.property_id]) {
          propsMap[f.property_id].features.push(f.feature);
        }
      }

      // 3. Demands
      const { rows: rawDemands }: any = await pool.query("SELECT * FROM demands");
      const demandsMap: { [key: string]: Demand } = {};
      for (const d of rawDemands) {
        demandsMap[d.id] = {
          id: d.id,
          type: d.type,
          purpose: d.purpose,
          city: d.city,
          maxPrice: Number(d.max_price),
          bedrooms: d.bedrooms,
          parkingSpots: d.parking_spots,
          minArea: Number(d.min_area),
          urgency: d.urgency,
          paymentMethod: d.payment_method,
          notes: d.notes || undefined,
          iaRawText: d.ia_raw_text || undefined,
          useIa: Boolean(d.use_ia),
          coverPhoto: d.cover_photo || undefined,
          status: d.status,
          createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
          createdBy: d.created_by,
          neighborhoods: []
        };
      }

      // Add Demand Neighborhoods
      const { rows: rawNeighs }: any = await pool.query("SELECT * FROM demand_neighborhoods");
      for (const row of rawNeighs) {
        if (demandsMap[row.demand_id]) {
          demandsMap[row.demand_id].neighborhoods.push(row.neighborhood);
        }
      }

      // 4. Matches
      const { rows: rawMatches }: any = await pool.query("SELECT * FROM matches");
      const matchesMap: { [key: string]: Match } = {};
      for (const m of rawMatches) {
        let cachedInsights = undefined;
        if (m.insights) {
          try { cachedInsights = JSON.parse(m.insights); } catch {}
        }
        matchesMap[m.id] = {
          id: m.id,
          propertyId: m.property_id,
          demandId: m.demand_id,
          score: m.score,
          status: m.status,
          createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
          insights: cachedInsights,
          history: []
        };
      }

      // Add Match History Audit Trail
      const { rows: rawHistory }: any = await pool.query("SELECT * FROM match_history ORDER BY id ASC");

      // 5. Favorites
      const { rows: rawFavorites }: any = await pool.query("SELECT * FROM favorites");
      const favorites: Favorite[] = rawFavorites.map((f: any) => ({
        id: f.id,
        brokerId: f.broker_id,
        favoriteType: f.favorite_type,
        targetId: f.target_id,
        createdAt: f.created_at ? new Date(f.created_at).toISOString() : new Date().toISOString()
      }));

      // 6. Notifications
      const { rows: rawNotifications }: any = await pool.query("SELECT * FROM notifications");
      const notifications: Notification[] = rawNotifications.map((n: any) => ({
        id: n.id,
        brokerId: n.broker_id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: Boolean(n.is_read),
        createdAt: n.created_at ? new Date(n.created_at).toISOString() : new Date().toISOString()
      }));

      // 7. Ratings
      const { rows: rawRatings }: any = await pool.query("SELECT * FROM ratings");
      const ratings: Rating[] = rawRatings.map((r: any) => ({
        id: r.id,
        brokerId: r.broker_id,
        ratingBy: r.rating_by,
        score: r.score,
        comment: r.comment,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
      }));

      // ================================================================
      // NEON IS THE SOURCE OF TRUTH — full overwrite local memory cache
      // ================================================================
      const neonBrokerIds = new Set(Object.keys(brokersMap));
      
      this.data.brokers = Object.values(brokersMap);
      this.data.properties = Object.values(propsMap);
      this.data.demands = Object.values(demandsMap);
      this.data.matches = Object.values(matchesMap);
      this.data.favorites = favorites;
      this.data.notifications = notifications;
      this.data.ratings = ratings;

      // Merge local-only brokers (development seed + new registrations not yet in Neon)
      const localOnly = localBrokersBeforeSync.filter(b => !neonBrokerIds.has(b.id));
      if (localOnly.length > 0) {
        this.data.brokers = [...this.data.brokers, ...localOnly];
        console.log(`[sync] Merged ${localOnly.length} local-only brokers not yet in Neon`);
        
        // Try to push local-only brokers to Neon so they don't stay out of sync
        for (const b of localOnly) {
          try {
            await this.executeMySQLWriteCritical(
              `INSERT INTO corretores (id, name, email, creci, phone, whatsapp, city, status, photo_url, rating, responding_rate, closed_deals, is_admin, ident_doc_url, creci_doc_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, creci=EXCLUDED.creci, phone=EXCLUDED.phone, whatsapp=EXCLUDED.whatsapp, city=EXCLUDED.city, status=EXCLUDED.status, photo_url=EXCLUDED.photo_url, rating=EXCLUDED.rating, responding_rate=EXCLUDED.responding_rate, closed_deals=EXCLUDED.closed_deals, is_admin=EXCLUDED.is_admin, ident_doc_url=EXCLUDED.ident_doc_url, creci_doc_url=EXCLUDED.creci_doc_url`,
              [b.id, b.name, b.email, b.creci, b.phone, b.whatsapp || null, b.city, b.status, b.photoUrl || null, b.rating || 5.0, b.respondingRate || 100, b.closedDeals || 0, b.isAdmin ?? false, b.identDocUrl || null, b.creciDocUrl || null]
            );
            if (b.specialties) {
              await this.executeMySQLWriteCritical("DELETE FROM corretor_specialties WHERE corretor_id = ?", [b.id]);
              for (const s of b.specialties) {
                await this.executeMySQLWriteCritical("INSERT INTO corretor_specialties (corretor_id, specialty) VALUES (?, ?)", [b.id, s]);
              }
            }
            console.log(`[sync] Pushed local-only broker ${b.id} to Neon`);
          } catch (e: any) {
            console.warn(`[sync] Could not push broker ${b.id} to Neon: ${e.message}`);
          }
        }
      }

      this.ensurePasswords();
      dbStatus.initializedFromSQL = true;
      console.log("Neon Synchronization complete! Synchronized: " + 
        `${this.data.brokers.length} brokers, ${this.data.properties.length} properties, ` + 
        `${this.data.demands.length} demands, ${this.data.matches.length} matches.` +
        ` (${localOnly.length} local-only brokers merged)`);
      
      // Persist the synced state to local JSON cache
      this.saveLocal();
    } catch (err: any) {
      console.error("Critical error mapping tables from Neon:", err);
      dbStatus.initializedFromSQL = false;
      throw err;
    }
  }

  // ==========================================
  // SEED LOCAL DATA INTO EMPTY VPS TABLES
  // ==========================================
  public async seedToMySQL() {
    if (!pool) return;
    try {
      console.log("Seeding local configuration to Neon PostgreSQL...");
      
      // Seed brokers
      for (const b of this.data.brokers) {
        await this.pq(
          `INSERT INTO corretores (id, name, email, creci, phone, whatsapp, city, status, photo_url, rating, responding_rate, closed_deals, is_admin, ident_doc_url, creci_doc_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, creci=EXCLUDED.creci, phone=EXCLUDED.phone, whatsapp=EXCLUDED.whatsapp, city=EXCLUDED.city, status=EXCLUDED.status, photo_url=EXCLUDED.photo_url, rating=EXCLUDED.rating, responding_rate=EXCLUDED.responding_rate, closed_deals=EXCLUDED.closed_deals, is_admin=EXCLUDED.is_admin, ident_doc_url=EXCLUDED.ident_doc_url, creci_doc_url=EXCLUDED.creci_doc_url`,
          [b.id, b.name, b.email, b.creci, b.phone, b.whatsapp || null, b.city, b.status, b.photoUrl || null, b.rating || 5.0, b.respondingRate || 100, b.closedDeals || 0, b.isAdmin, b.identDocUrl || null, b.creciDocUrl || null]
        );

        if (b.specialties) {
          await this.pq("DELETE FROM corretor_specialties WHERE corretor_id = ?", [b.id]);
          for (const s of b.specialties) {
            await this.pq("INSERT INTO corretor_specialties (corretor_id, specialty) VALUES (?, ?)", [b.id, s]);
          }
        }
      }

      // Seed properties
      for (const p of this.data.properties) {
        await this.pq(
          `INSERT INTO properties (id, title, type, purpose, price, city, neighborhood, description, bedrooms, bathrooms, parking_spots, area, commission, accepts_partnership, condo_fee, iptu, virtual_tour, video_url, status, created_by, photos, latitude, longitude)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, type=EXCLUDED.type, purpose=EXCLUDED.purpose, price=EXCLUDED.price, city=EXCLUDED.city, neighborhood=EXCLUDED.neighborhood, description=EXCLUDED.description, bedrooms=EXCLUDED.bedrooms, bathrooms=EXCLUDED.bathrooms, parking_spots=EXCLUDED.parking_spots, area=EXCLUDED.area, commission=EXCLUDED.commission, accepts_partnership=EXCLUDED.accepts_partnership, condo_fee=EXCLUDED.condo_fee, iptu=EXCLUDED.iptu, virtual_tour=EXCLUDED.virtual_tour, video_url=EXCLUDED.video_url, status=EXCLUDED.status, photos=EXCLUDED.photos, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude`,
          [p.id, p.title, p.type, p.purpose, p.price, p.city, p.neighborhood, p.description, p.bedrooms, p.bathrooms, p.parkingSpots, p.area, p.commission, p.acceptsPartnership, p.condoFee || null, p.iptu || null, p.virtualTour || null, p.videoUrl || null, p.status, p.createdBy, JSON.stringify(p.photos || []), p.latitude || null, p.longitude || null]
        );

        if (p.features) {
          await this.pq("DELETE FROM property_features WHERE property_id = ?", [p.id]);
          for (const f of p.features) {
            await this.pq("INSERT INTO property_features (property_id, feature) VALUES (?, ?)", [p.id, f]);
          }
        }
      }

      // Seed demands
      for (const d of this.data.demands) {
        await this.pq(
          `INSERT INTO demands (id, type, purpose, city, max_price, bedrooms, parking_spots, min_area, urgency, payment_method, notes, ia_raw_text, use_ia, cover_photo, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type, purpose=EXCLUDED.purpose, city=EXCLUDED.city, max_price=EXCLUDED.max_price, bedrooms=EXCLUDED.bedrooms, parking_spots=EXCLUDED.parking_spots, min_area=EXCLUDED.min_area, urgency=EXCLUDED.urgency, payment_method=EXCLUDED.payment_method, notes=EXCLUDED.notes, ia_raw_text=EXCLUDED.ia_raw_text, use_ia=EXCLUDED.use_ia, cover_photo=EXCLUDED.cover_photo, status=EXCLUDED.status`,
          [d.id, d.type, d.purpose, d.city, d.maxPrice, d.bedrooms, d.parkingSpots, d.minArea, d.urgency, d.paymentMethod, d.notes || null, d.iaRawText || null, d.useIa, d.coverPhoto || null, d.status, d.createdBy]
        );

        if (d.neighborhoods) {
          await this.pq("DELETE FROM demand_neighborhoods WHERE demand_id = ?", [d.id]);
          for (const n of d.neighborhoods) {
            await this.pq("INSERT INTO demand_neighborhoods (demand_id, neighborhood) VALUES (?, ?)", [d.id, n]);
          }
        }
      }

      // Seed matches & history
      for (const m of this.data.matches) {
        const insightsJson = m.insights ? JSON.stringify(m.insights) : null;
        await this.pq(
          `INSERT INTO matches (id, property_id, demand_id, score, status, insights)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET score=EXCLUDED.score, status=EXCLUDED.status, insights=EXCLUDED.insights`,
          [m.id, m.propertyId, m.demandId, m.score, m.status, insightsJson]
        );

        if (m.history) {
          for (const h of m.history) {
            await this.pq(
              "INSERT INTO match_history (match_id, status, updated_by, notes) VALUES (?, ?, ?, ?)",
              [m.id, h.status, h.updatedBy, h.notes || null]
            );
          }
        }
      }

      // Seed standard Notifications
      for (const n of this.data.notifications) {
        await this.pq(
          `INSERT INTO notifications (id, broker_id, title, message, type, is_read)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, message=EXCLUDED.message, type=EXCLUDED.type, is_read=EXCLUDED.is_read`,
          [n.id, n.brokerId, n.title, n.message, n.type, n.read]
        );
      }

      console.log("Successfully seeded database structures in Neon PostgreSQL!");
    } catch (err: any) {
      console.error("Failed seeding database schemas to PostgreSQL:", err);
    }
  }

  // ==========================================
  // BACKGROUND WRITE QUERY WRAPPERS
  // ==========================================
  private async executeMySQLWrite(query: string, params: any[]) {
    if (!pool) {
      console.log("[executeMySQLWrite] Pool is null, skipping write");
      return;
    }
    try {
      let i = 0;
      const pgSql = query.replace(/\?/g, () => `$${++i}`);
      console.log(`[executeMySQLWrite] Executing query: ${pgSql.substring(0, 100)}...`);
      console.log(`[executeMySQLWrite] Params:`, params);
      await pool.query(pgSql, params);
      dbStatus.writesLogged++;
      console.log(`[executeMySQLWrite] Write successful`);
    } catch (err: any) {
      dbStatus.writesFailed++;
      console.error("Failed PostgreSQL passive background sync statement:", err.message);
    }
  }

  /** Like executeMySQLWrite but throws on failure — for Neon-first write-through. */
  private async executeMySQLWriteCritical(query: string, params: any[]): Promise<void> {
    if (!pool) {
      throw new Error("Neon database is not connected");
    }
    let i = 0;
    const pgSql = query.replace(/\?/g, () => `$${++i}`);
    await pool.query(pgSql, params);
    dbStatus.writesLogged++;
  }

  // Convert ? to $N for PostgreSQL compatibility
  private async pq(sql: string, params?: any[]) {
    if (!pool) return null;
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    try {
      const result = await pool.query(pgSql, params);
      return result;
    } catch (err: any) {
      console.error("PQ query error:", err.message);
      return null;
    }
  }

  // Broker CRUD
  public getBrokers(): Corretor[] {
    return this.data.brokers;
  }

  public async fetchBrokersFromMySQL(): Promise<Corretor[]> {
    if (!pool) {
      return this.data.brokers;
    }
    try {
      const { rows: rawBrokers }: any = await pool.query("SELECT * FROM corretores");
      const brokersMap: { [key: string]: Corretor } = {};
      for (const row of rawBrokers) {
        brokersMap[row.id] = {
          id: row.id,
          name: row.name,
          email: row.email,
          creci: row.creci,
          phone: row.phone,
          whatsapp: row.whatsapp || undefined,
          city: row.city,
          status: row.status,
          photoUrl: row.photo_url || undefined,
          rating: Number(row.rating),
          respondingRate: row.responding_rate,
          closedDeals: row.closed_deals,
          isAdmin: Boolean(row.is_admin),
          identDocUrl: row.ident_doc_url || undefined,
          creciDocUrl: row.creci_doc_url || undefined,
          specialties: []
        };
      }

      // Add Broker Specialties
      const { rows: rawSpecs }: any = await pool.query("SELECT * FROM corretor_specialties");
      for (const row of rawSpecs) {
        if (brokersMap[row.corretor_id]) {
          brokersMap[row.corretor_id].specialties?.push(row.specialty);
        }
      }
      
      // Update local cache with fresh Neon data
      const neonBrokers = Object.values(brokersMap);
      const neonIds = new Set(neonBrokers.map(b => b.id));
      const localOnly = this.data.brokers.filter(b => !neonIds.has(b.id));
      
      this.data.brokers = [...neonBrokers, ...localOnly];
      this.saveLocal();
      
      if (localOnly.length > 0) {
        console.log(`[fetchBrokers] Including ${localOnly.length} local-only brokers not yet in Neon — pushing them now...`);
        for (const b of localOnly) {
          try {
            await this.executeMySQLWriteCritical(
              `INSERT INTO corretores (id, name, email, creci, phone, whatsapp, city, status, photo_url, rating, responding_rate, closed_deals, is_admin, ident_doc_url, creci_doc_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, creci=EXCLUDED.creci, phone=EXCLUDED.phone, whatsapp=EXCLUDED.whatsapp, city=EXCLUDED.city, status=EXCLUDED.status, photo_url=EXCLUDED.photo_url, rating=EXCLUDED.rating, responding_rate=EXCLUDED.responding_rate, closed_deals=EXCLUDED.closed_deals, is_admin=EXCLUDED.is_admin, ident_doc_url=EXCLUDED.ident_doc_url, creci_doc_url=EXCLUDED.creci_doc_url`,
              [b.id, b.name, b.email, b.creci, b.phone, b.whatsapp || null, b.city, b.status, b.photoUrl || null, b.rating || 5.0, b.respondingRate || 100, b.closedDeals || 0, b.isAdmin ?? false, b.identDocUrl || null, b.creciDocUrl || null]
            );
            if (b.specialties) {
              await this.executeMySQLWriteCritical("DELETE FROM corretor_specialties WHERE corretor_id = ?", [b.id]);
              for (const s of b.specialties) {
                await this.executeMySQLWriteCritical("INSERT INTO corretor_specialties (corretor_id, specialty) VALUES (?, ?)", [b.id, s]);
              }
            }
            console.log(`[fetchBrokers] Pushed local-only broker ${b.id} (${b.name}) to Neon`);
          } catch (pushErr: any) {
            console.warn(`[fetchBrokers] Could not push broker ${b.id} to Neon: ${pushErr.message}`);
          }
        }
      } else {
        console.log(`[fetchBrokers] Updated local cache: ${neonBrokers.length} from Neon, all in sync`);
      }
      return this.data.brokers;
    } catch (err: any) {
      console.error("Failed to fetch brokers from Neon:", err.message);
      return this.data.brokers;
    }
  }

  public getBroker(id: string): Corretor | undefined {
    return this.data.brokers.find(b => b.id === id);
  }

  public getBrokerByEmail(email: string): Corretor | undefined {
    return this.data.brokers.find(b => b.email.toLowerCase() === email.toLowerCase());
  }

  public async validatePassword(brokerId: string, password: string): Promise<boolean> {
    const stored = (this.data.passwords || {})[brokerId];
    if (!stored) return false;
    const valid = await comparePassword(password, stored);
    if (valid && !stored.startsWith("$2")) {
      await this.setPassword(brokerId, password);
    }
    return valid;
  }

  public async setPassword(brokerId: string, password: string): Promise<void> {
    if (!this.data.passwords) this.data.passwords = {};
    const hash = await hashPassword(password);
    this.data.passwords[brokerId] = hash;
    this.saveLocal();
    await this.savePasswordToNeon(brokerId, hash);
  }

  public async createBroker(broker: Corretor): Promise<Corretor> {
    console.log(`[createBroker] Creating broker ${broker.id} (${broker.name})`);

    // Neon-first: write to Neon BEFORE updating local cache
    await this.executeMySQLWriteCritical(
      `INSERT INTO corretores (id, name, email, creci, phone, whatsapp, city, status, photo_url, rating, responding_rate, closed_deals, is_admin, ident_doc_url, creci_doc_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [broker.id, broker.name, broker.email, broker.creci, broker.phone || "+55 (71) 99999-0000", broker.whatsapp || null, broker.city, broker.status, broker.photoUrl || null, broker.rating || 5.0, broker.respondingRate || 100, broker.closedDeals || 0, broker.isAdmin, broker.identDocUrl || null, broker.creciDocUrl || null]
    );

    // Write specialties
    if (pool && broker.specialties) {
      for (const s of broker.specialties) {
        await this.executeMySQLWriteCritical(
          "INSERT INTO corretor_specialties (corretor_id, specialty) VALUES (?, ?)",
          [broker.id, s]
        );
      }
    }

    // Neon write succeeded — now update local cache
    this.data.brokers.push(broker);
    this.saveLocal();
    console.log(`[createBroker] Broker ${broker.id} created in Neon + cached locally`);

    return broker;
  }

  public async updateBroker(id: string, updates: Partial<Corretor>): Promise<Corretor> {
    const idx = this.data.brokers.findIndex(b => b.id === id);
    if (idx === -1) throw new Error("Broker not found");

    // Compute the new state before writing to Neon
    const updated = { ...this.data.brokers[idx], ...updates };

    // Neon-first: write to Neon BEFORE updating local cache
    await this.executeMySQLWriteCritical(
      `UPDATE corretores 
       SET name=?, email=?, creci=?, phone=?, whatsapp=?, city=?, status=?, photo_url=?, rating=?, responding_rate=?, closed_deals=?, is_admin=?, ident_doc_url=?, creci_doc_url=?
       WHERE id=?`,
      [updated.name, updated.email, updated.creci, updated.phone, updated.whatsapp || null, updated.city, updated.status, updated.photoUrl || null, updated.rating || 5.0, updated.respondingRate || 100, updated.closedDeals || 0, updated.isAdmin, updated.identDocUrl || null, updated.creciDocUrl || null, id]
    );

    // Update specialties if changed
    if (pool && updates.specialties) {
      await this.executeMySQLWriteCritical("DELETE FROM corretor_specialties WHERE corretor_id = ?", [id]);
      for (const s of updates.specialties) {
        await this.executeMySQLWriteCritical(
          "INSERT INTO corretor_specialties (corretor_id, specialty) VALUES (?, ?)",
          [id, s]
        );
      }
    }

    // Neon write succeeded — now update local cache
    this.data.brokers[idx] = updated;
    this.saveLocal();

    return this.data.brokers[idx];
  }

  /** Synchronous local-only update (no Neon write). Used by internal callers (ratings, match close). */
  private _updateBrokerLocal(id: string, updates: Partial<Corretor>): Corretor {
    const idx = this.data.brokers.findIndex(b => b.id === id);
    if (idx === -1) throw new Error("Broker not found");
    this.data.brokers[idx] = { ...this.data.brokers[idx], ...updates };
    this.saveLocal();
    // Fire background Neon sync (best-effort)
    const bk = this.data.brokers[idx];
    this.executeMySQLWrite(
      `UPDATE corretores SET name=?, email=?, creci=?, phone=?, whatsapp=?, city=?, status=?, photo_url=?, rating=?, responding_rate=?, closed_deals=?, is_admin=?, ident_doc_url=?, creci_doc_url=? WHERE id=?`,
      [bk.name, bk.email, bk.creci, bk.phone, bk.whatsapp || null, bk.city, bk.status, bk.photoUrl || null, bk.rating || 5.0, bk.respondingRate || 100, bk.closedDeals || 0, bk.isAdmin, bk.identDocUrl || null, bk.creciDocUrl || null, id]
    );
    return this.data.brokers[idx];
  }

  public async deleteBroker(id: string): Promise<boolean> {
    const lenBefore = this.data.brokers.length;

    // Neon-first: delete related data + broker from Neon BEFORE touching local cache
    await this.executeMySQLWriteCritical("DELETE FROM notifications WHERE broker_id = ?", [id]);
    await this.executeMySQLWriteCritical("DELETE FROM favorites WHERE broker_id = ?", [id]);
    await this.executeMySQLWriteCritical("DELETE FROM ratings WHERE broker_id = ?", [id]);
    await this.executeMySQLWriteCritical("DELETE FROM corretor_specialties WHERE corretor_id = ?", [id]);
    await this.executeMySQLWriteCritical("DELETE FROM corretores WHERE id = ?", [id]);

    // Neon delete succeeded — now update local cache
    this.data.brokers = this.data.brokers.filter(b => b.id !== id);
    this.data.properties = this.data.properties.filter(p => p.createdBy !== id);
    this.data.demands = this.data.demands.filter(d => d.createdBy !== id);
    this.data.matches = this.data.matches.filter(m => {
      const prop = this.data.properties.find(p => p.id === m.propertyId);
      const dem = this.data.demands.find(d => d.id === m.demandId);
      return prop || dem;
    });
    this.data.notifications = this.data.notifications.filter(n => n.brokerId !== id);
    this.saveLocal();

    return this.data.brokers.length < lenBefore;
  }

  // Ratings CR
  public createRating(rating: Rating): Rating {
    this.data.ratings.push(rating);
    
    // Recalculate rating score of broker in memory
    const brokerReviews = this.data.ratings.filter(r => r.brokerId === rating.brokerId);
    if (brokerReviews.length > 0) {
      const avg = brokerReviews.reduce((sum, r) => sum + r.score, 0) / brokerReviews.length;
      this._updateBrokerLocal(rating.brokerId, { rating: Number(avg.toFixed(1)) });
    }
    
    this.saveLocal();

    // Background MySQL insert
    this.executeMySQLWrite(
      "INSERT INTO ratings (id, broker_id, rating_by, score, comment) VALUES (?, ?, ?, ?, ?)",
      [rating.id, rating.brokerId, rating.ratingBy, rating.score, rating.comment]
    );

    return rating;
  }

  public getRatingsForBroker(brokerId: string): Rating[] {
    return this.data.ratings.filter(r => r.brokerId === brokerId);
  }

  // Properties CRUD
  public getProperties(): Property[] {
    return this.data.properties;
  }

  public getProperty(id: string): Property | undefined {
    return this.data.properties.find(p => p.id === id);
  }

  public async createProperty(prop: Property): Promise<Property> {
    console.log(`[createProperty] Creating property ${prop.id} (${prop.title})`);

    // Neon-first: write to Neon BEFORE updating local cache
    await this.executeMySQLWriteCritical(
      `INSERT INTO properties (id, title, type, purpose, price, city, neighborhood, description, bedrooms, bathrooms, parking_spots, area, commission, accepts_partnership, condo_fee, iptu, virtual_tour, video_url, status, created_by, photos, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prop.id, prop.title, prop.type, prop.purpose, prop.price, prop.city, prop.neighborhood, prop.description, prop.bedrooms, prop.bathrooms, prop.parkingSpots, prop.area, prop.commission, prop.acceptsPartnership, prop.condoFee || null, prop.iptu || null, prop.virtualTour || null, prop.videoUrl || null, prop.status, prop.createdBy, JSON.stringify(prop.photos || []), prop.latitude || null, prop.longitude || null]
    );

    // Write features
    if (pool && prop.features) {
      for (const f of prop.features) {
        await this.executeMySQLWriteCritical(
          "INSERT INTO property_features (property_id, feature) VALUES (?, ?)",
          [prop.id, f]
        );
      }
    }

    // Neon write succeeded — now update local cache
    this.data.properties.push(prop);
    this.saveLocal();
    console.log(`[createProperty] Property ${prop.id} created in Neon + cached locally`);

    return prop;
  }

  public deleteProperty(id: string): boolean {
    const lenBefore = this.data.properties.length;
    this.data.properties = this.data.properties.filter(p => p.id !== id);

    // Remove orphan matches and their notifications
    const removedMatches = this.data.matches.filter(m => m.propertyId === id);
    this.data.matches = this.data.matches.filter(m => m.propertyId !== id);
    const matchIds = removedMatches.map(m => m.id);
    this.data.notifications = this.data.notifications.filter(n => !matchIds.some(mid => n.message.includes(mid)));
    this.saveLocal();

    // MySQL background delete
    this.executeMySQLWrite("DELETE FROM properties WHERE id = ?", [id]);
    for (const m of removedMatches) {
      this.executeMySQLWrite("DELETE FROM match_history WHERE match_id = ?", [m.id]);
      this.executeMySQLWrite("DELETE FROM matches WHERE id = ?", [m.id]);
      this.executeMySQLWrite("DELETE FROM notifications WHERE message LIKE ?", [`%${m.id}%`]);
    }

    return this.data.properties.length < lenBefore;
  }

  public updateProperty(id: string, updatedFields: Partial<Property>): Property | undefined {
    const prop = this.getProperty(id);
    if (!prop) return undefined;

    // Apply updates locally
    Object.assign(prop, updatedFields);
    this.saveLocal();

    // MySQL background update
    if (pool) {
      const updates: string[] = [];
      const params: any[] = [];
      
      for (const [key, value] of Object.entries(updatedFields)) {
        if (key === "id") continue;
        
        let dbCol: string | null = null;
        let dbVal: any = value;
        
        if (key === "title") dbCol = "title";
        else if (key === "type") dbCol = "type";
        else if (key === "purpose") dbCol = "purpose";
        else if (key === "price") dbCol = "price";
        else if (key === "city") dbCol = "city";
        else if (key === "neighborhood") dbCol = "neighborhood";
        else if (key === "description") dbCol = "description";
        else if (key === "bedrooms") dbCol = "bedrooms";
        else if (key === "bathrooms") dbCol = "bathrooms";
        else if (key === "parkingSpots") dbCol = "parking_spots";
        else if (key === "area") dbCol = "area";
        else if (key === "commission") dbCol = "commission";
        else if (key === "acceptsPartnership") {
          dbCol = "accepts_partnership";
          dbVal = value ? 1 : 0;
        } else if (key === "condoFee") dbCol = "condo_fee";
        else if (key === "iptu") dbCol = "iptu";
        else if (key === "virtualTour") dbCol = "virtual_tour";
        else if (key === "videoUrl") dbCol = "video_url";
        else if (key === "status") dbCol = "status";
        else if (key === "photos") {
          dbCol = "photos";
          dbVal = JSON.stringify(value || []);
        } else if (key === "latitude") {
          dbCol = "latitude";
        } else if (key === "longitude") {
          dbCol = "longitude";
        }
        
        if (dbCol) {
          updates.push(`${dbCol} = ?`);
          params.push(dbVal === undefined ? null : dbVal);
        }
      }

      if (updates.length > 0) {
        params.push(id);
        this.executeMySQLWrite(
          `UPDATE properties SET ${updates.join(", ")} WHERE id = ?`,
          params
        ).catch(err => {
          console.error("Failed MySQL query background update for property:", id, err);
        });
      }
    }

    return prop;
  }

  // Demands CRUD
  public getDemands(): Demand[] {
    return this.data.demands;
  }

  public getDemand(id: string): Demand | undefined {
    return this.data.demands.find(d => d.id === id);
  }

  public async createDemand(demand: Demand): Promise<Demand> {
    console.log(`[createDemand] Creating demand ${demand.id} (${demand.type} - ${demand.city})`);

    // Neon-first: write to Neon BEFORE updating local cache
    await this.executeMySQLWriteCritical(
      `INSERT INTO demands (id, type, purpose, city, max_price, bedrooms, parking_spots, min_area, urgency, payment_method, notes, ia_raw_text, use_ia, cover_photo, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [demand.id, demand.type, demand.purpose, demand.city, demand.maxPrice, demand.bedrooms, demand.parkingSpots, demand.minArea, demand.urgency, demand.paymentMethod, demand.notes || null, demand.iaRawText || null, demand.useIa, demand.coverPhoto || null, demand.status, demand.createdBy]
    );

    // Write neighborhoods
    if (pool && demand.neighborhoods) {
      for (const n of demand.neighborhoods) {
        await this.executeMySQLWriteCritical(
          "INSERT INTO demand_neighborhoods (demand_id, neighborhood) VALUES (?, ?)",
          [demand.id, n]
        );
      }
    }

    // Neon write succeeded — now update local cache
    this.data.demands.push(demand);
    this.saveLocal();
    console.log(`[createDemand] Demand ${demand.id} created in Neon + cached locally`);

    return demand;
  }

  public deleteDemand(id: string): boolean {
    const lenBefore = this.data.demands.length;
    this.data.demands = this.data.demands.filter(d => d.id !== id);

    // Remove orphan matches and their notifications
    const removedMatches = this.data.matches.filter(m => m.demandId === id);
    this.data.matches = this.data.matches.filter(m => m.demandId !== id);
    const matchIds = removedMatches.map(m => m.id);
    this.data.notifications = this.data.notifications.filter(n => !matchIds.some(mid => n.message.includes(mid)));
    this.saveLocal();

    // MySQL Delete
    this.executeMySQLWrite("DELETE FROM demands WHERE id = ?", [id]);
    for (const m of removedMatches) {
      this.executeMySQLWrite("DELETE FROM matches WHERE id = ?", [m.id]);
      this.executeMySQLWrite("DELETE FROM match_history WHERE match_id = ?", [m.id]);
      this.executeMySQLWrite("DELETE FROM notifications WHERE message LIKE ?", [`%${m.id}%`]);
    }

    return this.data.demands.length < lenBefore;
  }

  public updateDemand(id: string, updates: Partial<Demand>): Demand | undefined {
    const dem = this.getDemand(id);
    if (!dem) return undefined;

    Object.assign(dem, updates);
    this.saveLocal();

    if (pool) {
      const cols: string[] = [];
      const params: any[] = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key === "id" || key === "neighborhoods" || key === "createdBy") continue;
        let dbCol = "";
        let dbVal: any = val;
        if (key === "maxPrice") { dbCol = "max_price"; } else
        if (key === "parkingSpots") { dbCol = "parking_spots"; } else
        if (key === "minArea") { dbCol = "min_area"; } else
        if (key === "paymentMethod") { dbCol = "payment_method"; } else
        if (key === "iaRawText") { dbCol = "ia_raw_text"; } else
        if (key === "useIa") { dbCol = "use_ia"; dbVal = val ? 1 : 0; } else
        if (key === "coverPhoto") { dbCol = "cover_photo"; } else
        { dbCol = key; }

        cols.push(`${dbCol} = ?`);
        params.push(dbVal === undefined ? null : dbVal);
      }
      if (cols.length > 0) {
        params.push(id);
        this.executeMySQLWrite(`UPDATE demands SET ${cols.join(", ")} WHERE id = ?`, params).catch(err => {
          console.error("Failed MySQL update for demand:", id, err);
        });
      }
      if (updates.neighborhoods) {
        this.executeMySQLWrite("DELETE FROM demand_neighborhoods WHERE demand_id = ?", [id]).then(() => {
          if (pool && updates.neighborhoods) {
            for (const n of updates.neighborhoods) {
              this.executeMySQLWrite("INSERT INTO demand_neighborhoods (demand_id, neighborhood) VALUES (?, ?)", [id, n]);
            }
          }
        });
      }
    }

    return dem;
  }

  // Matches CRUD
  public getMatches(): Match[] {
    return this.data.matches;
  }

  public getMatch(id: string): Match | undefined {
    return this.data.matches.find(m => m.id === id);
  }

  public createMatch(match: Match): Match {
    this.data.matches.push(match);
    this.saveLocal();

    // Sync match
    this.executeMySQLWrite(
      "INSERT INTO matches (id, property_id, demand_id, score, status, insights) VALUES (?, ?, ?, ?, ?, ?)",
      [match.id, match.propertyId, match.demandId, match.score, match.status, match.insights ? JSON.stringify(match.insights) : null]
    ).then(() => {
      if (match.history && match.history[0]) {
        const h = match.history[0];
        this.executeMySQLWrite(
          "INSERT INTO match_history (match_id, status, updated_by, notes) VALUES (?, ?, ?, ?)",
          [match.id, h.status, h.updatedBy, h.notes || null]
        );
      }
    });

    return match;
  }

  public updateMatchStatus(id: string, status: any, notes?: string, actor?: string): Match {
    const idx = this.data.matches.findIndex(m => m.id === id);
    if (idx !== -1) {
      const match = this.data.matches[idx];
      match.status = status;
      const historyItem: MatchHistory = {
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: actor || "Sistema",
        notes
      };
      match.history.push(historyItem);

      // Increment closed deals both broker targets if closed state
      if (status === "Fechado") {
        const prop = this.getProperty(match.propertyId);
        const dem = this.getDemand(match.demandId);
        if (prop) {
          const brokerProp = this.getBroker(prop.createdBy);
          if (brokerProp) {
            this._updateBrokerLocal(prop.createdBy, { 
              closedDeals: (brokerProp.closedDeals || 0) + 1 
            });
          }
        }
        if (dem) {
          const brokerDem = this.getBroker(dem.createdBy);
          if (brokerDem) {
            this._updateBrokerLocal(dem.createdBy, { 
              closedDeals: (brokerDem.closedDeals || 0) + 1 
            });
          }
        }
      }

      this.saveLocal();

      // Backport MySQL values
      this.executeMySQLWrite("UPDATE matches SET status=? WHERE id=?", [status, id]);
      this.executeMySQLWrite(
        "INSERT INTO match_history (match_id, status, updated_by, notes) VALUES (?, ?, ?, ?)",
        [id, status, actor || "Sistema", notes || null]
      );

      return match;
    }
    throw new Error("Match not found");
  }

  public updateMatch(id: string, updates: Partial<Match>): Match {
    const idx = this.data.matches.findIndex(m => m.id === id);
    if (idx === -1) throw new Error("Match not found");
    const match = this.data.matches[idx];
    Object.assign(match, updates);
    this.saveLocal();
    if (updates.insights) {
      this.executeMySQLWrite("UPDATE matches SET insights=? WHERE id=?", [JSON.stringify(updates.insights), id]);
    }
    return match;
  }

  // Favorites CRUD
  public getFavorites(brokerId: string): Favorite[] {
    return this.data.favorites.filter(f => f.brokerId === brokerId);
  }

  public createFavorite(fav: Favorite): Favorite {
    this.data.favorites.push(fav);
    this.saveLocal();

    // MySQL fav write
    this.executeMySQLWrite(
      "INSERT INTO favorites (id, broker_id, favorite_type, target_id) VALUES (?, ?, ?, ?)",
      [fav.id, fav.brokerId, fav.favoriteType, fav.targetId]
    );

    return fav;
  }

  public deleteFavorite(brokerId: string, favoriteType: string, targetId: string): boolean {
    const lenBefore = this.data.favorites.length;
    this.data.favorites = this.data.favorites.filter(
      f => !(f.brokerId === brokerId && f.favoriteType === favoriteType && f.targetId === targetId)
    );
    this.saveLocal();

    // MySQL DELETE
    this.executeMySQLWrite(
      "DELETE FROM favorites WHERE broker_id = ? AND favorite_type = ? AND target_id = ?",
      [brokerId, favoriteType, targetId]
    );

    return this.data.favorites.length < lenBefore;
  }

  // Notifications
  public getNotifications(brokerId: string): Notification[] {
    return this.data.notifications.filter(n => n.brokerId === brokerId);
  }

  public createNotification(not: Notification): Notification {
    this.data.notifications.push(not);
    this.saveLocal();

    // MySQL INSERT
    this.executeMySQLWrite(
      "INSERT INTO notifications (id, broker_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?, ?)",
      [not.id, not.brokerId, not.title, not.message, not.type, not.read ? 1 : 0]
    );

    return not;
  }

  public markNotificationAsRead(id: string): boolean {
    const idx = this.data.notifications.findIndex(n => n.id === id);
    if (idx !== -1) {
      this.data.notifications[idx].read = true;
      this.saveLocal();

      // MySQL UPDATE
      this.executeMySQLWrite("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
      return true;
    }
    return false;
  }

  public markAllNotificationsAsRead(brokerId: string) {
    this.data.notifications.forEach(n => {
      if (n.brokerId === brokerId) {
        n.read = true;
      }
    });
    this.saveLocal();

    // MySQL UPDATE
    this.executeMySQLWrite("UPDATE notifications SET is_read = 1 WHERE broker_id = ?", [brokerId]);
  }

  public getSettings(): SystemSettings {
    if (!this.data.settings) {
      this.data.settings = {
        geminiApiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || "",
        llmModelName: "openai/gpt-4o-mini",
        llmEndpointUrl: "https://openrouter.ai/api/v1/chat/completions",
        maxPhotosPerProperty: 5,
        s3Url: process.env.S3_URL || "",
        s3AccessKey: process.env.S3_ACCESS_KEY || "",
        s3SecretKey: process.env.S3_SECRET_KEY || "",
        s3BucketName: process.env.S3_BUCKET_NAME || "imob",
        apiKey: "",
        proximityRadius: 10,
        globalCatalogEnabled: false
      };
    } else {
      if (!this.data.settings.s3Url) {
        this.data.settings.s3Url = process.env.S3_URL || "";
        this.data.settings.s3AccessKey = process.env.S3_ACCESS_KEY || "";
        this.data.settings.s3SecretKey = process.env.S3_SECRET_KEY || "";
        this.data.settings.s3BucketName = process.env.S3_BUCKET_NAME || "imob";
      }
      // Backfill OpenRouter endpoint if still pointing to old Gemini URL
      if (this.data.settings.llmEndpointUrl === "https://api.google.com/gemini" || this.data.settings.llmEndpointUrl?.includes("/v1/models") || !this.data.settings.llmEndpointUrl) {
        this.data.settings.llmEndpointUrl = "https://openrouter.ai/api/v1/chat/completions";
      }
      if (this.data.settings.llmModelName?.startsWith("gemini-")) {
        this.data.settings.llmModelName = "openai/gpt-4o-mini";
      }
      // Backfill API key for external demand import
      if (!this.data.settings.apiKey) {
        this.data.settings.apiKey = "";
      }
    }
    return this.data.settings;
  }

  public updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    const current = this.getSettings();
    const filtered: Record<string, any> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[key] = val;
    }
    const updated = { ...current, ...filtered } as SystemSettings;
    this.data.settings = updated;
    this.saveLocal();

    if (updated.geminiApiKey) {
      process.env.LLM_API_KEY = updated.geminiApiKey;
    }

    this.syncSettingsToNeon();

    return updated;
  }

  // ==========================================
  // CITIES / LOCATIONS MANAGEMENT
  // ==========================================

  public getCities(): City[] {
    return this.data.cities || [];
  }

  public addCity(city: City): City {
    this.data.cities = [...(this.data.cities || []), city];
    this.saveLocal();
    return city;
  }

  public updateCity(id: string, updates: Partial<City>): City {
    const idx = (this.data.cities || []).findIndex(c => c.id === id);
    if (idx !== -1) {
      this.data.cities![idx] = { ...this.data.cities![idx], ...updates };
      this.saveLocal();
      return this.data.cities![idx];
    }
    throw new Error("City not found");
  }

  public deleteCity(id: string): void {
    this.data.cities = (this.data.cities || []).filter(c => c.id !== id);
    this.saveLocal();
  }

  public addNeighborhood(cityId: string, neighborhood: string): City {
    const city = this.getCities().find(c => c.id === cityId);
    if (!city) throw new Error("City not found");
    if (!city.neighborhoods.includes(neighborhood)) {
      city.neighborhoods.push(neighborhood);
      this.saveLocal();
    }
    return city;
  }

  public removeNeighborhood(cityId: string, neighborhood: string): City {
    const city = this.getCities().find(c => c.id === cityId);
    if (!city) throw new Error("City not found");
    city.neighborhoods = city.neighborhoods.filter(n => n !== neighborhood);
    this.saveLocal();
    return city;
  }
}

export const db = new OfflineDB();
