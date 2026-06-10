export type PropertyType = "apartamento" | "casa" | "terreno" | "cobertura" | "comercial" | "outro";
export type PurposeType = "venda" | "locação";
export type MatchStatus = "Novo" | "Visualizado" | "Em contato" | "Em negociação" | "Fechado" | "Perdido";
export type UrgencyType = "baixa" | "média" | "alta";

export interface Corretor {
  id: string;
  name: string;
  email: string;
  creci: string;
  phone: string;
  whatsapp?: string;
  city: string;
  status: "Pendente" | "Aprovado" | "Rejeitado";
  photoUrl?: string;
  rating?: number;
  respondingRate?: number;
  closedDeals?: number;
  isAdmin?: boolean;
  specialties?: string[];
  identDocUrl?: string;
  creciDocUrl?: string;
}

export interface Property {
  id: string;
  title: string;
  type: PropertyType;
  purpose: PurposeType;
  price: number;
  city: string;
  neighborhood: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpots: number;
  area: number;
  commission: string;
  acceptsPartnership: boolean;
  features: string[];
  condoFee?: number;
  iptu?: number;
  virtualTour?: string;
  videoUrl?: string;
  status: "Ativo" | "Inativo";
  createdAt: string;
  createdBy: string;
  photos?: string[];
  latitude?: number;
  longitude?: number;
}

export interface Demand {
  id: string;
  type: PropertyType;
  purpose: PurposeType;
  city: string;
  neighborhoods: string[];
  maxPrice: number;
  bedrooms: number;
  parkingSpots: number;
  minArea: number;
  urgency: UrgencyType;
  paymentMethod: string;
  notes?: string;
  iaRawText?: string;
  useIa?: boolean;
  coverPhoto?: string;
  status: "Ativo" | "Inativo";
  createdAt: string;
  createdBy: string;
}

export interface MatchHistory {
  status: MatchStatus;
  updatedAt: string;
  updatedBy: string;
  notes?: string;
}

export interface Match {
  id: string;
  propertyId: string;
  demandId: string;
  score: number;
  status: MatchStatus;
  createdAt: string;
  history: MatchHistory[];
  insights?: {
    explanation: string;
    advice: string;
    scoreExplanation: string;
  };
  
  // Flat properties for client display optimization
  propertyTitle?: string;
  propertyPrice?: number;
  propertyCreatedBy?: string;
  brokerProperty?: {
    id: string;
    name: string;
    creci: string;
    phone: string;
    whatsapp?: string;
    photoUrl?: string;
    status: string;
  };
  brokerDemand?: {
    id: string;
    name: string;
    creci: string;
    phone: string;
    whatsapp?: string;
    photoUrl?: string;
    status: string;
  };
}

export interface Favorite {
  id: string;
  brokerId: string;
  favoriteType: "property" | "demand" | "broker";
  targetId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  brokerId: string;
  title: string;
  message: string;
  type: "match" | "verification" | "partnership" | "admin";
  read: boolean;
  createdAt: string;
}

export interface Rating {
  id: string;
  brokerId: string; // broker receiving feedback
  ratingBy: string; // broker giving feedback
  score: number;
  comment: string;
  createdAt: string;
}

export interface City {
  id: string;
  name: string;
  neighborhoods: string[];
}

export interface SystemSettings {
  geminiApiKey: string;
  llmModelName: string;
  llmEndpointUrl: string;
  maxPhotosPerProperty: number;
  s3Url?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3BucketName?: string;
  apiKey?: string;
  proximityRadius?: number;
}
