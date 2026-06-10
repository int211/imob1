import { useState, useEffect, useRef } from "react";
import { 
  Users, 
  FileCheck, 
  Check, 
  X, 
  ShieldAlert, 
  BookOpen, 
  Landmark, 
  ChevronRight, 
  Star, 
  RefreshCw, 
  Database, 
  Server, 
  HardDrive, 
  Terminal, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Layers,
  Settings,
  Key,
  Image as ImageIcon,
  User,
  Save,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  Camera,
  Zap
} from "lucide-react";
import { Corretor, SystemSettings, City } from "../types";

interface AdminPanelProps {
  activeBroker: Corretor | null;
  onRefreshGlobalState: () => void;
  onSelectPropertyDetail: (prop: any) => void;
}

type ActiveSubTab = "moderation" | "database" | "config" | "properties" | "locations";

export default function AdminPanel({ activeBroker, onRefreshGlobalState, onSelectPropertyDetail }: AdminPanelProps) {
  // Global States
  const [metrics, setMetrics] = useState<any>(null);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<ActiveSubTab>("moderation");

  // Properties moderation state
  const [properties, setProperties] = useState<any[]>([]);
  const [propsLoading, setPropsLoading] = useState(false);

  const fetchProperties = async () => {
    setPropsLoading(true);
    try {
      const res = await fetch("/api/properties");
      if (res.ok) {
        const data = await res.json();
        setProperties(data);
      }
    } catch (err) {
      console.error("Failed to load properties list for administrative moderation:", err);
    } finally {
      setPropsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "properties") {
      fetchProperties();
    }
  }, [activeSubTab]);

  // Moderation States
  const [reviewBroker, setReviewBroker] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Database Connection Panel States
  const [dbStatusData, setDbStatusData] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbActionLoading, setDbActionLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Config & LLM States
  const [settings, setSettings] = useState<SystemSettings>({
    geminiApiKey: "",
    llmModelName: "openai/gpt-4o-mini",
    llmEndpointUrl: "https://openrouter.ai/api/v1/chat/completions",
    maxPhotosPerProperty: 5,
    globalCatalogEnabled: false
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testLlmResult, setTestLlmResult] = useState<string | null>(null);
  const [llmModels, setLlmModels] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [showModelList, setShowModelList] = useState(false);
  const modelListRef = useRef<HTMLDivElement>(null);

  const filteredModels = modelSearch
    ? llmModels.filter(m =>
        m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.name.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : llmModels;

  // Admin Profile States
  const [adminProfile, setAdminProfile] = useState({
    name: "",
    email: "",
    creci: "",
    phone: "",
    photoUrl: ""
  });
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminUploadingPhoto, setAdminUploadingPhoto] = useState(false);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch live platform indicators
      const resMetrics = await fetch("/api/admin/metrics");
      const dataMetrics = await resMetrics.json();
      setMetrics(dataMetrics);

      // 2. Fetch brokers listing
      const resBrokers = await fetch("/api/admin/brokers");
      const dataBrokers = await resBrokers.json();
      setBrokers(dataBrokers);
    } catch (err) {
      console.error("Failed to load administrative indicators:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbStatus = async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      const res = await fetch("/api/admin/db-status");
      const data = await res.json();
      setDbStatusData(data);
    } catch (err: any) {
      setDbError("Logo de comunicação ou falha crítica de roteamento.");
      console.error("Failed fetching SQL connectivity indicator status:", err);
    } finally {
      setDbLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.geminiApiKey) {
          fetchLlmModels();
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const fetchLlmModels = async () => {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/admin/llm-models");
      const text = await res.text();
      console.log("[fetchLlmModels] status:", res.status, "body:", text.slice(0, 300));
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setModelsError(`Servidor retornou (${res.status}): ${text.slice(0, 200)}`);
        return;
      }
      if (res.ok) {
        setLlmModels(data);
      } else {
        setModelsError(data.error || "Erro desconhecido");
      }
    } catch (err: any) {
      setModelsError(`Falha de rede: ${err.message}`);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchDbStatus();
    fetchSettings();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modelListRef.current && !modelListRef.current.contains(e.target as Node)) {
        setShowModelList(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (activeBroker) {
      setAdminProfile({
        name: activeBroker.name || "",
        email: activeBroker.email || "",
        creci: activeBroker.creci || "",
        phone: activeBroker.phone || "",
        photoUrl: activeBroker.photoUrl || ""
      });
    }
  }, [activeBroker]);

  // Process approval/rejection (PRD Section 6.2 & 6.15)
  const handleVerifyAction = async (brokerId: string, action: "Aprovar" | "Recusar") => {
    if (action === "Recusar" && !rejectionReason) {
      if (!confirm("Tem certeza que deseja suspender/recusar este corretor sem motivo?")) return;
    }
    setIsActionLoading(true);
    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerId,
          action,
          reason: rejectionReason || (action === "Recusar" ? "Suspenso pelo administrador" : undefined)
        })
      });

      if (response.ok) {
        setReviewBroker(null);
        setRejectionReason("");
        await fetchAdminData();
        onRefreshGlobalState(); // trigger parent state update
      } else {
        alert("Falha ao registrar ação administrativa.");
      }
    } catch (err) {
      alert("Erro ao conectar ao servidor administrativo.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDbSync = async () => {
    setDbActionLoading(true);
    setDbMessage(null);
    setDbError(null);
    try {
      const res = await fetch("/api/admin/db-sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDbMessage(data.message);
        await fetchDbStatus();
        onRefreshGlobalState();
      } else {
        setDbError(data.error || "Erro ao puxar dados da VPS.");
      }
    } catch (err: any) {
      setDbError("Erro de comunicação com o servidor.");
    } finally {
      setDbActionLoading(false);
    }
  };

  const handleDbSeed = async () => {
    if (!confirm("Isso irá preencher as tabelas vazias no Neon PostgreSQL com os corretores, anúncios e procuras de demonstração. Deseja continuar?")) {
      return;
    }
    setDbActionLoading(true);
    setDbMessage(null);
    setDbError(null);
    try {
      const res = await fetch("/api/admin/db-seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDbMessage(data.message);
        await fetchDbStatus();
        onRefreshGlobalState();
      } else {
        setDbError(data.error || "Erro ao injetar massa de dados na VPS.");
      }
    } catch (err: any) {
      setDbError("Erro ao invocar seed.");
    } finally {
      setDbActionLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    const configLine = `psql "$DATABASE_URL" < schema.sql`;
    navigator.clipboard.writeText(configLine);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const uploadAdminPhoto = async (file: File) => {
    setAdminUploadingPhoto(true);
    try {
      const base64 = await convertToBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data: base64, filename: file.name })
      });
      if (res.ok) {
        const data = await res.json();
        setAdminProfile(prev => ({ ...prev, photoUrl: data.url }));
      } else {
        const errData = await res.json();
        alert(`Falha ao subir foto: ${errData.error || "Erro desconhecido"}`);
      }
    } catch (err: any) {
      alert(`Erro no upload: ${err.message}`);
    } finally {
      setAdminUploadingPhoto(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setSettingsMessage("Configurações atualizadas com sucesso!");
        onRefreshGlobalState();
        setTimeout(() => setSettingsMessage(null), 3500);
        if (updated.geminiApiKey) {
          fetchLlmModels();
        }
      } else {
        alert("Erro ao gravar novas configurações.");
      }
    } catch (err) {
      alert("Falha de rede ao se conectar com o servidor.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleTestLlm = async () => {
    setTestingLlm(true);
    setTestLlmResult(null);
    try {
      const res = await fetch("/api/admin/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: settings.geminiApiKey, model: settings.llmModelName })
      });
      const data = await res.json();
      if (data.success) {
        setTestLlmResult(`Conexão OK — resposta: "${data.response}"`);
      } else {
        setTestLlmResult(`Erro: ${data.error}`);
      }
    } catch (err: any) {
      setTestLlmResult(`Falha de rede: ${err.message}`);
    } finally {
      setTestingLlm(false);
    }
  };

  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBroker) {
      alert("Nenhum corretor ativo em simulação.");
      return;
    }
    setAdminSaving(true);
    setAdminMessage(null);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeBroker.id,
          ...adminProfile
        })
      });
      if (res.ok) {
        setAdminMessage("Dados e Foto do Administrador alterados com sucesso!");
        onRefreshGlobalState();
        setTimeout(() => setAdminMessage(null), 3500);
      } else {
        alert("Erro ao salvar dados do admin no servidor.");
      }
    } catch (err) {
      alert("Falha de conexão com o servidor de dados.");
    } finally {
      setAdminSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
        <p className="text-sm font-medium text-gray-500">Carregando painel de moderação e auditoria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Metrics Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Painel de Auditoria & Controle</h2>
          <p className="text-xs text-gray-500">Gestão de corretores, verificação de CRECI e controle do banco de dados Neon PostgreSQL.</p>
        </div>
        
        {/* Toggle between tabs */}
        <div className="inline-flex bg-[#e8e8ed] p-0.5 rounded-full shrink-0 self-start md:self-auto font-sans">
          <button
            onClick={() => setActiveSubTab("moderation")}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === "moderation"
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#515154] hover:text-[#1d1d1f]"
            }`}
          >
            Análise de CRECI
          </button>
          <button
            onClick={() => setActiveSubTab("database")}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "database"
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#515154] hover:text-[#1d1d1f]"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Neon PostgreSQL Status
          </button>
          <button
            onClick={() => setActiveSubTab("config")}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "config"
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#515154] hover:text-[#1d1d1f]"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            Configurações & LLM
          </button>
          <button
            onClick={() => setActiveSubTab("properties")}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "properties"
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#515154] hover:text-[#1d1d1f]"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Imóveis & Fotos
          </button>
          <button
            onClick={() => setActiveSubTab("locations")}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "locations"
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#515154] hover:text-[#1d1d1f]"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            Localidades
          </button>
        </div>
      </div>

      {metrics && activeSubTab === "moderation" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Users className="h-6 w-6" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Corretores</span>
              <p className="text-xl font-extrabold text-gray-900 leading-none mt-1">{metrics.totalBrokers}</p>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <FileCheck className="h-6 w-6" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Aguardando CRECI</span>
              <p className="text-xl font-extrabold text-gray-900 leading-none mt-1">{metrics.pendingVerifications}</p>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BookOpen className="h-6 w-6" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Anúncios / Procuras</span>
              <p className="text-xl font-extrabold text-gray-900 leading-none mt-1">{metrics.totalProperties + metrics.totalDemands}</p>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Landmark className="h-6 w-6" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Negócios Fechados</span>
              <p className="text-xl font-extrabold text-gray-900 leading-none mt-1">{metrics.closedDeals}</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW: MODERATION TAB                                         */}
      {/* ============================================================ */}
      {activeSubTab === "moderation" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Pending verification users */}
          <div className="lg:col-span-7 bg-white rounded-2xl border p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <ShieldAlert className="h-5 w-5 text-purple-600" />
              Solicitações de Verificação de CRECI
            </h3>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {brokers.filter(b => b.status === "Pendente").length === 0 ? (
                <div className="text-center py-10 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-gray-400 font-medium">Não há solicitações pendentes de análise no momento!</p>
                </div>
              ) : (
                brokers.filter(b => b.status === "Pendente").map((b) => (
                  <div
                    key={b.id}
                    onClick={() => { setReviewBroker(b); setRejectionReason(""); }}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      reviewBroker?.id === b.id 
                        ? "bg-purple-50/50 border-purple-200" 
                        : "bg-white border-gray-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={b.photoUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80"}
                        alt={b.name}
                        className="h-10 w-10 rounded-full object-cover shrink-0 border"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-bold text-gray-900 leading-tight truncate">{b.name}</p>
                        <p className="text-[11px] text-gray-500 font-semibold">{b.creci} | {b.city}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer bg-white border rounded-lg px-2.5 py-1.5 hover:border-purple-300 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <span className={`text-[10px] font-bold ${b.isAdmin ? "text-purple-700" : "text-gray-400"}`}>Admin</span>
                        <button
                          type="button"
                          onClick={async (e) => { e.stopPropagation();
                            try {
                              await fetch("/api/admin/toggle-admin", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ brokerId: b.id, isAdmin: !b.isAdmin })
                              });
                              await fetchAdminData();
                              onRefreshGlobalState();
                            } catch {}
                          }}
                          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors shadow-inner ${b.isAdmin ? "bg-purple-600" : "bg-gray-300"}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${b.isAdmin ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                        </button>
                      </label>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVerifyAction(b.id, "Aprovar"); }}
                        disabled={isActionLoading}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        Aprovar
                      </button>
                      <span className="flex h-8 w-8 items-center justify-center text-purple-600 hover:bg-purple-100 rounded-lg">
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Full list of all registered users */}
            <h3 className="text-base font-bold text-gray-900 border-t border-gray-100 pt-5 pb-1">Todos os Corretores</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto mt-2 text-xs">
              {brokers.filter(b => b.status !== "Pendente").map((b) => (
                <div key={b.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={b.photoUrl || ""} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 border" referrerPolicy="no-referrer" />
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate">{b.name}</p>
                      <p className="text-gray-400 truncate">{b.creci} | {b.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer bg-white border rounded-lg px-2.5 py-1.5 hover:border-purple-300 transition-colors" onClick={(e) => e.stopPropagation()}>
                      <span className={`text-[10px] font-bold ${b.isAdmin ? "text-purple-700" : "text-gray-400"}`}>
                        {b.isAdmin ? "Admin" : "Admin"}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await fetch("/api/admin/toggle-admin", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ brokerId: b.id, isAdmin: !b.isAdmin })
                            });
                            await fetchAdminData();
                            onRefreshGlobalState();
                          } catch {}
                        }}
                        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors shadow-inner ${b.isAdmin ? "bg-purple-600" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${b.isAdmin ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                      </button>
                    </label>
                    {b.status === "Aprovado" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Verificado</span>
                        <button
                          onClick={() => handleVerifyAction(b.id, "Recusar")}
                          disabled={isActionLoading}
                          className="rounded-lg border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1 text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                        >
                          Suspender
                        </button>
                      </div>
                    ) : b.status === "Rejeitado" || b.status === "Suspenso" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">{b.status === "Rejeitado" ? "Recusado" : b.status}</span>
                        <button
                          onClick={() => handleVerifyAction(b.id, "Aprovar")}
                          disabled={isActionLoading}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                        >
                          Reativar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">{b.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Documents and Review actions */}
          <div className="lg:col-span-5 bg-white rounded-2xl border p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              Análise Documental Detalhada
            </h3>

            {reviewBroker ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3">
                  <img
                    src={reviewBroker.photoUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover shrink-0 border"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-extrabold text-gray-900 text-sm">{reviewBroker.name}</h4>
                    <p className="text-gray-500 font-bold">{reviewBroker.creci} | {reviewBroker.email}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="font-bold text-gray-400 uppercase tracking-widest text-[9px] block">Documento de Identidade</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-100 text-center py-6 flex flex-col items-center justify-center p-3">
                    <span className="text-xs font-bold text-gray-700">Digitalização do Documento RG/CNH</span>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">
                      {reviewBroker.identDocUrl || "MOCK_IDENTITY_DOCUMENT_CARD.JPEG"}
                    </p>
                    <div className="mt-3 inline-flex bg-slate-800 text-white rounded-md px-3 py-1 text-[10px] font-semibold cursor-pointer">
                      Visualizar em Alta Resolução
                    </div>
                  </div>

                  <span className="font-bold text-gray-400 uppercase tracking-widest text-[9px] block">Cópia da carteira professional CRECI</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-100 text-center py-6 flex flex-col items-center justify-center p-3">
                    <span className="text-xs font-bold text-gray-700">Digitalização da Carteira do Conselho</span>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">
                      {reviewBroker.creciDocUrl || "MOCK_CRECI_SUBMISSION.PDF"}
                    </p>
                    <div className="mt-3 inline-flex bg-slate-800 text-white rounded-md px-3 py-1 text-[10px] font-semibold cursor-pointer">
                      Visualizar em Alta Resolução
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Motivo de Recusa (Se recusar)</label>
                  <input
                    type="text"
                    placeholder="Ex: Foto tremida ou número ilegível do CRECI"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => handleVerifyAction(reviewBroker.id, "Recusar")}
                    className="flex-1 rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 py-3 font-semibold text-xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Recusar Registro
                  </button>

                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => handleVerifyAction(reviewBroker.id, "Aprovar")}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-semibold text-xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Aprovar e Liberar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400 text-xs">
                Selecione um corretor na lista lateral para carregar seus documentos profissionais cadastrados e avaliar o registro.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW: DATABASE CONNECTIONS CONTROL PANEL                    */}
      {/* ============================================================ */}
      {activeSubTab === "database" && (
        <div className="space-y-6">
          {/* Messages alerts */}
          {dbMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{dbMessage}</span>
            </div>
          )}

          {dbError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{dbError}</span>
            </div>
          )}

          {/* Connection cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Status Card */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-widest">Status da Conexão</span>
                <button 
                  onClick={fetchDbStatus} 
                  disabled={dbLoading}
                  className="text-gray-400 hover:text-purple-600 cursor-pointer"
                  title="Atualizar status"
                >
                  <RefreshCw className={`h-4 w-4 ${dbLoading ? "animate-spin text-purple-600" : ""}`} />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                {dbStatusData?.status?.connected ? (
                  <>
                    <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-lg font-extrabold text-emerald-700 leading-none">CONECTADO</span>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-lg font-extrabold text-amber-700 leading-none">OFFLINE FALLBACK</span>
                  </>
                )}
              </div>
              
              <p className="text-[11px] text-gray-500 leading-normal">
                {dbStatusData?.status?.connected 
                  ? "Sua aplicação está operando com persistência direta na nuvem."
                  : "Não foi possível conectar ao Neon PostgreSQL. A plataforma está rodando de forma resiliente usando o banco local JSON."}
              </p>
            </div>

            {/* Config Card */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-widest">Informações do Banco</span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-gray-400 font-semibold">Servidor/Host:</span>
                  <span className="font-bold text-gray-800 font-mono">{dbStatusData?.status?.host || "Neon PostgreSQL (neon.tech)"}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-gray-400 font-semibold">Porta:</span>
                  <span className="font-bold text-gray-800 font-mono">{dbStatusData?.status?.port || "5432"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-semibold">Usuário PostgreSQL:</span>
                  <span className="font-bold text-gray-800 font-mono">{dbStatusData?.status?.user || "neondb_owner"}</span>
                </div>
              </div>
            </div>

            {/* Sync Indicators */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-widest">Operações Efetuadas</span>
              
              <div className="grid grid-cols-2 gap-2 text-center py-1">
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Writes Gravados</span>
                  <span className="text-base font-extrabold text-gray-900 leading-none mt-1 inline-block">
                    {dbStatusData?.status?.writesLogged || "0"}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Sync Falhas</span>
                  <span className={`text-base font-extrabold leading-none mt-1 inline-block ${
                    (dbStatusData?.status?.writesFailed || 0) > 0 ? "text-red-600" : "text-gray-900"
                  }`}>
                    {dbStatusData?.status?.writesFailed || "0"}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Sync Stats Table Comparison */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 border-b pb-3">
              <Layers className="h-4.5 w-4.5 text-purple-600" />
              Auditoria de Registros (Tabelas Relacionais vs. Memória Cache)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-500">
                <thead className="text-[10px] uppercase tracking-wider text-gray-400 bg-slate-50 rounded-lg">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-l-lg">Estrutura / Entidade</th>
                    <th className="px-4 py-3 font-semibold">Tabela PostgreSQL</th>
                    <th className="px-4 py-3 font-semibold text-center">Registros Cache (Front-End/Memory)</th>
                    <th className="px-4 py-3 font-semibold text-center rounded-r-lg">Registros Fisícos na VPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  <tr>
                    <td className="px-4 py-3 text-purple-700 font-bold">Corretores Cadastrados</td>
                    <td className="px-4 py-3 font-mono">corretores</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{dbStatusData?.memoryCounts?.brokers || 0}</td>
                    <td className="px-4 py-3 text-center font-bold text-purple-600">
                      {dbStatusData?.status?.connected ? (dbStatusData?.liveCounts?.brokers ?? "0") : "Offline"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-purple-700 font-bold">Anúncios (Ofertas)</td>
                    <td className="px-4 py-3 font-mono">properties</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{dbStatusData?.memoryCounts?.properties || 0}</td>
                    <td className="px-4 py-3 text-center font-bold text-purple-600">
                      {dbStatusData?.status?.connected ? (dbStatusData?.liveCounts?.properties ?? "0") : "Offline"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-purple-700 font-bold">Procuras (Demandas)</td>
                    <td className="px-4 py-3 font-mono">demands</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{dbStatusData?.memoryCounts?.demands || 0}</td>
                    <td className="px-4 py-3 text-center font-bold text-purple-600">
                      {dbStatusData?.status?.connected ? (dbStatusData?.liveCounts?.demands ?? "0") : "Offline"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-purple-700 font-bold">Partilhas / Matches</td>
                    <td className="px-4 py-3 font-mono">matches</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{dbStatusData?.memoryCounts?.matches || 0}</td>
                    <td className="px-4 py-3 text-center font-bold text-purple-600">
                      {dbStatusData?.status?.connected ? (dbStatusData?.liveCounts?.matches ?? "0") : "Offline"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-purple-700 font-bold">Avaliações Adicionais</td>
                    <td className="px-4 py-3 font-mono">ratings</td>
                    <td className="px-4 py-3 text-center text-gray-400">—</td>
                    <td className="px-4 py-3 text-center font-bold text-purple-600">
                      {dbStatusData?.status?.connected ? (dbStatusData?.liveCounts?.ratings ?? "0") : "Offline"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {!dbStatusData?.status?.connected && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[10px] leading-relaxed">
                <strong>Modo Offline Ativado:</strong> A tabela acima indica falha de conexão com o Neon PostgreSQL. Verifique se a DATABASE_URL está correta e se a rede permite conexão SSL na porta 5432.
              </div>
            )}
          </div>

          {/* Interactive Management Actions */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3">Ações de Controle Administrativo</h3>
            
            <div className="flex flex-col md:flex-row gap-4">
              
              <button
                type="button"
                disabled={dbActionLoading || !dbStatusData?.status?.connected}
                onClick={handleDbSync}
                className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 py-3.5 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dbActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Forçar Sincronização (importar da nuvem)
              </button>

              <button
                type="button"
                disabled={dbActionLoading || !dbStatusData?.status?.connected}
                onClick={handleDbSeed}
                className="flex-1 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 py-3.5 text-purple-700 font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dbActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4 text-purple-600" />}
                Injetar Corretores & Imóveis de Teste (Seed)
              </button>

            </div>
          </div>

          {/* PostgreSQL connection helper */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-purple-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-purple-300">Terminal — PostgreSQL Connection Helper</span>
              </div>
              <button
                onClick={handleCopyToClipboard}
                className="text-slate-400 hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Linha
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              O banco atual é <strong className="text-white">Neon PostgreSQL</strong> (cloud). Para conectar via terminal e rodar scripts SQL manualmente, use o comando abaixo com a connection string da sua variável de ambiente <code className="text-white font-mono">DATABASE_URL</code>:
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <code className="text-[10px] text-emerald-400 font-mono block break-all whitespace-normal">
                psql "$DATABASE_URL" &lt; schema.sql
              </code>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-sans">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
              <span>Certifique-se de que o <span className="text-slate-300 font-mono">psql</span> (PostgreSQL client) está instalado. A DATABASE_URL está definida no arquivo <span className="text-slate-300 font-mono">.env</span>.</span>
            </div>
          </div>

        </div>
      )}

      {activeSubTab === "config" && (
        <div className="space-y-6">
          {/* Configuration Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* CARD 1: LLM Settings */}
            <form onSubmit={handleSaveSettings} className="bg-white border text-left rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Key className="h-5 w-5 text-purple-600" />
                  Credenciais e Conexão da LLM
                </h3>

                <p className="text-xs text-gray-500 leading-normal">
                  Configure a chave da API do OpenRouter e o modelo de Inteligência Artificial que serão utilizados em toda a plataforma para categorização de procuras, otimização automática de descrições de imóveis e insights inteligentes de matches.
                </p>

                {settingsMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs font-bold leading-normal">
                    {settingsMessage}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">OpenRouter API Key</label>
                    <input
                      type="password"
                      placeholder="sk-or-v1-..."
                      value={settings.geminiApiKey}
                      onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                    />
                    <span className="text-[10px] text-gray-400 block">Chave mantida estritamente no servidor. Obtenha uma em <span className="underline">https://openrouter.ai/keys</span>.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Modelo (LLM Model)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1" ref={modelListRef}>
                        <input
                          type="text"
                          placeholder='Pesquisar modelo (ex: gpt-4, claude, gemini...) ou clique para ver todos'
                          value={modelSearch}
                          onFocus={() => {
                            setModelSearch("");
                            llmModels.length > 0 && setShowModelList(true);
                          }}
                          onChange={(e) => {
                            setModelSearch(e.target.value);
                            setShowModelList(true);
                          }}
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                        />
                        {settings.llmModelName && (
                          <div className="mt-1 text-[10px] text-purple-700 font-medium truncate px-1">
                            Selecionado: {llmModels.find(m => m.id === settings.llmModelName)?.name || settings.llmModelName}
                          </div>
                        )}
                        {showModelList && llmModels.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                            {loadingModels ? (
                              <div className="p-3 text-xs text-gray-400 text-center">Carregando...</div>
                            ) : filteredModels.length === 0 ? (
                              <div className="p-3 text-xs text-gray-400 text-center">Nenhum modelo encontrado</div>
                            ) : (
                              filteredModels.map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setSettings({ ...settings, llmModelName: m.id });
                                    setModelSearch(m.name);
                                    setShowModelList(false);
                                  }}
                                  className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-purple-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${settings.llmModelName === m.id ? "bg-purple-100 font-bold" : ""}`}
                                >
                                  <span className="block font-medium">{m.name}</span>
                                  <span className="block text-[10px] text-gray-400 truncate">{m.id}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={fetchLlmModels}
                        disabled={loadingModels || !settings.geminiApiKey}
                        className="rounded-xl bg-slate-100 hover:bg-slate-200 border border-gray-300 px-3 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shrink-0"
                        title="Atualizar lista de modelos do OpenRouter"
                      >
                        {loadingModels ? "..." : "⟳"}
                      </button>
                    </div>
                    {!settings.geminiApiKey && (
                      <span className="text-[10px] text-amber-600 block">Insira uma API Key e clique em "⟳" para listar os modelos disponíveis.</span>
                    )}
                    {modelsError && (
                      <span className="text-[10px] text-red-600 block">{modelsError}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Endpoint URL (avançado)</label>
                    <input
                      type="text"
                      placeholder="Ex: https://openrouter.ai/api/v1/chat/completions"
                      value={settings.llmEndpointUrl}
                      onChange={(e) => setSettings({ ...settings, llmEndpointUrl: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                    />
                    <span className="text-[10px] text-gray-400 block">Endpoint para roteamento opcional ou proxies corporativos compatíveis com OpenAI.</span>
                  </div>
                </div>

                {/* Photo Upload limit settings within the same card for elegant density */}
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pt-6 pb-2">
                  <ImageIcon className="h-5 w-5 text-purple-600" />
                  Regras de Upload e Mídia
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Catálogo Global</label>
                    <div className="flex items-center gap-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, globalCatalogEnabled: !settings.globalCatalogEnabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.globalCatalogEnabled ? "bg-purple-600" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${settings.globalCatalogEnabled ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
                      </button>
                      <span className="text-sm font-semibold text-gray-700">{settings.globalCatalogEnabled ? "Ativado" : "Desativado"}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1">Quando ativo, exibe o menu "Catálogo Global" para todos os corretores verem todas as postagens da plataforma.</span>
                  </div>

                  <div className="space-y-1 pt-3">
                    <label className="block font-bold text-gray-700">Limite Máximo de Fotos por Imóvel</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={settings.maxPhotosPerProperty}
                        onChange={(e) => setSettings({ ...settings, maxPhotosPerProperty: Number(e.target.value) })}
                        className="flex-1 accent-purple-600 cursor-pointer"
                      />
                      <span className="text-sm font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100 shrink-0 font-mono">
                        {settings.maxPhotosPerProperty} {settings.maxPhotosPerProperty === 1 ? 'foto' : 'fotos'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1">Este limite restringe a quantidade de anexos de imagens que corretores normais podem cadastrar em cada captação imobiliária.</span>
                  </div>

                  <div className="space-y-1 pt-3">
                    <label className="block font-bold text-gray-700">Raio de Proximidade (metros) para Duplicidade</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={settings.proximityRadius || 10}
                        onChange={(e) => setSettings({ ...settings, proximityRadius: Number(e.target.value) })}
                        className="flex-1 accent-purple-600 cursor-pointer"
                      />
                      <span className="text-sm font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100 shrink-0 font-mono">
                        {settings.proximityRadius || 10}m
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1">Imóveis cadastrados dentro deste raio (mesma localização) serão bloqueados para evitar duplicidade entre corretores.</span>
                  </div>
                </div>

                {/* S3 configuration settings within the same card for elegant density */}
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pt-6 pb-2">
                  <Layers className="h-5 w-5 text-purple-600" />
                  Conexão de Armazenamento - S3 / MinIO
                </h3>

                <p className="text-xs text-gray-500 leading-normal">
                  Configure o servidor S3 onde as fotos dos imóveis serão hospedadas automaticamente.
                </p>

                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">URL / Endpoint S3</label>
                    <input
                      type="text"
                      placeholder="Ex: https://minio.subirei.com.br"
                      value={settings.s3Url || ""}
                      onChange={(e) => setSettings({ ...settings, s3Url: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">Access Key</label>
                      <input
                        type="text"
                        placeholder="Seu Access Key"
                        value={settings.s3AccessKey || ""}
                        onChange={(e) => setSettings({ ...settings, s3AccessKey: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">Bucket Name</label>
                      <input
                        type="text"
                        placeholder="Ex: imob"
                        value={settings.s3BucketName || ""}
                        onChange={(e) => setSettings({ ...settings, s3BucketName: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Secret Key</label>
                    <input
                      type="password"
                      placeholder="Sua Secret Key"
                      value={settings.s3SecretKey || ""}
                      onChange={(e) => setSettings({ ...settings, s3SecretKey: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4 space-y-1">
                <label className="block font-bold text-gray-700">API Key para Importação Externa</label>
                <input
                  type="text"
                  placeholder="Chave secreta para autenticar chamadas à API de importação"
                  value={settings.apiKey || ""}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                />
                <span className="text-[10px] text-gray-400 block">
                  Envie esta chave no header <code className="bg-gray-100 px-1 rounded">x-api-key</code> ao chamar <code className="bg-gray-100 px-1 rounded">POST /api/demands/import</code>.
                </span>
              </div>

              <div className="pt-6 border-t mt-6 space-y-3">
                {testLlmResult && (
                  <div className={`p-3 rounded-xl text-xs font-bold leading-normal ${testLlmResult.startsWith("Conexão OK") ? "bg-emerald-50 border border-emerald-150 text-emerald-800" : "bg-red-50 border border-red-150 text-red-800"}`}>
                    {testLlmResult}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleTestLlm}
                  disabled={testingLlm || !settings.geminiApiKey}
                  className="w-full rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs py-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-40"
                >
                  <Zap className="h-4 w-4" />
                  {testingLlm ? "Testando..." : "Testar Conexão com LLM"}
                </button>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-3.5 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  {settingsSaving ? "Gravando Configurações..." : "Gravar Parâmetros Gerais"}
                </button>
              </div>
            </form>

            {/* CARD 2: Admin Profile Control */}
            <form onSubmit={handleSaveAdminProfile} className="bg-white border text-left rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <User className="h-5 w-5 text-purple-600" />
                  Meus Dados & Foto do Administrador
                </h3>

                <p className="text-xs text-gray-500 leading-normal">
                  Atualize suas próprias credenciais cadastrais exibidas no painel profissional e nas correspondências automáticas da plataforma de parcerias e matches imobiliários.
                </p>

                {adminMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs font-bold leading-normal">
                    {adminMessage}
                  </div>
                )}

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center gap-4 bg-slate-50 border p-3 rounded-xl">
                    <img
                      src={adminProfile.photoUrl || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80"}
                      alt="Avatar do Admin"
                      className="h-14 w-14 rounded-full object-cover border bg-slate-200 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-600 tracking-wider font-mono">Visualização Prévia</span>
                      <p className="text-sm font-extrabold text-gray-900 leading-snug">{adminProfile.name || "Administrador da Aplicação"}</p>
                      <p className="text-[11px] text-gray-500 font-medium">CRECI {adminProfile.creci || "Não preenchido"}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Nome Completo</label>
                    <input
                      type="text"
                      placeholder="Ex: Geraldo Mendes de Souza"
                      value={adminProfile.name}
                      onChange={(e) => setAdminProfile({ ...adminProfile, name: e.target.value })}
                      required
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">CRECI Registro</label>
                      <input
                        type="text"
                        placeholder="Ex: CRECI-PR 88291"
                        value={adminProfile.creci}
                        onChange={(e) => setAdminProfile({ ...adminProfile, creci: e.target.value })}
                        required
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        placeholder="Ex: (41) 99829-1234"
                        value={adminProfile.phone}
                        onChange={(e) => setAdminProfile({ ...adminProfile, phone: e.target.value })}
                        required
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Email Administrativo</label>
                    <input
                      type="email"
                      placeholder="Ex: admin@imob.com"
                      value={adminProfile.email}
                      onChange={(e) => setAdminProfile({ ...adminProfile, email: e.target.value })}
                      required
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Foto do Perfil</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Cole um link https:// com sua foto ou imagem"
                        value={adminProfile.photoUrl}
                        onChange={(e) => setAdminProfile({ ...adminProfile, photoUrl: e.target.value })}
                        className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs bg-slate-50 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => adminFileInputRef.current?.click()}
                        disabled={adminUploadingPhoto}
                        className="shrink-0 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3 py-2.5 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {adminUploadingPhoto
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Camera className="h-3.5 w-3.5" />
                        }
                        {adminUploadingPhoto ? "Enviando..." : "Upload"}
                      </button>
                      <input
                        ref={adminFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadAdminPhoto(file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 block">Faça upload de uma imagem ou cole uma URL pública.</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t mt-6">
                <button
                  type="submit"
                  disabled={adminSaving}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-3.5 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  {adminSaving ? "Alterando Credenciais..." : "Salvar Perfil de Administrador"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {activeSubTab === "properties" && (
        <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-150 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                <BookOpen className="h-5 w-5 text-purple-600" />
                Moderador de Fotos - Todos os Imóveis ({properties.length})
              </h3>
              <p className="text-xs text-gray-400 mt-1">Como administrador geral corporativo, você pode auditar, deletar ou subir novas imagens em qualquer captação imobiliária.</p>
            </div>
            <button
              onClick={fetchProperties}
              className="p-1.5 hover:bg-slate-50 rounded-lg text-gray-500 border border-gray-200 transition cursor-pointer"
              title="Recarregar captações"
            >
              <RefreshCw className={`h-4 w-4 ${propsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {propsLoading ? (
            <div className="py-12 text-center text-xs text-gray-400 space-y-2 animate-pulse">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600" />
              <p className="font-semibold">Buscando captações imobiliárias...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 border border-dashed rounded-xl">
              <p className="text-xs text-gray-400 font-semibold">Nenhum imóvel foi cadastrado na rede até o momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((p) => (
                <div key={p.id} className="border border-slate-150 rounded-xl bg-slate-50/50 p-4 space-y-3 shadow-sm hover:shadow transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="aspect-video relative rounded-lg bg-slate-150 border-0 overflow-hidden shrink-0">
                      {p.photos && p.photos.length > 0 ? (
                        <img src={p.photos[0]} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-300">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md font-mono">
                        {p.photos ? p.photos.length : 0} {p.photos && p.photos.length === 1 ? "foto" : "fotos"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="font-extrabold text-gray-900 text-xs truncate" title={p.title}>{p.title}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{p.neighborhood} | R$ {p.price.toLocaleString("pt-BR")}</p>
                      <p className="text-[9px] text-slate-400">Cadastrado por: <span className="font-bold text-slate-600">{p.createdBy || "Fictício"}</span></p>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectPropertyDetail(p)}
                    className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Gerenciar Fotos do Imóvel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === "locations" && (
        <LocationsManager />
      )}
    </div>
  );
}

function LocationsManager() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [newCityName, setNewCityName] = useState("");
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [editingNeighborhoods, setEditingNeighborhoods] = useState<string[]>([]);
  const [error, setError] = useState("");

  const fetchCities = async () => {
    try {
      const res = await fetch("/api/admin/cities");
      if (res.ok) setCities(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCities(); }, []);

  const handleAddCity = async () => {
    setError("");
    if (!newCityName.trim()) return;
    const id = "cidade-" + Date.now();
    try {
      const res = await fetch("/api/admin/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newCityName.trim(), neighborhoods: [] })
      });
      if (res.ok) {
        setNewCityName("");
        await fetchCities();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || "Erro ao adicionar cidade");
      }
    } catch (e: any) {
      setError(e.message || "Erro de rede");
    }
  };

  const handleDeleteCity = async (id: string) => {
    if (!confirm("Excluir esta cidade e todos os bairros?")) return;
    const res = await fetch(`/api/admin/cities/${id}`, { method: "DELETE" });
    if (res.ok) await fetchCities();
  };

  const handleAddNeighborhood = async (cityId: string) => {
    if (!newNeighborhood.trim()) return;
    const res = await fetch(`/api/admin/cities/${cityId}/neighborhoods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighborhood: newNeighborhood.trim() })
    });
    if (res.ok) {
      setNewNeighborhood("");
      await fetchCities();
    }
  };

  const handleRemoveNeighborhood = async (cityId: string, neighborhood: string) => {
    const res = await fetch(`/api/admin/cities/${cityId}/neighborhoods/${encodeURIComponent(neighborhood)}`, { method: "DELETE" });
    if (res.ok) await fetchCities();
  };

  const handleSaveCityName = async (city: City) => {
    const res = await fetch(`/api/admin/cities/${city.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: city.name })
    });
    if (res.ok) {
      setEditingCity(null);
      await fetchCities();
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;

  return (
    <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-gray-150 pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <MapPin className="h-5 w-5 text-purple-600" />
            Gerenciar Localidades ({cities.length} cidades)
          </h3>
          <p className="text-xs text-gray-400 mt-1">Cadastre cidades e bairros disponíveis na plataforma.</p>
        </div>
      </div>

      {/* Add new city */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nova cidade..."
          value={newCityName}
          onChange={(e) => setNewCityName(e.target.value)}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
        <button onClick={handleAddCity} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-xs flex items-center gap-1 cursor-pointer">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>}

      {/* Cities list */}
      <div className="space-y-4">
        {cities.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma cidade cadastrada.</p>}
        {cities.map((city) => (
          <div key={city.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              {editingCity?.id === city.id ? (
                <div className="flex gap-2 flex-1">
                  <input
                    type="text"
                    value={editingCity.name}
                    onChange={(e) => setEditingCity({ ...editingCity, name: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button onClick={() => handleSaveCityName(editingCity)} className="text-xs bg-emerald-600 text-white font-bold px-3 py-1 rounded-lg cursor-pointer hover:bg-emerald-700">Salvar</button>
                  <button onClick={() => setEditingCity(null)} className="text-xs bg-gray-200 text-gray-700 font-bold px-3 py-1 rounded-lg cursor-pointer hover:bg-gray-300">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-purple-500" />
                  <span className="font-bold text-gray-900">{city.name}</span>
                  <span className="text-[10px] text-gray-400">({city.neighborhoods.length} bairros)</span>
                </div>
              )}
              {editingCity?.id !== city.id && (
                <div className="flex gap-1">
                  <button onClick={() => setEditingCity({ ...city })} className="p-1.5 hover:bg-slate-100 rounded-lg text-gray-500 cursor-pointer" title="Editar nome">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeleteCity(city.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 cursor-pointer" title="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Neighborhoods */}
            <div className="flex flex-wrap gap-1.5">
              {city.neighborhoods.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                  {n}
                  <button onClick={() => handleRemoveNeighborhood(city.id, n)} className="text-slate-400 hover:text-red-600 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  placeholder="+ bairro"
                  value={editingNeighborhoods.includes(city.id) ? newNeighborhood : ""}
                  onFocus={() => { setEditingNeighborhoods([...editingNeighborhoods, city.id]); setNewNeighborhood(""); }}
                  onChange={(e) => setNewNeighborhood(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { handleAddNeighborhood(city.id); } }}
                  className="w-24 rounded-lg border border-dashed border-gray-300 px-2 py-0.5 text-[11px] focus:border-blue-500 focus:outline-none"
                />
                {editingNeighborhoods.includes(city.id) && (
                  <button onClick={() => handleAddNeighborhood(city.id)} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
