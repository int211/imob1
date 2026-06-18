import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { interpretDemand, getMatchInsights, optimizeListing, testConnection, listModels } from "./openrouter.js";
import { calculateAllNetworkMatches, triggerMatchCalculationForProperty, triggerMatchCalculationForDemand } from "./matcher.js";
import { Corretor, Property, Demand, Match, Notification, Rating, Favorite } from "../src/types.js";
import { authMiddleware, adminMiddleware, setAuthCookie, clearAuthCookie, AuthPayload } from "./auth.js";

dotenv.config();

import { db, dbStatus } from "./db.js";

export async function createApp() {
  await db.waitForInit();
  const app = express();

  app.use(cookieParser());

  const allowedOrigins = process.env.CORS_ORIGIN || "";
  app.use((_req, res, next) => {
    const origin = _req.headers.origin || "";
    if (allowedOrigins) {
      const allowed = allowedOrigins.split(",").map(o => o.trim());
      if (allowed.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
    } else if (process.env.NODE_ENV !== "production") {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use((req, _res, next) => {
    console.log(`[request] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  const getContextUser = (req: express.Request): Corretor | null => {
    const auth = (req as any).auth as AuthPayload | undefined;
    if (!auth) return null;
    return db.getBroker(auth.brokerId) || null;
  };

  // ==================== PUBLIC AUTH ENDPOINTS (no middleware) ====================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      }

      const broker = db.getBrokerByEmail(email);
      if (!broker) {
        return res.status(401).json({ error: "E-mail não encontrado." });
      }

      const valid = await db.validatePassword(broker.id, password);
      if (!valid) {
        return res.status(401).json({ error: "Senha incorreta." });
      }

      setAuthCookie(res, { brokerId: broker.id, isAdmin: !!broker.isAdmin });
      console.log("[login] success:", broker.id);
      res.json(broker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, creci, phone, city, password } = req.body;
      if (!name || !email || !creci) {
        return res.status(400).json({ error: "Nome, E-mail e número do CRECI são obrigatórios." });
      }

      const brokers = await db.fetchBrokersFromMySQL();
      const exist = brokers.find(b => b.email.toLowerCase() === email.toLowerCase() || b.creci === creci);
      if (exist) {
        setAuthCookie(res, { brokerId: exist.id, isAdmin: !!exist.isAdmin });
        return res.status(200).json(exist);
      }

      const id = `broker-${Date.now()}`;
      const newBroker: Corretor = {
        id,
        name,
        email,
        creci,
        phone: phone || "+55 (71) 99999-0000",
        whatsapp: phone ? phone.replace(/\D/g, "") : "5571999990000",
        city: city || "Salvador",
        status: "Pendente",
        photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        rating: 5.0,
        respondingRate: 100,
        closedDeals: 0,
        isAdmin: false,
        specialties: ["Lançamentos residenciais", "Parcerias ágeis"]
      };

      await db.createBroker(newBroker);
      await db.setPassword(id, password || "123456");

      setAuthCookie(res, { brokerId: id, isAdmin: false });
      res.status(201).json(newBroker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  // Public settings (no auth needed for frontend bootstrap)
  app.get("/api/settings", (_req, res) => {
    try {
      const s = db.getSettings();
      res.json({ maxPhotosPerProperty: s.maxPhotosPerProperty, proximityRadius: s.proximityRadius || 10, globalCatalogEnabled: !!s.globalCatalogEnabled });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cities", (_req, res) => {
    try {
      res.json(db.getCities());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // S3 file proxy (public, images are not secret)
  app.get("/api/files/:bucket/*", async (req, res) => {
    const bucket = req.params.bucket;
    const key = (req.params as any)[0];
    if (!bucket || !key) {
      return res.status(400).json({ error: "Missing bucket or key" });
    }
    try {
      const settings = db.getSettings();
      if (!settings.s3AccessKey || !settings.s3SecretKey) {
        return res.status(500).json({ error: "S3 credentials not configured" });
      }
      const s3Client = new S3Client({
        endpoint: settings.s3Url || "",
        region: "us-east-1",
        credentials: {
          accessKeyId: settings.s3AccessKey,
          secretAccessKey: settings.s3SecretKey,
        },
        forcePathStyle: true,
      });
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3Client.send(command);
      const contentType = response.ContentType || "image/jpeg";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=31536000");
      if (response.Body) {
        const body = response.Body as any;
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        res.send(Buffer.concat(chunks));
      }
    } catch (err: any) {
      res.status(404).json({ error: "File not found" });
    }
  });

  // ==================== EXTERNAL DEMAND IMPORT (API Key auth, no JWT) ====================

  app.post("/api/demands/import", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      const settings = db.getSettings();
      if (!settings.apiKey || apiKey !== settings.apiKey) {
        return res.status(401).json({ error: "API key inválida ou não configurada." });
      }

      const { type, purpose, city, neighborhoods, maxPrice, bedrooms, parkingSpots, minArea, urgency, paymentMethod, notes, name, phone, email } = req.body;

      if (!maxPrice || !paymentMethod) {
        return res.status(400).json({ error: "maxPrice e paymentMethod são obrigatórios." });
      }

      const id = `dem-ext-${Date.now()}`;
      const newDemand: Demand = {
        id,
        type: type || "apartamento",
        purpose: purpose || "venda",
        city: city || "Salvador",
        neighborhoods: neighborhoods || [],
        maxPrice,
        bedrooms: bedrooms || 0,
        parkingSpots: parkingSpots || 0,
        minArea: minArea || 0,
        urgency: urgency || "média",
        paymentMethod,
        notes: notes ? `${notes}${name ? `\nNome: ${name}` : ""}${phone ? `\nTel: ${phone}` : ""}${email ? `\nEmail: ${email}` : ""}` : `Importado via API externa${name ? `\nNome: ${name}` : ""}${phone ? `\nTel: ${phone}` : ""}${email ? `\nEmail: ${email}` : ""}`,
        status: "Ativo",
        createdAt: new Date().toISOString(),
        createdBy: "api-import"
      };

      await db.createDemand(newDemand);
      triggerMatchCalculationForDemand(newDemand);

      res.status(201).json({ success: true, demandId: id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== AUTH MIDDLEWARE — all routes below require login ====================
  app.use("/api", authMiddleware);

  app.get("/api/auth/me", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/verify-docs", async (req, res) => {
    try {
      const { creciDoc, identDoc } = req.body;
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });

      if (!creciDoc || !identDoc) {
        return res.status(400).json({ error: "Documento de Identidade e do CRECI são fundamentais para validação." });
      }
      
      await db.updateBroker(user.id, {
        status: "Pendente",
        identDocUrl: identDoc,
        creciDocUrl: creciDoc
      });

      const adminNot: Notification = {
        id: `not-admin-${Date.now()}`,
        brokerId: "broker-renato",
        title: "Nova Solicitação de Homologação 📝",
        message: `${user.name} enviou documentos de CRECI para validação.`,
        type: "verification",
        read: false,
        createdAt: new Date().toISOString()
      };
      db.createNotification(adminNot);

      res.json({ status: "success", message: "Documentos enviados com sucesso para análise da equipe." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== PROPERTIES MIDDLEWARE ====================

  app.get("/api/properties", (req, res) => {
    try {
      res.json(db.getProperties());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/properties/optimize", async (req, res) => {
    try {
      const { title, type, price, city, neighborhood, description, features } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: "Título e descrição originais são necessários." });
      }
      const suggestions = await optimizeListing({ title, type, price, city, neighborhood, description, features });
      res.json(suggestions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  app.post("/api/properties", async (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });

      if (user.status !== "Aprovado") {
        return res.status(403).json({
          error: "Sua conta de corretor ainda não foi aprovada pelo Administrador. Por favor, envie seus comprovantes do CRECI."
        });
      }

      const {
        title, type, purpose, price, city, neighborhood, description,
        bedrooms, bathrooms, parkingSpots, area, commission, acceptsPartnership,
        features, condoFee, iptu, virtualTour, videoUrl, photos,
        latitude, longitude
      } = req.body;

      if (!title || !price || !neighborhood || !description || !commission) {
        return res.status(400).json({ error: "Faltam parâmetros obrigatórios para a captação." });
      }

      // Proximity duplicate check
      if (latitude && longitude) {
        const settings = db.getSettings();
        const radius = settings.proximityRadius || 10;
        const allProperties = db.getProperties();
        for (const existing of allProperties) {
          if (existing.latitude && existing.longitude) {
            const dist = haversineMeters(latitude, longitude, existing.latitude, existing.longitude);
            if (dist <= radius) {
              return res.status(409).json({
                error: `Já existe um imóvel cadastrado nesta localização (${dist.toFixed(0)}m de distância, raio de ${radius}m). Outro corretor já captou este imóvel.`
              });
            }
          }
        }
      }

      const settings = db.getSettings();
      let propertyPhotos = Array.isArray(photos) ? photos : [];
      if (propertyPhotos.length > settings.maxPhotosPerProperty) {
        propertyPhotos = propertyPhotos.slice(0, settings.maxPhotosPerProperty);
      }

      const id = `prop-${Date.now()}`;
      const newProperty: Property = {
        id,
        title,
        type,
        purpose,
        price,
        city,
        neighborhood,
        description,
        bedrooms: bedrooms || 0,
        bathrooms: bathrooms || 0,
        parkingSpots: parkingSpots || 0,
        area: area || 0,
        commission,
        acceptsPartnership: acceptsPartnership !== false,
        features: features || [],
        condoFee,
        iptu,
        virtualTour,
        videoUrl,
        status: "Ativo",
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        photos: propertyPhotos,
        latitude: latitude || undefined,
        longitude: longitude || undefined
      };

      await db.createProperty(newProperty);
      triggerMatchCalculationForProperty(newProperty);

      res.status(201).json(newProperty);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/properties/:id", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const propId = req.params.id;
      const prop = db.getProperty(propId);

      if (!prop) {
        return res.status(404).json({ error: "Imóvel não encontrado." });
      }

      if (prop.createdBy !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Você não tem autorização para excluir este anúncio." });
      }

      db.deleteProperty(propId);
      res.json({ success: true, message: "Imóvel excluído do catálogo." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/properties/:id", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const propId = req.params.id;
      const prop = db.getProperty(propId);

      if (!prop) {
        return res.status(404).json({ error: "Imóvel não encontrado." });
      }

      if (prop.createdBy !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Você não tem autorização para editar este anúncio." });
      }

      const {
        title, type, purpose, price, city, neighborhood, description,
        bedrooms, bathrooms, parkingSpots, area, commission,
        acceptsPartnership, condoFee, iptu, virtualTour, videoUrl, status, photos
      } = req.body;

      const updatedFields: any = {};
      if (title !== undefined) updatedFields.title = title;
      if (type !== undefined) updatedFields.type = type;
      if (purpose !== undefined) updatedFields.purpose = purpose;
      if (price !== undefined) updatedFields.price = price;
      if (city !== undefined) updatedFields.city = city;
      if (neighborhood !== undefined) updatedFields.neighborhood = neighborhood;
      if (description !== undefined) updatedFields.description = description;
      if (bedrooms !== undefined) updatedFields.bedrooms = bedrooms;
      if (bathrooms !== undefined) updatedFields.bathrooms = bathrooms;
      if (parkingSpots !== undefined) updatedFields.parkingSpots = parkingSpots;
      if (area !== undefined) updatedFields.area = area;
      if (commission !== undefined) updatedFields.commission = commission;
      if (acceptsPartnership !== undefined) updatedFields.acceptsPartnership = acceptsPartnership;
      if (condoFee !== undefined) updatedFields.condoFee = condoFee;
      if (iptu !== undefined) updatedFields.iptu = iptu;
      if (virtualTour !== undefined) updatedFields.virtualTour = virtualTour;
      if (videoUrl !== undefined) updatedFields.videoUrl = videoUrl;
      if (status !== undefined) updatedFields.status = status;
      if (photos !== undefined) updatedFields.photos = photos;

      const updatedProp = db.updateProperty(propId, updatedFields);
      if (!updatedProp) {
        return res.status(500).json({ error: "Falha ao atualizar imóvel no banco de dados." });
      }

      triggerMatchCalculationForProperty(updatedProp);

      res.json(updatedProp);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== BUYER DEMANDS MIDDLEWARE ====================

  app.get("/api/demands", (req, res) => {
    try {
      res.json(db.getDemands());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/demands", async (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });

      if (user.status !== "Aprovado") {
        return res.status(403).json({
          error: "Sua conta de corretor deve estar aprovada para registrar procuras de clientes."
        });
      }

      const {
        useIa, iaRawText, type, purpose, city, neighborhoods, maxPrice,
        bedrooms, parkingSpots, minArea, urgency, paymentMethod, notes, coverPhoto
      } = req.body;

      if (useIa && iaRawText && !maxPrice) {
        const structuredCriteria = await interpretDemand(iaRawText, city || "Salvador");
        return res.json({
          status: "success",
          iaStructuredCriteria: structuredCriteria
        });
      }

      if (!maxPrice || !paymentMethod) {
        return res.status(400).json({ error: "Teto de orçamento e forma de pagamento do comprador são fundamentais." });
      }

      const id = `dem-${Date.now()}`;
      const newDemand: Demand = {
        id,
        type: type || "apartamento",
        purpose: purpose || "venda",
        city: city || "Salvador",
        neighborhoods: neighborhoods || [],
        maxPrice,
        bedrooms: bedrooms || 0,
        parkingSpots: parkingSpots || 0,
        minArea: minArea || 0,
        urgency: urgency || "média",
        paymentMethod,
        notes,
        iaRawText: useIa ? iaRawText : undefined,
        useIa,
        coverPhoto: coverPhoto || undefined,
        status: "Ativo",
        createdAt: new Date().toISOString(),
        createdBy: user.id
      };

      await db.createDemand(newDemand);
      triggerMatchCalculationForDemand(newDemand);

      res.status(201).json(newDemand);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/demands/:id", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const demandId = req.params.id;
      const dem = db.getDemand(demandId);

      if (!dem) {
        return res.status(404).json({ error: "Procura não cadastrada." });
      }

      if (dem.createdBy !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Você não possui permissão para apagar esta procura." });
      }

      db.deleteDemand(demandId);
      res.json({ success: true, message: "Procura excluída de maneira permanente." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/demands/:id", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const demId = req.params.id;
      const dem = db.getDemand(demId);

      if (!dem) {
        return res.status(404).json({ error: "Procura não encontrada." });
      }

      if (dem.createdBy !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Você não tem permissão para editar esta procura." });
      }

      const updates: any = {};
      const fields = ["type","purpose","city","maxPrice","bedrooms","parkingSpots","minArea","urgency","paymentMethod","notes","iaRawText","useIa","coverPhoto","status","neighborhoods"];
      for (const f of fields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }

      const updated = db.updateDemand(demId, updates);
      if (!updated) {
        return res.status(500).json({ error: "Falha ao atualizar procura." });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ==================== MATCHES & STRATEGIC INSIGHTS ====================

  app.get("/api/matches", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });

      const allMatches = db.getMatches();

      const myMatches = allMatches.filter(m => {
        const prop = db.getProperty(m.propertyId);
        const dem = db.getDemand(m.demandId);
        return (prop && prop.createdBy === user.id) || (dem && dem.createdBy === user.id);
      });

      const hydrated = myMatches.map(m => {
        const prop = db.getProperty(m.propertyId);
        const dem = db.getDemand(m.demandId);
        const bProp = prop ? db.getBroker(prop.createdBy) : null;
        const bDem = dem ? db.getBroker(dem.createdBy) : null;

        return {
          ...m,
          propertyTitle: prop?.title,
          propertyPrice: prop?.price,
          propertyCreatedBy: prop?.createdBy,
          property: prop,
          demand: dem,
          brokerProperty: bProp ? {
            id: bProp.id,
            name: bProp.name,
            creci: bProp.creci,
            phone: bProp.phone,
            whatsapp: bProp.whatsapp,
            photoUrl: bProp.photoUrl,
            status: bProp.status
          } : null,
          brokerDemand: bDem ? {
            id: bDem.id,
            name: bDem.name,
            creci: bDem.creci,
            phone: bDem.phone,
            whatsapp: bDem.whatsapp,
            photoUrl: bDem.photoUrl,
            status: bDem.status
          } : null
        };
      });

      res.json(hydrated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/matches/:id/status", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const matchId = req.params.id;
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Indique o novo status desejado." });
      }

      const match = db.updateMatchStatus(matchId, status, notes, user.name);

      const prop = db.getProperty(match.propertyId);
      const dem = db.getDemand(match.demandId);
      const otherPartyId = prop?.createdBy === user.id ? dem?.createdBy : prop?.createdBy;

      if (otherPartyId) {
        db.createNotification({
          id: `not-status-${Date.now()}`,
          brokerId: otherPartyId,
          title: "Parceria Atualizada! 🤝",
          message: `${user.name} moveu o Match da parceria para o status '${status}'. Detalhes: ${notes || "Sem notas adicionais."}`,
          type: "partnership",
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      res.json(match);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/matches/:id/insights", async (req, res) => {
    try {
      const matchId = req.params.id;
      const match = db.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ error: "Match não localizado na base." });
      }

      const prop = db.getProperty(match.propertyId);
      const dem = db.getDemand(match.demandId);

      if (!prop || !dem) {
        return res.status(400).json({ error: "Atributos imobiliários vinculados estão inacessíveis." });
      }

      const insights = await getMatchInsights(prop, dem, match.score, matchId);
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== REVIEWS / FEEDBACK NETWORK ====================

  app.post("/api/brokers/:id/reviews", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const targetBrokerId = req.params.id;
      const { score, comment } = req.body;

      if (!score || !comment) {
        return res.status(400).json({ error: "Sua nota de 1 a 5 estrelas e um breve comentário profissional são necessários." });
      }

      const newRating: Rating = {
        id: `rating-${Date.now()}`,
        brokerId: targetBrokerId,
        ratingBy: user.name,
        score,
        comment,
        createdAt: new Date().toISOString()
      };

      db.createRating(newRating);

      db.createNotification({
        id: `not-review-${Date.now()}`,
        brokerId: targetBrokerId,
        title: "Você recebeu uma Avaliação Estrela! ⭐",
        message: `${user.name} avaliou sua conduta profissional com nota ${score}/5 estrelas.`,
        type: "partnership",
        read: false,
        createdAt: new Date().toISOString()
      });

      res.status(201).json(newRating);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== FAVORITES & NOTIFICATIONS ====================

  app.get("/api/favorites", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      res.json(db.getFavorites(user.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/favorites", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const { favoriteType, targetId } = req.body;

      const newFav: Favorite = {
        id: `fav-${Date.now()}`,
        brokerId: user.id,
        favoriteType,
        targetId,
        createdAt: new Date().toISOString()
      };

      db.createFavorite(newFav);
      res.status(201).json(newFav);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/favorites/:type/:targetId", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      const { type, targetId } = req.params;
      db.deleteFavorite(user.id, type, targetId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/notifications", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      res.json(db.getNotifications(user.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/notifications/:id/read", (req, res) => {
    try {
      const success = db.markNotificationAsRead(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/read-all", (req, res) => {
    try {
      const user = getContextUser(req);
      if (!user) return res.status(401).json({ error: "Não autenticado." });
      db.markAllNotificationsAsRead(user.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== ADMIN MIDDLEWARE — all /api/admin/* routes below ====================
  app.use("/api/admin", adminMiddleware);

  // ==================== DATABASE CONTROL PANEL ENDPOINTS ====================

  app.get("/api/admin/db-status", async (req, res) => {
    try {
      const liveCounts: any = {};

      const { pool } = await import("./db.js");
      if (pool) {
        try {
          const { rows: brokers }: any = await pool.query("SELECT COUNT(*) as count FROM corretores");
          const { rows: properties }: any = await pool.query("SELECT COUNT(*) as count FROM properties");
          const { rows: demands }: any = await pool.query("SELECT COUNT(*) as count FROM demands");
          const { rows: matches }: any = await pool.query("SELECT COUNT(*) as count FROM matches");
          const { rows: ratings }: any = await pool.query("SELECT COUNT(*) as count FROM ratings");
          const { rows: notifications }: any = await pool.query("SELECT COUNT(*) as count FROM notifications");
          const { rows: favorites }: any = await pool.query("SELECT COUNT(*) as count FROM favorites");

          liveCounts.brokers = brokers[0]?.count || 0;
          liveCounts.properties = properties[0]?.count || 0;
          liveCounts.demands = demands[0]?.count || 0;
          liveCounts.matches = matches[0]?.count || 0;
          liveCounts.ratings = ratings[0]?.count || 0;
          liveCounts.notifications = notifications[0]?.count || 0;
          liveCounts.favorites = favorites[0]?.count || 0;
        } catch (sqlErr: any) {
          liveCounts.error = sqlErr.message;
        }
      }

      res.json({
        status: dbStatus,
        memoryCounts: {
          brokers: db.getBrokers().length,
          properties: db.getProperties().length,
          demands: db.getDemands().length,
          matches: db.getMatches().length,
          ratings: db.getRatingsForBroker("broker-renato").length,
        },
        liveCounts
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/db-sync", async (req, res) => {
    try {
      await db.syncFromMySQL();
      res.json({ success: true, message: "Banco de dados sincronizado com sucesso da VPS em tempo real!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/db-seed", async (req, res) => {
    try {
      await db.seedToMySQL();
      await db.syncFromMySQL();
      res.json({ success: true, message: "Tabelas do banco de dados na VPS alimentadas com sucesso!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== ADMINISTRATOR MODERATION ====================

  app.get("/api/admin/metrics", async (req, res) => {
    try {
      const brokers = await db.fetchBrokersFromMySQL();
      const properties = db.getProperties();
      const demands = db.getDemands();
      const matches = db.getMatches();

      res.json({
        totalBrokers: brokers.length,
        pendingVerifications: brokers.filter(b => b.status === "Pendente").length,
        totalProperties: properties.length,
        totalDemands: demands.length,
        closedDeals: matches.filter(m => m.status === "Fechado").length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/brokers", async (req, res) => {
    try {
      const brokers = await db.fetchBrokersFromMySQL();
      res.json(brokers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/settings", (req, res) => {
    try {
      res.json(db.getSettings());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/settings", (req, res) => {
    try {
      const { geminiApiKey, llmModelName, llmEndpointUrl, maxPhotosPerProperty, s3Url, s3AccessKey, s3SecretKey, s3BucketName, apiKey, proximityRadius, globalCatalogEnabled } = req.body;
      const updated = db.updateSettings({
        geminiApiKey,
        llmModelName,
        llmEndpointUrl,
        maxPhotosPerProperty: maxPhotosPerProperty ? Number(maxPhotosPerProperty) : 5,
        s3Url,
        s3AccessKey,
        s3SecretKey,
        s3BucketName,
        apiKey,
        proximityRadius: proximityRadius ? Number(proximityRadius) : 10,
        globalCatalogEnabled: globalCatalogEnabled !== undefined ? Boolean(globalCatalogEnabled) : undefined
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/test-llm", async (req, res) => {
    try {
      const { apiKey, model } = req.body;
      const response = await testConnection(apiKey, model);
      res.json({ success: true, response });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/llm-models", async (_req, res) => {
    try {
      console.log("[llm-models] Fetching models from OpenRouter...");
      const models = await listModels();
      console.log(`[llm-models] Success: ${models.length} models returned`);
      res.json(models);
    } catch (err: any) {
      console.error("[llm-models] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/profile", async (req, res) => {
    try {
      const { id, name, email, creci, phone, photoUrl, city, newPassword } = req.body;
      if (!id) {
        return res.status(400).json({ error: "ID do corretor administrador é válido e obrigatório." });
      }
      const updated = await db.updateBroker(id, { name, email, creci, phone, photoUrl, city });
      if (newPassword) {
        await db.setPassword(id, newPassword);
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/upload", async (req, res) => {
    try {
      const { base64Data, filename } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: "Base64 data de imagem é obrigatório." });
      }

      const settings = db.getSettings();
      const s3Url = settings.s3Url || process.env.S3_URL || "";
      const s3AccessKey = settings.s3AccessKey || process.env.S3_ACCESS_KEY || "";
      const s3SecretKey = settings.s3SecretKey || process.env.S3_SECRET_KEY || "";
      const s3BucketName = settings.s3BucketName || process.env.S3_BUCKET_NAME || "imob";

      if (!s3AccessKey || !s3SecretKey || !s3Url) {
        return res.status(500).json({ error: "S3 credentials not configured. Set S3_URL, S3_ACCESS_KEY, S3_SECRET_KEY in environment." });
      }

      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let mimeType = "image/jpeg";
      let buffer: Buffer;

      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(base64Data, "base64");
      }

      let extension = "jpg";
      if (mimeType.includes("png")) {
        extension = "png";
      } else if (mimeType.includes("webp")) {
        extension = "webp";
      } else if (mimeType.includes("gif")) {
        extension = "gif";
      }

      const cleanFilename = filename ? filename.replace(/[^a-zA-Z0-9.-]/g, "_") : `photo-${Date.now()}.${extension}`;
      const uniqueKey = `uploads/prop-${Date.now()}-${Math.floor(Math.random() * 10000)}-${cleanFilename}`;

      const s3Client = new S3Client({
        endpoint: s3Url,
        region: "us-east-1",
        credentials: {
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
        },
        forcePathStyle: true,
      });

      const command = new PutObjectCommand({
        Bucket: s3BucketName,
        Key: uniqueKey,
        Body: buffer,
        ContentType: mimeType,
      });

      await s3Client.send(command);

      const fileUrl = `/api/files/${s3BucketName}/${uniqueKey}`;
      res.json({ url: fileUrl });
    } catch (err: any) {
      console.error("Error uploading to S3/MinIO:", err);
      res.status(500).json({ error: `S3 Upload Fail: ${err.message}` });
    }
  });

  // ==================== CITIES / LOCATIONS MANAGEMENT (admin) ====================

  app.get("/api/admin/cities", (req, res) => {
    try {
      res.json(db.getCities());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/cities", (req, res) => {
    try {
      const { id, name, neighborhoods } = req.body;
      if (!id || !name) {
        return res.status(400).json({ error: "ID e nome da cidade são obrigatórios." });
      }
      const city = db.addCity({ id, name, neighborhoods: neighborhoods || [] });
      res.status(201).json(city);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/admin/cities/:id", (req, res) => {
    try {
      const { name, neighborhoods } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (neighborhoods !== undefined) updates.neighborhoods = neighborhoods;
      const updated = db.updateCity(req.params.id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/cities/:id", (req, res) => {
    try {
      db.deleteCity(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/cities/:id/neighborhoods", (req, res) => {
    try {
      const { neighborhood } = req.body;
      if (!neighborhood) return res.status(400).json({ error: "Nome do bairro é obrigatório." });
      const updated = db.addNeighborhood(req.params.id, neighborhood);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/cities/:id/neighborhoods/:neighborhood", (req, res) => {
    try {
      const updated = db.removeNeighborhood(req.params.id, decodeURIComponent(req.params.neighborhood));
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/verify", async (req, res) => {
    try {
      const { brokerId, action, reason } = req.body;
      if (!brokerId || !action) {
        return res.status(400).json({ error: "Indique o brokerId e a homologação desejada." });
      }

      const newStatus = action === "Aprovar" ? "Aprovado" : "Rejeitado";
      await db.updateBroker(brokerId, { status: newStatus });

      const msgTitle = action === "Aprovar" ? "Seu CRECI foi Aprovado! 🎉" : "Comprobante CRECI recusado ❌";
      const msgText = action === "Aprovar"
        ? "Parabéns! Sua documentação passou em nossa verificação. Agora você tem passe livre para anunciar captações e interagir em matches!"
        : `Identificamos uma inconsistência em seus documentos profissionais. Detalhes: ${reason || "Por favor, reenvie fotos legíveis."}`;

      db.createNotification({
        id: `not-approval-${Date.now()}`,
        brokerId,
        title: msgTitle,
        message: msgText,
        type: "verification",
        read: false,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, status: newStatus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/toggle-admin", async (req, res) => {
    try {
      const { brokerId, isAdmin } = req.body;
      if (!brokerId || isAdmin === undefined) {
        return res.status(400).json({ error: "brokerId and isAdmin required" });
      }
      const updated = await db.updateBroker(brokerId, { isAdmin: Boolean(isAdmin) });
      res.json({ success: true, broker: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete broker
  app.delete("/api/admin/brokers/:id", async (req, res) => {
    try {
      const deleted = await db.deleteBroker(req.params.id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Corretor não encontrado" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update broker fields (edit)
  app.put("/api/admin/brokers/:id", async (req, res) => {
    try {
      const { name, email, phone, whatsapp, city, creci, status, password, photoUrl, specialties } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (whatsapp !== undefined) updates.whatsapp = whatsapp;
      if (city !== undefined) updates.city = city;
      if (creci !== undefined) updates.creci = creci;
      if (status !== undefined) updates.status = status;
      if (photoUrl !== undefined) updates.photoUrl = photoUrl;
      if (specialties !== undefined) updates.specialties = specialties;
      let updated;
      if (Object.keys(updates).length > 0) {
        updated = await db.updateBroker(req.params.id, updates);
      } else {
        updated = db.getBroker(req.params.id);
      }
      if (password) {
        await db.setPassword(req.params.id, password);
      }
      res.json({ success: true, broker: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/impersonate/:id", (req, res) => {
    try {
      const target = db.getBroker(req.params.id);
      if (!target) return res.status(404).json({ error: "Corretor não encontrado." });
      setAuthCookie(res, { brokerId: target.id, isAdmin: !!target.isAdmin });
      res.json(target);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
