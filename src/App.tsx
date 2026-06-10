import { useState, useEffect, useRef } from "react";
import { 
  Building2, SearchCode, Compass, Heart, User, ShieldAlert,
  Bell, CheckCircle, Clock, X, MessageSquare, Star, Sparkles, Plus,
  SlidersHorizontal, RefreshCw, ThumbsUp, AlertCircle, Eye, ExternalLink,
  Target, Award, Loader2, Image as ImageIcon, Save, Camera, Pencil, Menu,
  ArrowLeft
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import PropertyForm from "./components/PropertyForm";
import DemandForm from "./components/DemandForm";
import MatchesList from "./components/MatchesList";
import MarkdownText from "./components/MarkdownText";

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cpath d='M80 85c0-11 9-20 20-20s20 9 20 20-9 20-20 20-20-9-20-20zm-5 35h50c8 0 15 7 15 15v10H60v-10c0-8 7-15 15-15z' fill='%239ca3af'/%3E%3C/svg%3E";
import AdminPanel from "./components/AdminPanel";
import Login from "./components/Login";
import { Corretor, Property, Demand, Match, Favorite, Notification, UrgencyType, City } from "./types";

type ActiveTab = "inicio" | "imoveis" | "procuras" | "matches" | "favoritos" | "perfil" | "admin" | "globocatalogo";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("inicio");
  const [activeBroker, setActiveBroker] = useState<Corretor | null>(null);
  const [showLogin, setShowLogin] = useState<boolean | null>(null);

  // Available simulation brokers to toggle
  const [simulatedBrokers, setSimulatedBrokers] = useState<Corretor[]>([]);
  const [isSwitchBrokerOpen, setIsSwitchBrokerOpen] = useState(false);
  
  // Platform resource lists
  const [properties, setProperties] = useState<Property[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Dark Mode
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Dashboard and state loading indicators
  const [loading, setLoading] = useState(true);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState<string | null>(null); // holds brokerId to review
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", city: "", photoUrl: "", currentPassword: "", newPassword: "" });
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  
  // New listing modals triggers
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editProperty, setEditProperty] = useState<any | null>(null);
  const [showDemandForm, setShowDemandForm] = useState(false);
  const [editDemand, setEditDemand] = useState<any | null>(null);
  const [selectedListingDetail, setSelectedListingDetail] = useState<any | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // States for handling property photo editing
  const [isEditingPhotos, setIsEditingPhotos] = useState(false);
  const [editingPhotosList, setEditingPhotosList] = useState<string[]>([]);
  const [editingNewPhotoUrl, setEditingNewPhotoUrl] = useState("");
  const [isUploadingEdit, setIsUploadingEdit] = useState(false);
  const [isDraggingEdit, setIsDraggingEdit] = useState(false);
  const [maxPhotosLimit, setMaxPhotosLimit] = useState(8);
  const [globalCatalogEnabled, setGlobalCatalogEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data && data.maxPhotosPerProperty) {
          setMaxPhotosLimit(data.maxPhotosPerProperty);
        }
        if (data && data.globalCatalogEnabled !== undefined) {
          setGlobalCatalogEnabled(data.globalCatalogEnabled);
        }
      })
      .catch(() => {});
    fetch("/api/cities")
      .then(res => res.json())
      .then(data => setCities(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const uid = localStorage.getItem("conectacorretor_user_id");
    if (uid) {
      fetchAllData();
      setShowLogin(false);
    } else {
      setShowLogin(true);
      setLoading(false);
    }
  }, []);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const uploadProfilePhoto = async (file: File) => {
    setIsUploadingProfilePhoto(true);
    try {
      const base64 = await convertToBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data: base64, filename: file.name })
      });
      if (res.ok) {
        const data = await res.json();
        setProfileForm(prev => ({ ...prev, photoUrl: data.url }));
      } else {
        const errData = await res.json();
        alert(`Falha ao subir foto: ${errData.error || "Erro desconhecido"}`);
      }
    } catch (err: any) {
      alert(`Erro no upload: ${err.message}`);
    } finally {
      setIsUploadingProfilePhoto(false);
    }
  };

  const uploadFilesEdit = async (files: File[]) => {
    setIsUploadingEdit(true);
    for (const file of files) {
      if (editingPhotosList.length >= maxPhotosLimit) {
        alert(`Limite máximo de ${maxPhotosLimit} fotos atingido!`);
        break;
      }
      try {
        const base64 = await convertToBase64(file);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data: base64,
            filename: file.name
          })
        });
        if (res.ok) {
          const data = await res.json();
          setEditingPhotosList(prev => [...prev, data.url]);
        } else {
          const errData = await res.json();
          alert(`Falha ao subir imagem: ${errData.error || "Erro desconhecido"}`);
        }
      } catch (err: any) {
        alert(`Erro no upload: ${err.message}`);
      }
    }
    setIsUploadingEdit(false);
  };

  const handleFileChangeEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      uploadFilesEdit(filesArray);
    }
  };

  const handleDragOverEdit = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingEdit(true);
  };

  const handleDragLeaveEdit = () => {
    setIsDraggingEdit(false);
  };

  const handleDropEdit = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingEdit(false);
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      uploadFilesEdit(filesArray);
    }
  };

  const handleSavePropertyPhotos = async (propertyId: string) => {
    try {
      const headers = getHeaders();
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          photos: editingPhotosList
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setProperties((prev: Property[]) => prev.map(p => p.id === propertyId ? updated : p));
        setSelectedListingDetail((prev: any) => prev && prev.id === propertyId ? { ...prev, photos: editingPhotosList } : prev);
        setIsEditingPhotos(false);
        setActivePhotoIdx(0);
        alert("Fotos do imóvel atualizadas com sucesso!");
      } else {
        const errData = await res.json();
        alert(`Erro ao salvar fotos: ${errData.error || "Tente novamente."}`);
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
    }
  };

  // Stats and view counts
  const [stats, setStats] = useState({
    activeProperties: 0,
    activeDemands: 0,
    newMatches: 0,
    views: 450
  });

  // Filters for feed
  const [feedFilter, setFeedFilter] = useState<"tudo" | "ofertas" | "demandas">("tudo");
  const [cityFilter, setCityFilter] = useState<string>("todas");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(4);
  const [cities, setCities] = useState<City[]>([]);

  // Filters for global catalog
  const [gTypeFilter, setGTypeFilter] = useState<string>("todos");
  const [gCityFilter, setGCityFilter] = useState<string>("todas");
  const [gPurposeFilter, setGPurposeFilter] = useState<string>("todos");
  const [gBedroomsFilter, setGBedroomsFilter] = useState<string>("todos");

  // Document upload state
  const [creciDoc, setCreciDoc] = useState("");
  const [identDoc, setIdentDoc] = useState("");
  const [isVerifyingState, setIsVerifyingState] = useState(false);

  // Review states
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const hideBrokenImg = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).style.display = "none";
  };

  // Toggle user-id header for full simulated sandbox state
  const getActiveUserId = () => {
    return localStorage.getItem("conectacorretor_user_id") || "admin-id";
  };

  const getHeaders = () => {
    return {
      "Content-Type": "application/json",
      "x-user-id": getActiveUserId()
    };
  };

  // Re-fetch all dynamic platform resources from backend Express
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      
      // 1. Logged in Broker
      const resMe = await fetch("/api/auth/me", { headers });
      if (resMe.ok) {
        const dataMe = await resMe.json();
        setActiveBroker(dataMe);
        localStorage.setItem("conectacorretor_user_id", dataMe.id);
      }

      // 2. All brokers (for character simulation)
      const resBrokers = await fetch("/api/admin/brokers");
      if (resBrokers.ok) {
        const brokersData = await resBrokers.json();
        setSimulatedBrokers(brokersData);
      }

      // 3. Properties list
      const resProps = await fetch("/api/properties", { headers });
      if (resProps.ok) {
        const dataProps = await resProps.json();
        setProperties(dataProps);
      }

      // 4. Demands list
      const resDemands = await fetch("/api/demands", { headers });
      if (resDemands.ok) {
        const dataDemands = await resDemands.json();
        setDemands(dataDemands);
      }

      // 5. Matches list
      const resMatches = await fetch("/api/matches", { headers });
      if (resMatches.ok) {
        const dataMatches = await resMatches.json();
        setMatches(dataMatches);
      }

      // 6. Favorites
      const resFavs = await fetch("/api/favorites", { headers });
      if (resFavs.ok) {
        const dataFavs = await resFavs.json();
        setFavorites(dataFavs);
      }

      // 7. Notifications
      const resNots = await fetch("/api/notifications", { headers });
      if (resNots.ok) {
        const dataNots = await resNots.json();
        setNotifications(dataNots);
      }

      // 8. System settings (globalCatalogEnabled, etc)
      const resSettings = await fetch("/api/settings");
      if (resSettings.ok) {
        const dataSettings = await resSettings.json();
        if (dataSettings.globalCatalogEnabled !== undefined) {
          setGlobalCatalogEnabled(dataSettings.globalCatalogEnabled);
        }
      }
    } catch (err) {
      console.error("Networking error parsing broker properties:", err);
    } finally {
      setLoading(false);
    }
  };

  // Recalculates stats based on fetched resources
  useEffect(() => {
    const ownerId = getActiveUserId();
    const myPropsCount = properties.filter(p => p.createdBy === ownerId && p.status === "Ativo").length;
    const myDemandsCount = demands.filter(d => d.createdBy === ownerId).length;
    const myNewMatchesCount = matches.filter(m => m.status === "Novo").length;

    setStats({
      activeProperties: myPropsCount,
      activeDemands: myDemandsCount,
      newMatches: myNewMatchesCount,
      views: 124 + myPropsCount * 14 + myDemandsCount * 8
    });
  }, [properties, demands, matches]);

  // Switch simulation broker context instantly!
  const handleSwitchBroker = async (id: string) => {
    localStorage.setItem("conectacorretor_user_id", id);
    setIsSwitchBrokerOpen(false);
    await fetchAllData();
    setActiveTab("inicio");
  };

  const handleLoginSuccess = (user: Corretor) => {
    localStorage.setItem("conectacorretor_user_id", user.id);
    setActiveBroker(user);
    setShowLogin(false);
    fetchAllData();
  };

  const handleLogout = () => {
    localStorage.removeItem("conectacorretor_user_id");
    setActiveBroker(null);
    setShowLogin(true);
  };

  // Switch to new broker registration page simulating user flows
  const handleSimulateNewRegistration = async (formData: any) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        const newUser = await response.json();
        localStorage.setItem("conectacorretor_user_id", newUser.id);
        await fetchAllData();
        setActiveTab("perfil");
      } else {
        const err = await response.json();
        alert(err.error || "Erro de registro");
      }
    } catch (err) {
      alert("Erro ao contatar servidor de registro.");
    }
  };

  // Submit mock docs for evaluation
  const handleUploadCreciDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creciDoc || !identDoc) return;
    setIsVerifyingState(true);
    try {
      const response = await fetch("/api/auth/verify-docs", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          creciDoc,
          identDoc
        })
      });
      if (response.ok) {
        setShowDocUploadModal(false);
        setCreciDoc("");
        setIdentDoc("");
        await fetchAllData();
      }
    } catch (err) {
      alert("Erro de conexão ao enviar documentos.");
    } finally {
      setIsVerifyingState(false);
    }
  };

  // Toggle favorite listings
  const handleToggleFavorite = async (type: "property" | "demand", targetId: string) => {
    const isFav = favorites.some(f => f.favoriteType === type && f.targetId === targetId);
    if (isFav) {
      try {
        const response = await fetch(`/api/favorites/${type}/${targetId}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        if (response.ok) {
          setFavorites(favorites.filter(f => !(f.favoriteType === type && f.targetId === targetId)));
        }
      } catch (err) {
        console.error("Failed deletion", err);
      }
    } else {
      try {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            favoriteType: type,
            targetId
          })
        });
        if (response.ok) {
          const newFav = await response.json();
          setFavorites([...favorites, newFav]);
        }
      } catch (err) {
        console.error("Failed insertion", err);
      }
    }
  };

  // Update partnership status
  const handleMatchStatusChanged = async (matchId: string, status: any, notes: string) => {
    try {
      const response = await fetch(`/api/matches/${matchId}/status`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status, notes })
      });
      if (response.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit test review for a broker partner
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddReviewModal) return;
    setIsSubmittingReview(true);
    try {
      const response = await fetch(`/api/brokers/${showAddReviewModal}/reviews`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          score: reviewScore,
          comment: reviewComment
        })
      });
      if (response.ok) {
        setShowAddReviewModal(null);
        setReviewComment("");
        setReviewScore(5);
        await fetchAllData();
        alert("Sua avaliação profissional foi publicada com sucesso!");
      }
    } catch (err) {
      alert("Erro ao salvar avaliação.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: getHeaders()
      });
      if (res.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: getHeaders()
      });
      if (res.ok) {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtering listings matching toggled queries
  const getFilteredFeedItems = () => {
    let items: any[] = [];
    
    if (feedFilter === "tudo" || feedFilter === "ofertas") {
      properties.forEach(p => {
        items.push({ ...p, feedType: "property" });
      });
    }
    
    if (feedFilter === "tudo" || feedFilter === "demandas") {
      demands.forEach(d => {
        items.push({ ...d, feedType: "demand" });
      });
    }

    // Sort chronologically
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply location filter
    if (cityFilter !== "todas") {
      items = items.filter(item => item.city.toLowerCase() === cityFilter.toLowerCase());
    }

    // Apply type filter
    if (typeFilter !== "todos") {
      items = items.filter(item => item.type.toLowerCase() === typeFilter.toLowerCase());
    }

    return items;
  };

  const unreadNotifications = notifications.filter(n => !n.read);

  if (showLogin) return <Login onLogin={handleLoginSuccess} />;

  if (loading && simulatedBrokers.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-gray-800/50">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm font-semibold text-gray-500 dark:text-dark-muted">Iniciando ConectaCorretor B2B...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-dark-bg text-[#1d1d1f] dark:text-dark-text antialiased font-sans flex font-normal leading-relaxed">
      
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        broker={activeBroker} 
        unreadNotificationsCount={unreadNotifications.length}
        matchesCount={matches.filter(m => m.status !== "Perdido").length}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        globalCatalogEnabled={globalCatalogEnabled}
      />

      {/* Main Panel Frame */}
      <main className="flex-1 md:pl-64 min-h-screen pb-16 md:pb-0">
        
        {/* Global sticky bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e8e8ed] dark:border-dark-border bg-white/80 dark:bg-dark-card/80 backdrop-blur-md px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden rounded-lg p-2 text-slate-600 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs font-semibold text-[#86868b] dark:text-dark-muted">
              Ambiente de Demonstração Imobiliária
            </span>
            <button
              onClick={() => setIsSwitchBrokerOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1d1d1f] dark:text-dark-text bg-white dark:bg-dark-card hover:bg-[#f5f5f7] dark:hover:bg-gray-700 rounded-full px-3 py-1.5 border border-[#d2d2d7] dark:border-dark-border transition cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Alternar Corretor Ativo
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDark(d => !d)}
              className="p-2 rounded-xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm hover:bg-slate-50 dark:hover:bg-gray-700 transition cursor-pointer"
              title={isDark ? "Modo Claro" : "Modo Escuro"}
            >
              {isDark ? (
                <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/></svg>
              ) : (
                <svg className="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/></svg>
              )}
            </button>
            {/* Notification alert bells dropdown trigger */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative rounded-full p-2 text-slate-500 dark:text-dark-muted hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 transition"
              >
                <Bell className="h-5.5 w-5.5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-[#e2e8f0] dark:border-dark-border bg-white dark:bg-dark-card p-4 shadow-xl ring-1 ring-black/5 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-2">
                    <h4 className="font-extrabold text-gray-900 dark:text-dark-text text-xs">Alertas da Rede B2B</h4>
                    {unreadNotifications.length > 0 && (
                      <button
                        onClick={handleMarkAllNotificationsRead}
                        className="text-[10px] text-blue-600 hover:underline font-bold"
                      >
                        Limpar todos
                      </button>
                    )}
                  </div>

                  <div className="space-y-3.5 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-[11px] text-gray-400 dark:text-dark-muted italic text-center py-4">Nenhum alerta recebido</p>
                    ) : (
                      notifications.slice(0, 8).map((not) => (
                        <div
                          key={not.id}
                          onClick={() => {
                            handleMarkNotificationRead(not.id);
                            if (not.type === "match" || not.type === "partnership") {
                              setActiveTab("matches");
                            }
                            setIsNotificationOpen(false);
                          }}
                          className={`p-2.5 rounded-xl text-[11px] leading-relaxed relative cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800 transition border ${
                            not.read ? "bg-white dark:bg-dark-card border-transparent text-gray-500 dark:text-dark-muted" : "bg-blue-50/40 dark:bg-blue-900/20 border-blue-100 text-gray-800 dark:text-dark-text"
                          }`}
                        >
                          {!not.read && <span className="absolute top-2.5 left-2.5 h-1.5 w-1.5 rounded-full bg-blue-500" />}
                          <div className={not.read ? "pl-2" : "pl-4"}>
                            <p className="font-bold text-gray-900 dark:text-dark-text">{not.title}</p>
                            <p className="text-gray-500 dark:text-dark-muted mt-0.5">{not.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Active User Display */}
            {activeBroker && (
              <button
                onClick={() => setActiveTab("perfil")}
                className="flex items-center gap-2 border-l border-slate-200 dark:border-dark-border pl-4 hover:bg-slate-50 dark:hover:bg-gray-800 pr-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900 dark:text-dark-text">{activeBroker.name}</p>
                  <span className="text-[10px] text-slate-400 dark:text-dark-muted font-semibold">{activeBroker.creci}</span>
                </div>
                <img
                  src={activeBroker.photoUrl}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border"
                  referrerPolicy="no-referrer"
                  onError={hideBrokenImg}
                />
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Inner tabs workspace */}
        <div className="px-8 py-8">
          
          {/* Main active layout */}
          {activeTab === "inicio" && (
            <div className="space-y-8 animate-fade-in">
              {/* Dynamic Header indicators */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text">
                    Olá, Corretor {activeBroker?.name.split(" ")[0]}!
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-dark-muted mt-1 leading-normal">
                    Seu hub centralizado de captações e buscas. Veja matches imediatos calculados pela IA da rede.
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setShowDemandForm(true)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#d2d2d7] dark:border-dark-border bg-white dark:bg-dark-card px-4 text-xs font-bold text-[#1d1d1f] dark:text-dark-text hover:bg-[#f5f5f7] dark:hover:bg-gray-700 cursor-pointer transition-all duration-155"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-[#515154] dark:text-dark-muted" />
                    Cadastrar Procura / IA
                  </button>
                  <button
                    onClick={() => setShowPropertyForm(true)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#0071e3] px-5 text-xs font-bold text-white hover:bg-[#0077ed] cursor-pointer transition-all duration-155"
                  >
                    <Plus className="h-4 w-4" />
                    + Cadastrar Imóvel
                  </button>
                </div>
              </div>

              {/* Verified CRECI warning banner if Pendente */}
              {activeBroker?.status !== "Aprovado" && (
                <div className="rounded-2xl border border-[#ffe0b2] bg-[#fffcf8] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-[#ff9500] flex items-center gap-1.5">
                      <AlertCircle className="h-4.5 w-4.5" />
                      Selo de Corretor Verificado Pendente
                    </p>
                    <p className="text-[#515154] dark:text-dark-muted font-medium leading-relaxed">
                      Somente corretores com CRECI aprovado e verificado podem anunciar imóveis ou procuras ativas. Faça o upload das fotos da carteira e RG para aprovação imediata do administrador!
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDocUploadModal(true)}
                    className="rounded-full bg-[#ff9500] hover:bg-[#ff9f0a] text-white font-bold text-xs px-5 py-2 border-0 shadow-none whitespace-nowrap cursor-pointer shrink-0 transition"
                  >
                    Enviar Meus Documentos
                  </button>
                </div>
              )}

              {/* KPI metrics row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => setActiveTab("imoveis")} className="bg-white dark:bg-dark-card border border-[#e8e8ed] dark:border-dark-border rounded-2xl p-5 space-y-3 shadow-none text-left cursor-pointer hover:shadow-md transition w-full">
                  <span className="text-[10px] uppercase font-bold text-[#86868b] dark:text-dark-muted tracking-wider">Meus Imóveis Ativos</span>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-extrabold text-[#1d1d1f] dark:text-dark-text tracking-tight leading-none">{stats.activeProperties}</p>
                    <span className="text-xs text-[#86868b] dark:text-dark-muted font-medium">anúncios</span>
                  </div>
                </button>

                <button onClick={() => setActiveTab("procuras")} className="bg-white dark:bg-dark-card border border-[#e8e8ed] dark:border-dark-border rounded-2xl p-5 space-y-3 shadow-none text-left cursor-pointer hover:shadow-md transition w-full">
                  <span className="text-[10px] uppercase font-bold text-[#86868b] dark:text-dark-muted tracking-wider">Minhas Procuras Ativas</span>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-extrabold text-[#1d1d1f] dark:text-dark-text tracking-tight leading-none">{stats.activeDemands}</p>
                    <span className="text-xs text-[#86868b] dark:text-dark-muted font-medium">clientes</span>
                  </div>
                </button>

                <button onClick={() => setActiveTab("matches")} className="bg-[#0071e3] rounded-2xl p-5 space-y-3 text-white shadow-none hover:bg-[#0077ed] transition text-left cursor-pointer w-full">
                  <span className="text-[10px] uppercase font-bold text-white/80 tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 fill-white/10 shrink-0" />
                    Matches Inteligentes
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-extrabold tracking-tight leading-none">{stats.newMatches}</p>
                    <span className="text-xs text-white/95 font-bold">novos matches!</span>
                  </div>
                </button>

                <div className="bg-white dark:bg-dark-card border border-[#e8e8ed] dark:border-dark-border rounded-2xl p-5 space-y-3 shadow-none">
                  <span className="text-[10px] uppercase font-bold text-[#86868b] dark:text-dark-muted tracking-wider">Visualizações Totais</span>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-extrabold text-[#1d1d1f] dark:text-dark-text tracking-tight leading-none">{stats.views}</p>
                    <span className="text-xs text-[#86868b] dark:text-dark-muted font-medium">visitas</span>
                  </div>
                </div>
              </div>

              {/* Feed Filters Tabs */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8e8ed] dark:border-dark-border pb-3">
                  <div className="flex items-center gap-1.5">
                    {(["tudo", "ofertas", "demandas"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setFeedFilter(filter)}
                        className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition-all cursor-pointer ${
                          feedFilter === filter
                            ? "bg-[#1d1d1f] text-white shadow-none"
                            : "text-[#86868b] dark:text-dark-muted hover:bg-[#e8e8ed] hover:text-[#1d1d1f] dark:text-dark-text"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 bg-[#f5f5f7] dark:bg-dark-bg rounded-lg p-0.5 border border-[#e8e8ed] dark:border-dark-border">
                      {([2, 3, 4] as const).map(n => (
                        <button
                          key={n}
                          onClick={() => setGridCols(n)}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            gridCols === n
                              ? "bg-white dark:bg-dark-card text-[#1d1d1f] dark:text-dark-text shadow-sm"
                              : "text-[#86868b] dark:text-dark-muted hover:text-[#1d1d1f] dark:hover:text-dark-text"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    <select
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      className="rounded-full border border-[#d2d2d7] dark:border-dark-border bg-white dark:bg-dark-card text-[#1d1d1f] dark:text-dark-text px-4 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0071e3] transition cursor-pointer"
                    >
                      <option value="todas">Cidades (Todas)</option>
                      {cities.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>

                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="rounded-full border border-[#d2d2d7] dark:border-dark-border bg-white dark:bg-dark-card text-[#1d1d1f] dark:text-dark-text px-4 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0071e3] transition cursor-pointer"
                    >
                      <option value="todos">Imóveis (Todos)</option>
                      <option value="apartamento">Apartamento</option>
                      <option value="casa">Casa</option>
                      <option value="terreno">Terreno</option>
                      <option value="cobertura">Cobertura</option>
                      <option value="comercial">Comercial</option>
                    </select>
                  </div>
                </div>

                {/* Feed: Properties grid (left) + Demands list (right) */}
                <div className="flex flex-col lg:flex-row gap-6">
                {feedFilter !== "demandas" && (
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const propertyItems = getFilteredFeedItems().filter(i => i.feedType === "property");
                      if (propertyItems.length === 0 && feedFilter === "ofertas") {
                        return <p className="text-xs text-gray-400 dark:text-dark-muted text-center py-8">Nenhuma oferta encontrada.</p>;
                      }
                      if (propertyItems.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <div className={`grid gap-4 ${
                            gridCols === 2 ? "grid-cols-1 md:grid-cols-2" :
                            gridCols === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" :
                            "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                          }`}>
                            {propertyItems.map((item) => {
                              const isOwn = item.createdBy === getActiveUserId();
                              return (
                                <div
                                  key={item.id}
                                  className={`group rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between overflow-hidden ${
                                    isOwn ? "ring-1 ring-blue-100" : ""
                                  }`}
                                >
                                  {/* Feed Card Cover Image */}
                                  {item.photos && item.photos.length > 0 ? (
                                    <div className="relative h-36 w-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                                      <img src={item.photos[0]} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={hideBrokenImg} />
                                    </div>
                                  ) : (
                                    <div className="relative h-36 w-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                                      <img src={item.coverPhoto || PLACEHOLDER_IMG} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={hideBrokenImg} />
                                    </div>
                                  )}
                                  <div className="p-5">
                                    <div className="space-y-3 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="inline-flex rounded-full border px-2.5 py-0.5 font-bold uppercase tracking-wider text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                                          Oferta / imóvel
                                        </span>
                                        <div className="flex items-center gap-1">
                                          {isOwn && (
                                            <span className="text-[10px] text-blue-600 bg-blue-50/50 py-0.5 px-2 rounded-md font-bold">Meu Anúncio</span>
                                          )}
                                          <button onClick={() => handleToggleFavorite("property", item.id)} className="text-gray-400 dark:text-dark-muted hover:text-red-500 p-1">
                                            <Heart className={`h-4.5 w-4.5 ${favorites.some(f => f.favoriteType === "property" && f.targetId === item.id) ? "text-red-500 fill-red-500" : ""}`} />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <h4 className="font-extrabold text-gray-900 dark:text-dark-text text-sm leading-snug group-hover:text-blue-600 transition tracking-tight">{item.title}</h4>
                                        <div className="text-[11px] text-gray-500 dark:text-dark-muted leading-normal line-clamp-2"><MarkdownText text={item.description} /></div>
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-slate-400 dark:text-dark-muted text-[11px] font-medium py-1">
                                        <span>{item.neighborhood} | {item.city}</span>
                                        <span>•</span>
                                        <span>{item.bedrooms} qts</span>
                                        <span>•</span>
                                        <span>{item.parkingSpots} vagas</span>
                                        {item.area && <><span>•</span><span>{item.area}m²</span></>}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-50 dark:border-dark-border mt-4 pt-3 text-xs">
                                      <div>
                                        <span className="text-[9px] text-gray-400 dark:text-dark-muted font-bold uppercase block leading-none">Preço</span>
                                        <p className="text-sm font-bold text-gray-900 dark:text-dark-text mt-1">R$ {item.price.toLocaleString("pt-BR")}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button onClick={() => setSelectedListingDetail(item)} className="inline-flex h-8 items-center gap-1 rounded-xl border border-gray-300 dark:border-dark-border px-3 py-1 font-bold text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-gray-800 text-[11px]">
                                          <Eye className="h-3.5 w-3.5" />
                                          Ver Ficha
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {feedFilter !== "ofertas" && (
                  <div className="w-full lg:w-80 shrink-0">
                    {(() => {
                      const demandItems = getFilteredFeedItems().filter(i => i.feedType === "demand").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      if (demandItems.length === 0 && feedFilter === "demandas") {
                        return <p className="text-xs text-gray-400 dark:text-dark-muted text-center py-8">Nenhuma demanda encontrada.</p>;
                      }
                      if (demandItems.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-purple-200 pb-2">
                            <span className="inline-flex rounded-full border px-2.5 py-0.5 font-bold uppercase tracking-wider text-[9px] bg-purple-50 text-purple-700 border-purple-200">Procura / Demanda</span>
                            <span className="text-[11px] text-purple-500 font-medium">{demandItems.length} {demandItems.length === 1 ? "cliente" : "clientes"}</span>
                          </div>
                          <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                            {demandItems.map((item) => {
                              const isOwn = item.createdBy === getActiveUserId();
                              return (
                                <div key={item.id} className={`group rounded-2xl border border-purple-100 bg-white dark:bg-dark-card shadow-sm hover:shadow-md transition-all relative ${isOwn ? "ring-1 ring-purple-100" : ""}`}>
                                  <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-2 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-extrabold text-gray-900 dark:text-dark-text text-sm leading-snug tracking-tight">
                                            Cliente busca {item.type} até R$ {item.maxPrice.toLocaleString("pt-BR")}
                                          </h4>
                                          {isOwn && (
                                            <span className="text-[10px] text-purple-600 bg-purple-50/50 py-0.5 px-2 rounded-md font-bold shrink-0">Meu Cliente</span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-dark-muted leading-normal line-clamp-2">
                                          {item.notes || "Observações não preenchidas."}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-slate-400 dark:text-dark-muted text-[11px] font-medium">
                                          <span>{item.neighborhood} | {item.city}</span>
                                          <span>•</span>
                                          <span>{item.bedrooms} qts</span>
                                          <span>•</span>
                                          <span>{item.parkingSpots} vagas</span>
                                          {item.area && <><span>•</span><span>mín {item.minArea}m²</span></>}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs pt-1">
                                          <div>
                                            <span className="text-[9px] text-gray-400 dark:text-dark-muted font-bold uppercase block leading-none">Orçamento</span>
                                            <p className="text-sm font-bold text-gray-900 dark:text-dark-text mt-0.5">R$ {item.maxPrice.toLocaleString("pt-BR")}</p>
                                          </div>
                                          <button onClick={() => setSelectedListingDetail(item)} className="inline-flex h-8 items-center gap-1 rounded-xl border border-gray-300 dark:border-dark-border px-3 py-1 font-bold text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-gray-800 text-[11px]">
                                            <Eye className="h-3.5 w-3.5" />
                                            Ver Ficha
                                          </button>
                                        </div>
                                      </div>
                                      <button onClick={() => handleToggleFavorite("demand", item.id)} className="text-gray-400 dark:text-dark-muted hover:text-red-500 p-1 shrink-0">
                                        <Heart className={`h-4 w-4 ${favorites.some(f => f.favoriteType === "demand" && f.targetId === item.id) ? "text-red-500 fill-red-500" : ""}`} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                </div>
              </div>

            </div>
          )}

          {activeTab === "imoveis" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text">Meus Imóveis Captados</h2>
                  <p className="text-sm text-gray-500 dark:text-dark-muted">Veja e gerencie seus anúncios imobiliários publicados.</p>
                </div>
                <button
                  onClick={() => setShowPropertyForm(true)}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white text-xs hover:bg-blue-700 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  + Novo Imóvel
                </button>
              </div>

              {properties.filter(p => p.createdBy === getActiveUserId()).length === 0 ? (
                <div className="text-center bg-white dark:bg-dark-card p-12 border border-dashed rounded-2xl">
                  <Building2 className="h-10 w-10 text-gray-300 dark:text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-500 dark:text-dark-muted mt-3 font-medium">Você ainda não possui imóveis publicados. Cadastre sua primeira captação!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.filter(p => p.createdBy === getActiveUserId()).map((p) => (
                    <div key={p.id} className="bg-white dark:bg-dark-card border rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                      {p.photos && p.photos.length > 0 ? (
                        <div className="relative h-44 w-full bg-slate-100 dark:bg-gray-800">
                          <img
                            src={p.photos[0]}
                            alt={p.title}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={hideBrokenImg}
                          />
                          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[9px] font-bold px-2 py-0.5 rounded-md font-mono">
                            {p.photos.length} {p.photos.length === 1 ? 'Foto' : 'Fotos'}
                          </span>
                        </div>
                      ) : (
                        <div className="h-44 w-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 text-center border-b">
                          <Building2 className="h-7 w-7 text-slate-300 dark:text-gray-500" />
                          <span className="text-[9px] text-slate-400 dark:text-dark-muted font-medium mt-1">Nenhuma foto anexada</span>
                        </div>
                      )}
                      
                      <div className="p-4 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-wider">{p.status}</span>
                          <span className="text-slate-400 dark:text-dark-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-dark-text leading-tight line-clamp-1">{p.title}</h4>
                        <div className="text-gray-500 dark:text-dark-muted leading-relaxed line-clamp-3"><MarkdownText text={p.description} /></div>
                        <div className="bg-blue-50 text-blue-800 p-2 rounded-lg font-bold">Parcerias: {p.commission}</div>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 border-t p-3 text-xs flex justify-between items-center">
                        <p className="font-bold text-gray-900 dark:text-dark-text">R$ {p.price.toLocaleString("pt-BR")}</p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => { setEditProperty(p); setShowPropertyForm(true); }}
                            className="text-blue-600 hover:underline font-bold text-[11px]"
                          >
                            Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("Remover este imóvel?")) {
                                const res = await fetch(`/api/properties/${p.id}`, { method: "DELETE", headers: getHeaders() });
                                if (res.ok) await fetchAllData();
                              }
                            }}
                            className="text-red-600 hover:underline font-bold text-[11px]"
                          >
                            Excluir Anúncio
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "procuras" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text">Suas Procuras Cadastradas</h2>
                  <p className="text-sm text-gray-500 dark:text-dark-muted">Veja e gerencie as procuras ativas dos seus clientes cadastrados.</p>
                </div>
                <button
                  onClick={() => setShowDemandForm(true)}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white text-xs hover:bg-blue-700 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  + Nova Procura
                </button>
              </div>

              {demands.filter(d => d.createdBy === getActiveUserId()).length === 0 ? (
                <div className="text-center bg-white dark:bg-dark-card p-12 border border-dashed rounded-2xl">
                  <SearchCode className="h-10 w-10 text-gray-300 dark:text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-500 dark:text-dark-muted mt-3 font-medium">Você ainda não possui procuras imobiliárias publicadas. Cadastre seu primeiro pedido!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {demands.filter(d => d.createdBy === getActiveUserId()).map((d) => (
                    <div key={d.id} className="bg-white dark:bg-dark-card border rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                      <div className="relative h-36 w-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                        <img src={d.coverPhoto || PLACEHOLDER_IMG} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={hideBrokenImg} />
                      </div>
                      <div className="p-4 space-y-3 text-xs flex-1">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[9px] uppercase tracking-wider capitalize">{d.purpose} de {d.type}</span>
                          <span className="text-xs font-bold text-red-600">Urgência: {d.urgency}</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-dark-text leading-tight">Buscar em {d.city} (Bairros: {d.neighborhoods.join(", ") || "Todos"})</h4>
                        <p className="text-gray-500 dark:text-dark-muted leading-relaxed font-semibold italic">{d.notes || "Sem notas particulares"}</p>
                        <p className="text-gray-600 dark:text-dark-muted mt-1">Forma de pagamento: <b>{d.paymentMethod}</b></p>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 border-t p-2.5 -m-4 mt-3 flex justify-between items-center text-xs">
                        <p className="font-bold text-gray-900 dark:text-dark-text">Preço teto: R$ {d.maxPrice.toLocaleString("pt-BR")}</p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => { setEditDemand(d); setShowDemandForm(true); }}
                            className="text-blue-600 hover:underline font-bold text-[11px]"
                          >
                            Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("Remover esta procura?")) {
                                const res = await fetch(`/api/demands/${d.id}`, { method: "DELETE", headers: getHeaders() });
                                if (res.ok) await fetchAllData();
                              }
                            }}
                            className="text-red-600 hover:underline font-bold text-[11px]"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "matches" && (
            <MatchesList 
              matches={matches} 
              onRefresh={fetchAllData} 
              onStatusChange={handleMatchStatusChanged} 
            />
          )}

          {activeTab === "favoritos" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text font-sans">Meus Favoritos Salvos</h2>
                <p className="text-sm text-slate-500 dark:text-dark-muted">Acompanhe as oportunidades e corretores parceiros avaliados que você marcou com estrela.</p>
              </div>

              {favorites.length === 0 ? (
                <div className="bg-white dark:bg-dark-card border rounded-2xl p-12 text-center border-dashed">
                  <Heart className="h-10 h-10 text-gray-300 dark:text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-500 dark:text-dark-muted font-medium mt-3">Você ainda não favoritou nenhuma oferta imobiliária ou parceiro.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {favorites.map((fav) => {
                    const matchedProp = properties.find(p => p.id === fav.targetId);
                    const matchedDemand = demands.find(d => d.id === fav.targetId);
                    const item = matchedProp || matchedDemand;

                    if (!item) return null;

                    const favPhoto = matchedProp ? matchedProp.photos?.[0] : matchedDemand?.coverPhoto;
                    return (
                      <div key={fav.id} className="p-4 rounded-xl bg-white dark:bg-dark-card border flex items-center gap-4 text-xs">
                        {favPhoto ? (
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-gray-800 shrink-0">
                            <img
                              src={favPhoto}
                              alt=""
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={hideBrokenImg}
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-slate-50 dark:bg-gray-800/50 flex items-center justify-center shrink-0 border">
                            <Heart className="h-5 w-5 text-slate-300 dark:text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-dark-muted capitalize bg-slate-50 dark:bg-gray-800/50 p-1 rounded border mb-1.5 block max-w-fit">
                            {matchedProp ? "Oferta" : "Demanda"}
                          </span>
                          <h4 className="font-bold text-gray-900 dark:text-dark-text text-sm truncate">{matchedProp ? matchedProp.title : `Procura de ${matchedDemand?.type}`}</h4>
                          <p className="text-gray-500 dark:text-dark-muted font-medium truncate">
                            {matchedProp ? matchedProp.neighborhood : matchedDemand?.neighborhoods.join(", ")} | {item.city}
                          </p>
                        </div>

                        <button
                          onClick={() => handleToggleFavorite(matchedProp ? "property" : "demand", item.id)}
                          className="rounded-xl border border-red-100 hover:bg-red-50 text-red-600 px-3.5 py-1.5 font-bold shrink-0"
                        >
                          Remover Favorito
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "perfil" && activeBroker && (
            <div className="space-y-8 max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text font-sans">Meu Perfil Profissional</h2>
                  <p className="text-slate-500 dark:text-dark-muted text-sm">{isEditingProfile ? "Edite seus dados e clique em salvar." : "Visualize seus dados profissionais e avaliações."}</p>
                </div>
                <button
                  onClick={() => {
                    if (!isEditingProfile) {
                      setProfileForm({
                        name: activeBroker.name,
                        email: activeBroker.email,
                        phone: activeBroker.phone,
                        city: activeBroker.city,
                        photoUrl: activeBroker.photoUrl || "",
                        currentPassword: "",
                        newPassword: ""
                      });
                    }
                    setIsEditingProfile(!isEditingProfile);
                  }}
                  className="rounded-xl border border-gray-300 dark:border-dark-border px-4 py-2 text-xs font-bold text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-gray-800 flex items-center gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditingProfile ? "Cancelar" : "Editar Perfil"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left Bio card */}
                <div className="md:col-span-4 bg-white dark:bg-dark-card border rounded-2xl p-4 shadow-sm text-center space-y-4">
                  <div className="relative inline-block">
                    <img
                      src={isEditingProfile ? profileForm.photoUrl || activeBroker.photoUrl : activeBroker.photoUrl}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover mx-auto border-2 border-slate-100 dark:border-dark-border shadow-md ring-4 ring-blue-50/50"
                      referrerPolicy="no-referrer"
                      onError={hideBrokenImg}
                    />
                    {isEditingProfile && (
                      <button
                        type="button"
                        onClick={() => profileFileInputRef.current?.click()}
                        disabled={isUploadingProfilePhoto}
                        className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1.5 border-2 border-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingProfilePhoto
                          ? <Loader2 className="h-3 w-3 text-white animate-spin" />
                          : <Camera className="h-3 w-3 text-white" />
                        }
                      </button>
                    )}
                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadProfilePhoto(file);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {isEditingProfile ? (
                    <input
                      type="text"
                      placeholder="URL da foto de perfil"
                      value={profileForm.photoUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, photoUrl: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2 text-xs text-center"
                    />
                  ) : (
                    <>
                      <div>
                        <h3 className="font-extrabold text-gray-900 dark:text-dark-text text-base">{activeBroker.name}</h3>
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-dark-muted font-semibold mt-0.5">
                          <span>{activeBroker.creci}</span>
                          {activeBroker.status === "Aprovado" && (
                            <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-1 text-slate-600 dark:text-dark-muted bg-amber-50 rounded-xl py-1 px-4 max-w-fit mx-auto border border-amber-150">
                        <Star className="h-4.5 w-4.5 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold">{activeBroker.rating || "5.0"} estrelas</span>
                      </div>

                      <div className="border-t border-slate-100 dark:border-dark-border pt-3 space-y-2 text-left text-xs text-gray-500 dark:text-dark-muted font-medium">
                        <p>Atuação: <b>{activeBroker.city}</b></p>
                        <p>Taxa de Resposta: <b>{activeBroker.respondingRate}%</b></p>
                        <p>Negócios Concluídos: <b>{activeBroker.closedDeals} parcerias B2B</b></p>
                        <p>Acesso: <b className={activeBroker.isAdmin ? "text-purple-700" : ""}>{activeBroker.isAdmin ? "Administrador" : "Corretor"}</b></p>
                      </div>
                    </>
                  )}

                  {!isEditingProfile && (
                    !activeBroker.isAdmin ? (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/auth/make-admin", { method: "POST", headers: getHeaders() });
                            if (res.ok) {
                              const updated = await res.json();
                              setActiveBroker(updated);
                              await fetchAllData();
                              alert("Parabéns! Sua conta agora possui privilégios de Administrador. Use a barra lateral para acessar o painel de controle.");
                            } else alert("Falha ao atualizar conta");
                          } catch (err) { alert("Erro de rede ao definir privilégios de administrador"); }
                        }}
                        className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 py-2.5 font-bold text-white text-xs cursor-pointer flex items-center justify-center gap-1 transition-all"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Tornar-se Administrador
                      </button>
                    ) : (
                      <div className="p-2 py-1.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-100 text-[10px] font-bold flex items-center justify-center gap-1">
                        <Award className="h-4 w-4 text-purple-600" />
                        Acesso Administrador Ativo
                      </div>
                    )
                  )}
                </div>

                {/* Right Edit Form / Info */}
                <div className="md:col-span-8 bg-white dark:bg-dark-card border rounded-2xl p-6 shadow-sm space-y-6">
                  {isEditingProfile ? (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const res = await fetch("/api/admin/profile", {
                          method: "POST",
                          headers: getHeaders(),
                          body: JSON.stringify({
                            id: activeBroker.id,
                            name: profileForm.name,
                            email: profileForm.email,
                            phone: profileForm.phone,
                            city: profileForm.city,
                            photoUrl: profileForm.photoUrl,
                            newPassword: profileForm.newPassword || undefined
                          })
                        });
                        if (res.ok) {
                          const updated = await res.json();
                          setActiveBroker(updated);
                          if (profileForm.newPassword) {
                            localStorage.setItem("conectacorretor_pass_" + activeBroker.id, profileForm.newPassword);
                          }
                          setIsEditingProfile(false);
                          alert("Perfil atualizado com sucesso!");
                          await fetchAllData();
                        } else {
                          const err = await res.json();
                          alert(err.error || "Erro ao salvar perfil");
                        }
                      } catch (err) {
                        alert("Erro de rede ao salvar perfil");
                      }
                    }} className="space-y-5">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-dark-text text-sm border-b border-gray-100 dark:border-dark-border pb-2.5 mb-4">Dados Pessoais</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 dark:text-dark-muted uppercase tracking-wider mb-1">Nome</label>
                            <input type="text" required value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 dark:text-dark-muted uppercase tracking-wider mb-1">Email</label>
                            <input type="email" required value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 dark:text-dark-muted uppercase tracking-wider mb-1">Telefone</label>
                            <input type="text" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 dark:text-dark-muted uppercase tracking-wider mb-1">Cidade</label>
                            <input type="text" value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2.5 text-sm" />
                          </div>
                        </div>
                      </div>

                      {activeBroker.id !== "admin-id" && (
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-dark-text text-sm border-b border-gray-100 dark:border-dark-border pb-2.5 mb-4">Alterar Senha</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-gray-600 dark:text-dark-muted uppercase tracking-wider mb-1">Senha Atual</label>
                              <input type="password" value={profileForm.currentPassword} onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })} className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2.5 text-sm" placeholder="••••••••" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-gray-600 dark:text-dark-muted uppercase tracking-wider mb-1">Nova Senha</label>
                              <input type="password" value={profileForm.newPassword} onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })} className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2.5 text-sm" placeholder="Nova senha" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2 justify-end">
                        <button type="button" onClick={() => setIsEditingProfile(false)} className="rounded-xl border border-gray-300 dark:border-dark-border px-5 py-2.5 text-xs font-bold text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-gray-800">Cancelar</button>
                        <button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs font-bold text-white flex items-center gap-1.5">
                          <Save className="h-3.5 w-3.5" />
                          Salvar Alterações
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-dark-text text-sm border-b border-gray-100 dark:border-dark-border pb-2.5">Esferas de Especialidade</h4>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {activeBroker.specialties?.map((spec, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-gray-800 rounded-full text-xs text-slate-500 dark:text-dark-muted font-bold border">{spec}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-gray-900 dark:text-dark-text text-sm border-b border-gray-100 dark:border-dark-border pb-2.5">Depoimentos e Avaliações de Parceiros</h4>
                        <div className="space-y-4 mt-4">
                          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-dark-border bg-slate-50/50 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-800 dark:text-dark-text">Mariana Silva</span>
                              <div className="flex items-center text-amber-500 gap-0.5"><Star className="h-3 w-3 fill-amber-500" /> 5.0</div>
                            </div>
                            <p className="text-gray-500 dark:text-dark-muted italic leading-relaxed">"Fez o split de comissão imediatamente no primeiro dia útil após o fechamento do imóvel na Pituba. Agilidade surpreendente e extremo profissionalismo."</p>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-dark-border bg-slate-50/50 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-800 dark:text-dark-text">Ana Costa</span>
                              <div className="flex items-center text-amber-500 gap-0.5"><Star className="h-3 w-3 fill-amber-500" /> 4.9</div>
                            </div>
                            <p className="text-gray-500 dark:text-dark-muted italic leading-relaxed">"Corretor muito correto. Fizemos uma parceria de alto rigo no Itaim, agendou rapidamente, informou o cliente de forma precisa e foi fundamental nas tratativas."</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "globocatalogo" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text">Catálogo Global de Imóveis</h2>
                <p className="text-sm text-gray-500 dark:text-dark-muted">Veja todos os imóveis cadastrados por todos os corretores da plataforma.</p>
              </div>
              {/* Global Catalog Filters */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <select
                  value={gTypeFilter}
                  onChange={(e) => setGTypeFilter(e.target.value)}
                  className="rounded-full border border-[#d2d2d7] dark:border-dark-border bg-white dark:bg-dark-card text-[#1d1d1f] dark:text-dark-text px-4 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0071e3] transition cursor-pointer"
                >
                  <option value="todos">Tipo (Todos)</option>
                  <option value="apartamento">Apartamento</option>
                  <option value="casa">Casa</option>
                  <option value="terreno">Terreno</option>
                  <option value="cobertura">Cobertura</option>
                  <option value="comercial">Comercial</option>
                </select>

                <select
                  value={gCityFilter}
                  onChange={(e) => setGCityFilter(e.target.value)}
                  className="rounded-full border border-[#d2d2d7] dark:border-dark-border bg-white dark:bg-dark-card text-[#1d1d1f] dark:text-dark-text px-4 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0071e3] transition cursor-pointer"
                >
                  <option value="todas">Cidade (Todas)</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={gPurposeFilter}
                  onChange={(e) => setGPurposeFilter(e.target.value)}
                  className="rounded-full border border-[#d2d2d7] dark:border-dark-border bg-white dark:bg-dark-card text-[#1d1d1f] dark:text-dark-text px-4 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0071e3] transition cursor-pointer"
                >
                  <option value="todos">Finalidade (Todas)</option>
                  <option value="venda">Venda</option>
                  <option value="locação">Locação</option>
                </select>

                <select
                  value={gBedroomsFilter}
                  onChange={(e) => setGBedroomsFilter(e.target.value)}
                  className="rounded-full border border-[#d2d2d7] dark:border-dark-border bg-white dark:bg-dark-card text-[#1d1d1f] dark:text-dark-text px-4 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0071e3] transition cursor-pointer"
                >
                  <option value="todos">Quartos (Todos)</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4+</option>
                </select>

                {(gTypeFilter !== "todos" || gCityFilter !== "todas" || gPurposeFilter !== "todos" || gBedroomsFilter !== "todos") && (
                  <button
                    onClick={() => { setGTypeFilter("todos"); setGCityFilter("todas"); setGPurposeFilter("todos"); setGBedroomsFilter("todos"); }}
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-[#0071e3] hover:bg-blue-50 dark:hover:bg-blue-900/30 transition cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {(() => {
                const filtered = properties.filter(p => {
                  if (gTypeFilter !== "todos" && p.type !== gTypeFilter) return false;
                  if (gCityFilter !== "todas" && p.city.toLowerCase() !== gCityFilter.toLowerCase()) return false;
                  if (gPurposeFilter !== "todos" && p.purpose !== gPurposeFilter) return false;
                  if (gBedroomsFilter !== "todos") {
                    if (gBedroomsFilter === "4" && p.bedrooms < 4) return false;
                    if (gBedroomsFilter !== "4" && p.bedrooms !== Number(gBedroomsFilter)) return false;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center bg-white dark:bg-dark-card p-12 border border-dashed rounded-2xl">
                      <Building2 className="h-10 w-10 text-gray-300 dark:text-gray-500 mx-auto" />
                      <p className="text-xs text-gray-500 dark:text-dark-muted mt-3 font-medium">Nenhum imóvel encontrado com esses filtros.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((p) => (
                    <div key={p.id} className="bg-white dark:bg-dark-card border rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                      {p.photos && p.photos.length > 0 ? (
                        <div className="relative h-44 w-full bg-slate-100 dark:bg-gray-800">
                          <img src={p.photos[0]} alt={p.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={hideBrokenImg} />
                          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[9px] font-bold px-2 py-0.5 rounded-md font-mono">{p.photos.length} {p.photos.length === 1 ? 'Foto' : 'Fotos'}</span>
                        </div>
                      ) : (
                        <div className="h-44 w-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 text-center border-b">
                          <Building2 className="h-7 w-7 text-slate-300 dark:text-gray-500" />
                          <span className="text-[9px] text-slate-400 dark:text-dark-muted font-medium mt-1">Nenhuma foto anexada</span>
                        </div>
                      )}
                      <div className="p-4 space-y-3 text-xs flex-1 flex flex-col justify-end">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-wider">{p.status}</span>
                          <span className="text-slate-400 dark:text-dark-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-dark-text leading-tight line-clamp-1">{p.title}</h4>
                        <div className="flex flex-wrap gap-1 text-[10px] text-gray-500 dark:text-dark-muted font-medium">
                          <span>{p.neighborhood}, {p.city}</span>
                          <span>•</span>
                          <span>{p.bedrooms} qts</span>
                          <span>•</span>
                          <span>{p.area}m²</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-gray-800/50 border-t pt-2 mt-2 flex items-center justify-between">
                          <p className="font-bold text-gray-900 dark:text-dark-text">R$ {p.price.toLocaleString("pt-BR")}</p>
                          <button onClick={() => setSelectedListingDetail({ ...p, feedType: "property" })} className="inline-flex h-8 items-center gap-1 rounded-xl border border-gray-300 dark:border-dark-border px-3 py-1 font-bold text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-gray-800 text-[11px] cursor-pointer">
                            <Eye className="h-3.5 w-3.5" />
                            Ver Ficha
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
            </div>
          )}

          {activeTab === "admin" && (
            <AdminPanel 
              activeBroker={activeBroker} 
              onRefreshGlobalState={fetchAllData} 
              onSelectPropertyDetail={(prop) => {
                setSelectedListingDetail({ ...prop, feedType: "property" });
                setActivePhotoIdx(0);
                setIsEditingPhotos(true);
                setEditingPhotosList(prop.photos || []);
              }}
            />
          )}
        </div>
      </main>

      {/* MODAL: Switch broker simulation dialog */}
      {isSwitchBrokerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-card border border-gray-150 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-3">
              <h3 className="font-bold text-gray-900 dark:text-dark-text text-base flex items-center gap-1.5">
                <RefreshCw className="h-5 w-5 text-purple-600" />
                Alternar Broker Simulado
              </h3>
              <button
                onClick={() => setIsSwitchBrokerOpen(false)}
                className="p-2.5 rounded-lg border border-gray-200 dark:border-dark-border text-gray-400 dark:text-dark-muted hover:text-black hover:bg-slate-50 dark:hover:bg-gray-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="text-xs text-gray-500 dark:text-dark-muted leading-normal space-y-3.5">
              <p>
                Escolha abaixo outro corretor da rede para simular interações Cruzadas!
              </p>
              
              <div className="space-y-2">
                {simulatedBrokers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSwitchBroker(b.id)}
                    className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-dark-border hover:bg-purple-50/40 hover:border-purple-200 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={b.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0 border" referrerPolicy="no-referrer" onError={hideBrokenImg} />
                      <div>
                        <p className="font-bold text-gray-900 dark:text-dark-text leading-tight">{b.name} {b.isAdmin ? "(Admin)" : ""}</p>
                        <p className="text-[10px] text-gray-400 dark:text-dark-muted font-semibold">{b.creci} | {b.city}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-md border border-purple-100">Selecionar</span>
                  </button>
                ))}
              </div>

              {/* Simulation registration drawer */}
              <div className="border-t border-gray-100 dark:border-dark-border pt-4 space-y-3">
                <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-dark-muted tracking-wider">Simular Novo Cadastro de Corretor autônomo</span>
                
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const data = {
                      name: (form.elements.namedItem("name") as HTMLInputElement).value,
                      email: (form.elements.namedItem("email") as HTMLInputElement).value,
                      creci: (form.elements.namedItem("creci") as HTMLInputElement).value,
                      phone: "+55 (71) 99312-3200",
                      city: (form.elements.namedItem("city") as HTMLSelectElement).value,
                    };
                    handleSimulateNewRegistration(data);
                  }}
                  className="space-y-2.5"
                >
                  <input type="text" name="name" required placeholder="Nome Completo do Corretor" className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2 text-xs" />
                  <input type="email" name="email" required placeholder="E-mail exclusivo de acesso" className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2 text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" name="creci" required placeholder="Ex: CRECI 23991-F" className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2 text-xs" />
                    <select name="city" className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2 text-xs">
                      <option value="Salvador">Salvador</option>
                      <option value="São Paulo">São Paulo</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full rounded-xl bg-purple-600 py-2.5 font-bold text-white text-xs border-0 hover:bg-purple-700 cursor-pointer">
                    Salvar e Entrar Como Novo Corretor
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Upload CRECI for approval (PRD Section 6.2) */}
      {showDocUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleUploadCreciDocs} className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-card border border-gray-150 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-dark-border pb-3">
              <h3 className="font-bold text-gray-900 dark:text-dark-text text-base">Verificação Profissional de CRECI</h3>
              <button
                type="button"
                onClick={() => setShowDocUploadModal(false)}
                className="p-2 text-gray-400 dark:text-dark-muted hover:text-black rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-dark-muted leading-relaxed">
              Carregue os documentos solicitados. Seu CRECI passará por auditoria em minutos e você receberá o <b>Selo de Corretor Verificado</b>.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-dark-muted uppercase mb-1">Upload da Cédula Física de Regularidade CRECI *</label>
                <input
                  type="text"
                  required
                  placeholder="URL da imagem (ou simule digitando 'cadastro_creci_validado.png')"
                  value={creciDoc}
                  onChange={(e) => setCreciDoc(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2.5"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-dark-muted uppercase mb-1">Documento de Identificação Oficial (RG/CNH) *</label>
                <input
                  type="text"
                  required
                  placeholder="URL da foto (ou simule digitando 'doc_identidade_frente.png')"
                  value={identDoc}
                  onChange={(e) => setIdentDoc(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2.5"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDocUploadModal(false)}
                className="rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-700 dark:text-dark-text font-semibold px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800 text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isVerifyingState}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 border-0 shadow-sm text-xs"
              >
                {isVerifyingState ? "Enviando..." : "Enviar para Homologação"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Render full details of listing with rating form trigger (PRD Section 6.14) */}
      {selectedListingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-dark-card border p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto relative">
            <div className="flex items-center justify-between -mt-1 -mr-1">
              <button
                onClick={() => {
                  setSelectedListingDetail(null);
                  setIsEditingPhotos(false);
                  setEditingPhotosList([]);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-dark-muted hover:text-black px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                onClick={() => {
                  setSelectedListingDetail(null);
                  setIsEditingPhotos(false);
                  setEditingPhotosList([]);
                }}
                className="p-2 text-gray-400 dark:text-dark-muted hover:text-black border rounded-lg bg-white dark:bg-dark-card cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              selectedListingDetail.feedType === "property" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"
            }`}>
              {selectedListingDetail.feedType === "property" ? "Captação de Corretor" : "Procura de Comprador"}
            </span>

            <div className="space-y-2">
              <h3 className="font-extrabold text-gray-900 dark:text-dark-text text-lg leading-tight">
                {selectedListingDetail.feedType === "property" ? selectedListingDetail.title : `Procura Ativa de Comprador em ${selectedListingDetail.city}`}
              </h3>
              <p className="text-xs text-gray-500 dark:text-dark-muted font-medium">{selectedListingDetail.neighborhood} | {selectedListingDetail.city}</p>
            </div>

            {/* Photo carousel or cover image block */}
            {selectedListingDetail.feedType === "property" ? (
              <div className="space-y-3">
                {isEditingPhotos ? (
                  <div className="space-y-4 bg-slate-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-slate-100 dark:border-dark-border">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-xs font-bold text-gray-900 dark:text-dark-text uppercase font-sans">Gerenciar Imagens</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-dark-muted font-mono">
                        {editingPhotosList.length} / {maxPhotosLimit} fotos
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {editingPhotosList.map((photo, index) => (
                        <div key={index} className="relative aspect-video rounded-lg overflow-hidden border bg-white dark:bg-dark-card group">
                          <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={hideBrokenImg} />
                          <button
                            type="button"
                            onClick={() => setEditingPhotosList(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-1 right-1 p-0.5 bg-red-650 hover:bg-red-700 dark:bg-red-800/80 dark:hover:bg-red-900/80 text-white rounded-md cursor-pointer max-w-min"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {editingPhotosList.length === 0 && (
                        <div className="col-span-4 text-center py-4 bg-white dark:bg-dark-card rounded-lg border border-dashed text-slate-400 dark:text-dark-muted">
                          <p className="text-xs font-semibold">Nenhuma foto adicionada ainda.</p>
                        </div>
                      )}
                    </div>

                    {editingPhotosList.length < maxPhotosLimit && (
                      <div
                        onDragOver={handleDragOverEdit}
                        onDragLeave={handleDragLeaveEdit}
                        onDrop={handleDropEdit}
                        className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                          isDraggingEdit
                            ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/30 scale-[0.99]"
                            : "border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:bg-slate-100 dark:hover:bg-gray-800"
                        } cursor-pointer relative`}
                      >
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileChangeEdit}
                          disabled={editingPhotosList.length >= maxPhotosLimit || isUploadingEdit}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="pointer-events-none">
                          <div className="flex justify-center mb-1">
                            <div className={`p-2 rounded-full bg-blue-50 text-blue-650 dark:bg-blue-900/40 dark:text-blue-300 ${isUploadingEdit ? "animate-pulse" : ""}`}>
                              {isUploadingEdit ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] font-bold text-blue-655 dark:text-blue-300">Arraste fotos ou clique para enviar</p>
                          <p className="text-[9px] text-gray-400 dark:text-dark-muted">Diretamente para o S3/MinIO ("imob")</p>
                        </div>
                      </div>
                    )}

                    {editingPhotosList.length < maxPhotosLimit && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link da foto (https://...)"
                          value={editingNewPhotoUrl}
                          onChange={(e) => setEditingNewPhotoUrl(e.target.value)}
                          className="flex-1 rounded-xl border border-gray-300 dark:border-dark-border px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 bg-white dark:bg-dark-card"
                        />
                        <button
                          type="button"
                          disabled={!editingNewPhotoUrl.trim() || editingPhotosList.length >= maxPhotosLimit}
                          onClick={() => {
                            setEditingPhotosList(prev => [...prev, editingNewPhotoUrl.trim()]);
                            setEditingNewPhotoUrl("");
                          }}
                          className="rounded-xl bg-blue-600 text-white font-bold px-3 py-1.5 text-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                          Adicionar
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-gray-150 dark:border-dark-border">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingPhotos(false);
                          setEditingPhotosList([]);
                        }}
                        className="flex-1 rounded-xl border border-gray-300 dark:border-dark-border font-semibold py-2 text-xs text-gray-750 dark:text-dark-text hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSavePropertyPhotos(selectedListingDetail.id)}
                        className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 text-xs cursor-pointer"
                      >
                        Salvar Fotos
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedListingDetail.photos && selectedListingDetail.photos.length > 0 ? (
                      <div className="space-y-2">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-gray-800 border">
                          <img
                            src={selectedListingDetail.photos[activePhotoIdx < selectedListingDetail.photos.length ? activePhotoIdx : 0]}
                            alt={`Foto ${activePhotoIdx + 1}`}
                            className="h-full w-full object-cover transition-all duration-300"
                            referrerPolicy="no-referrer"
                            onError={hideBrokenImg}
                          />
                          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                            {(activePhotoIdx < selectedListingDetail.photos.length ? activePhotoIdx : 0) + 1} / {selectedListingDetail.photos.length}
                          </span>
                        </div>

                        {selectedListingDetail.photos.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                            {selectedListingDetail.photos.map((photo: string, index: number) => (
                              <button
                                key={index}
                                onClick={() => setActivePhotoIdx(index)}
                                className={`relative h-12 w-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                                  activePhotoIdx === index ? "border-blue-600 scale-[0.98]" : "border-transparent opacity-70 hover:opacity-100"
                                }`}
                              >
                                <img
                                  src={photo}
                                  alt={`Miniatura ${index + 1}`}
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={hideBrokenImg}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-dark-border text-slate-400 dark:text-dark-muted">
                        <ImageIcon className="h-8 w-8 text-slate-300 dark:text-gray-500 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-gray-500 dark:text-dark-muted">Este anúncio não possui fotos enviadas.</p>
                      </div>
                    )}

                    {(activeBroker?.isAdmin || selectedListingDetail.createdBy === activeBroker?.id) && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPhotosList(selectedListingDetail.photos || []);
                            setIsEditingPhotos(true);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-650 hover:text-blue-750 dark:text-blue-300 dark:hover:text-blue-200 dark:bg-blue-900/40 dark:border-blue-700/50 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition cursor-pointer"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          Gerenciar Fotos (S3/MinIO)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              ) : (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-gray-800 border">
                  <img src={selectedListingDetail.coverPhoto || PLACEHOLDER_IMG} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={hideBrokenImg} />
                </div>
              )}

            {/* Main specs box */}
            <div className="grid grid-cols-3 gap-2.5 bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-dark-border p-3 rounded-xl text-xs text-slate-500 dark:text-dark-muted text-center font-semibold">
              <div>
                <p className="text-[10px] text-gray-400 dark:text-dark-muted uppercase tracking-wide">Quartos</p>
                <p className="text-gray-800 dark:text-dark-text text-sm font-bold mt-0.5">{selectedListingDetail.bedrooms} quartos</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-dark-muted uppercase tracking-wide">Garagem</p>
                <p className="text-gray-800 dark:text-dark-text text-sm font-bold mt-0.5">{selectedListingDetail.parkingSpots || 0} vagas</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-dark-muted uppercase tracking-wide">Área Útil</p>
                <p className="text-gray-800 dark:text-dark-text text-sm font-bold mt-0.5">{selectedListingDetail.area || selectedListingDetail.minArea} m²</p>
              </div>
            </div>

              <div className="text-xs space-y-3">
                <span className="font-bold text-gray-400 dark:text-dark-muted uppercase tracking-widest text-[9px] block">Descrição Oficial</span>
                <div className="text-gray-600 dark:text-dark-muted leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100 dark:border-dark-border">
                  {selectedListingDetail.feedType === "property" ? <MarkdownText text={selectedListingDetail.description} /> : selectedListingDetail.notes}
                </div>

              {selectedListingDetail.feedType === "property" ? (
                <p className="bg-blue-50 text-blue-800 rounded-lg p-2.5 font-bold leading-normal">
                  Partilha de Comissão Informada: {selectedListingDetail.commission}
                </p>
              ) : (
                <div className="p-3 bg-indigo-50/50 text-indigo-950 rounded-xl space-y-1 border border-indigo-100">
                  <p className="font-bold">Forma de pagamento comprador:</p>
                  <p className="italic">{selectedListingDetail.paymentMethod}</p>
                </div>
              )}
            </div>

            {/* Quick action: simulate rating the owner broker of this listing (PRD Section 6.14) */}
            <div className="border-t border-slate-100 dark:border-dark-border pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedListingDetail(null)}
                className="flex-1 rounded-xl border font-semibold py-2.5 text-xs text-gray-700 dark:text-dark-text hover:bg-slate-50 dark:hover:bg-gray-800"
              >
                Voltar ao Feed
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddReviewModal(selectedListingDetail.createdBy);
                  setSelectedListingDetail(null);
                }}
                className="flex-1 rounded-xl bg-slate-900 text-white font-bold py-2.5 text-xs hover:bg-black"
              >
                Avaliar Corretor Responsável
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Submit rating testimonial (PRD Section 6.14 & 6.15 Rating systems) */}
      {showAddReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleSubmitReview} className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-card p-6 shadow-2xl border space-y-4">
            <h3 className="font-extrabold text-gray-900 dark:text-dark-text text-base">Avaliar Corretor de Parceria</h3>
            <p className="text-xs text-gray-500 dark:text-dark-muted leading-relaxed">
              Adicione uma avaliação de 1 a 5 estrelas e um testemunho sobre a facilidade e veracidade técnica desse corretor ao partilhar informações de imóveis na rede.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-dark-muted uppercase tracking-widest mb-1">Nota de Parceria (Estrelas)</label>
                <select
                  value={reviewScore}
                  onChange={(e) => setReviewScore(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2 font-bold"
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (Excelente conduta e split honesto)</option>
                  <option value={4}>⭐⭐⭐⭐ (Muito bom profissionalismo)</option>
                  <option value={3}>⭐⭐⭐ (Tratativas burocráticas normais)</option>
                  <option value={2}>⭐⭐ (Falta de agilidade ou retorno)</option>
                  <option value={1}>⭐ (Descaso na intermediação imobiliária)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-dark-muted uppercase tracking-widest mb-1">Depoimento Testemunhal</label>
                <textarea
                  required
                  rows={3}
                  value={reviewComment}
                  placeholder="Ex: 'Renato me deu total suporte, dividiu a comissão no fechamento de forma exemplar. Super profissional'"
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-dark-border p-2.5"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddReviewModal(null)}
                className="rounded-xl border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text font-semibold px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-800 text-xs"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={isSubmittingReview}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 border-0 shadow-sm text-xs"
              >
                {isSubmittingReview ? "Salvando..." : "Publicar Avaliação"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Slide overlays for Form structures */}
      {showPropertyForm && (
        <div className="fixed inset-0 z-45 bg-[#f8fafc] dark:bg-dark-bg p-6 md:p-12 overflow-y-auto">
          <PropertyForm
            cities={cities}
            onCancel={() => setShowPropertyForm(false)}
            onSuccess={() => {
              setShowPropertyForm(false);
              fetchAllData();
            }}
          />
        </div>
      )}

      {showDemandForm && (
        <div className="fixed inset-0 z-45 bg-[#f8fafc] dark:bg-dark-bg p-6 md:p-12 overflow-y-auto">
          <DemandForm
            cities={cities}
            onCancel={() => setShowDemandForm(false)}
            onSuccess={() => {
              setShowDemandForm(false);
              fetchAllData();
            }}
          />
        </div>
      )}

    </div>
  );
}
