import { db } from "./db.js";
import { Property, Demand, Match, Notification } from "../src/types.js";

// Helper function to calculate compatibility score (0-100)
export function calculateMatchScore(property: Property, demand: Demand): number {
  // Reject if different cities or purposes
  if (property.city.toLowerCase() !== demand.city.toLowerCase()) {
    return 0;
  }
  if (property.purpose.toLowerCase() !== demand.purpose.toLowerCase()) {
    return 0;
  }

  let totalPoints = 0;
  let maxPoints = 100;

  // 1. Neighborhood (30 points)
  // If the demand list has specific neighborhoods and includes the property one: 30 pts.
  // If the demand list is empty: 30 pts (implies user is flexible within the city)
  if (demand.neighborhoods.length === 0) {
    totalPoints += 30;
  } else {
    const propertyNeighborhoodLower = property.neighborhood.toLowerCase();
    const hasMatch = demand.neighborhoods.some(n => n.toLowerCase() === propertyNeighborhoodLower);
    if (hasMatch) {
      totalPoints += 30;
    } else {
      // Partial neighborhood match or proximity (e.g. adjacent suburb fallback) -> 10 pts
      totalPoints += 10;
    }
  }

  // 2. Budget / Price compliance (30 points)
  // Absolute match if property price <= maxPrice: 30 pts.
  // Allowed up to 15% budget overflow with partial points: (maxPrice * 1.15)
  if (property.price <= demand.maxPrice) {
    totalPoints += 30;
  } else if (property.price <= demand.maxPrice * 1.15) {
    const overflowPercent = (property.price - demand.maxPrice) / demand.maxPrice; // 0 to 0.15
    const budgetPoints = Math.round(30 * (1 - overflowPercent / 0.15));
    totalPoints += Math.max(0, budgetPoints);
  }

  // 3. Bedrooms count (15 points)
  // Exact or higher bedrooms matched: 15 pts.
  if (property.bedrooms >= demand.bedrooms) {
    totalPoints += 15;
  } else if (property.bedrooms === demand.bedrooms - 1) {
    totalPoints += 5; // close enough
  }

  // 4. Parking Spots (15 points)
  if (property.parkingSpots >= demand.parkingSpots) {
    totalPoints += 15;
  } else if (property.parkingSpots === demand.parkingSpots - 1) {
    totalPoints += 5;
  }

  // 5. Area utility size compatibility (10 points)
  if (property.area >= demand.minArea) {
    totalPoints += 10;
  } else if (property.area >= demand.minArea * 0.8) {
    totalPoints += 5;
  }

  return Math.min(100, Math.max(0, totalPoints));
}

// Automatically loops through all registered properties and demands to check for potential Matches
export function calculateAllNetworkMatches() {
  const properties = db.getProperties().filter(p => p.status === "Ativo");
  const demands = db.getDemands().filter(d => d.status === "Ativo");
  const existingMatches = db.getMatches();

  for (const property of properties) {
    for (const demand of demands) {
      // Prevent matching property and demand created by the same broker! (PRD Section 5 Rules: Brokers cannot partner with themselves)
      if (property.createdBy === demand.createdBy) {
        continue;
      }

      // Check if match already computed
      const alreadyChecked = existingMatches.some(
        m => m.propertyId === property.id && m.demandId === demand.id
      );
      if (alreadyChecked) {
        continue;
      }

      // Compute score
      const score = calculateMatchScore(property, demand);

      // Threshold to established matches is 70% (PRD Section 6.7: Auto-Matchmaking)
      if (score >= 70) {
        const matchId = `match-${property.id.slice(-5)}-${demand.id.slice(-5)}`;
        
        const newMatch: Match = {
          id: matchId,
          propertyId: property.id,
          demandId: demand.id,
          score,
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
        };

        db.createMatch(newMatch);

        // Generate matching real-time alerts for BOTH brokers! (PRD Section 6.8 & 6.9)
        const brokerProp = db.getBroker(property.createdBy);
        const brokerDem = db.getBroker(demand.createdBy);

        if (brokerProp) {
          const propNotification: Notification = {
            id: `not-prop-${Date.now()}-${matchId.slice(-6)}`,
            brokerId: brokerProp.id,
            title: "Temos um Novo Match Comercial! 🎯",
            message: `Seu imóvel '${property.title}' obteve ${score}% de compatibilidade com a procura cadastrada pelo corretor ${brokerDem?.name || "Parceiro"}.`,
            type: "match",
            read: false,
            createdAt: new Date().toISOString()
          };
          db.createNotification(propNotification);
        }

        if (brokerDem) {
          const demNotification: Notification = {
            id: `not-dem-${Date.now()}-${matchId.slice(-6)}`,
            brokerId: brokerDem.id,
            title: "Sua Procura Gerou um Match! 🥳",
            message: `A procura de imóvel pelo seu cliente gerou um Match de ${score}% com o imóvel oferecido pelo corretor ${brokerProp?.name || "Parceiro"}.`,
            type: "match",
            read: false,
            createdAt: new Date().toISOString()
          };
          db.createNotification(demNotification);
        }
      }
    }
  }
}

// Trigger match calculation on specific property release
export function triggerMatchCalculationForProperty(property: Property) {
  const demands = db.getDemands().filter(d => d.status === "Ativo");
  const existingMatches = db.getMatches();

  for (const demand of demands) {
    if (property.createdBy === demand.createdBy) {
      continue;
    }

    const alreadyChecked = existingMatches.some(
      m => m.propertyId === property.id && m.demandId === demand.id
    );
    if (alreadyChecked) {
      continue;
    }

    const score = calculateMatchScore(property, demand);

    if (score >= 70) {
      const matchId = `match-${property.id.slice(-5)}-${demand.id.slice(-5)}`;
      const newMatch: Match = {
        id: matchId,
        propertyId: property.id,
        demandId: demand.id,
        score,
        status: "Novo",
        createdAt: new Date().toISOString(),
        history: [
          {
            status: "Novo",
            updatedAt: new Date().toISOString(),
            updatedBy: "Sistema",
            notes: "Match estipulado após inserção de nova captação de imóvel pela plataforma."
          }
        ]
      };

      db.createMatch(newMatch);

      const brokerProp = db.getBroker(property.createdBy);
      const brokerDem = db.getBroker(demand.createdBy);

      if (brokerProp) {
        db.createNotification({
          id: `not-prop-${Date.now()}`,
          brokerId: brokerProp.id,
          title: "Novo Match para sua Captação! 🎯",
          message: `Seu anúncio recém-criado '${property.title}' casou ${score}% com a procura de ${brokerDem?.name || "Parceiro"}.`,
          type: "match",
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      if (brokerDem) {
        db.createNotification({
          id: `not-dem-${Date.now()}`,
          brokerId: brokerDem.id,
          title: "Match de Imóvel Recém-Postado! ✨",
          message: `Uma nova captação do corretor ${brokerProp?.name || "Parceiro"} tem ${score}% de sinergia com o perfil do seu comprador.`,
          type: "match",
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }
  }
}

// Trigger match calculation on specific buyer demand release
export function triggerMatchCalculationForDemand(demand: Demand) {
  const properties = db.getProperties().filter(p => p.status === "Ativo");
  const existingMatches = db.getMatches();

  for (const property of properties) {
    if (property.createdBy === demand.createdBy) {
      continue;
    }

    const alreadyChecked = existingMatches.some(
      m => m.propertyId === property.id && m.demandId === demand.id
    );
    if (alreadyChecked) {
      continue;
    }

    const score = calculateMatchScore(property, demand);

    if (score >= 70) {
      const matchId = `match-${property.id.slice(-5)}-${demand.id.slice(-5)}`;
      const newMatch: Match = {
        id: matchId,
        propertyId: property.id,
        demandId: demand.id,
        score,
        status: "Novo",
        createdAt: new Date().toISOString(),
        history: [
          {
            status: "Novo",
            updatedAt: new Date().toISOString(),
            updatedBy: "Sistema",
            notes: "Match estipulado após inserção de nova procura de cliente pela rede."
          }
        ]
      };

      db.createMatch(newMatch);

      const brokerProp = db.getBroker(property.createdBy);
      const brokerDem = db.getBroker(demand.createdBy);

      if (brokerProp) {
        db.createNotification({
          id: `not-prop-${Date.now()}`,
          brokerId: brokerProp.id,
          title: "Sua Captação Casou com Procura! 🎯",
          message: `O corretor ${brokerDem?.name || "Parceiro"} cadastrou uma procura que bate ${score}% com seu imóvel '${property.title}'.`,
          type: "match",
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      if (brokerDem) {
        db.createNotification({
          id: `not-dem-${Date.now()}`,
          brokerId: brokerDem.id,
          title: "Novo Match Imediato Encontrado! 🥳",
          message: `Sua nova procura ativada casou ${score}% com o anúncio de ${brokerProp?.name || "Parceiro"} em ${property.neighborhood}.`,
          type: "match",
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }
  }
}
