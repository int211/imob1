import { useState, useEffect } from "react";
import { Sparkles, Loader2, Plus, X, ListPlus, Wand2, Lightbulb, Image as ImageIcon } from "lucide-react";
import { Property, PropertyType, PurposeType, City } from "../types";
import MarkdownText from "./MarkdownText";

interface PropertyFormProps {
  onSuccess: (newProperty: Property) => void;
  onCancel: () => void;
  cities?: City[];
}

export default function PropertyForm({ onSuccess, onCancel, cities }: PropertyFormProps) {
  // Values
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PropertyType>("apartamento");
  const [purpose, setPurpose] = useState<PurposeType>("venda");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("Salvador");
  const [neighborhood, setNeighborhood] = useState("");
  const [description, setDescription] = useState("");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("2");
  const [parkingSpots, setParkingSpots] = useState("2");
  const [area, setArea] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [commission, setCommission] = useState("6% de comissão (partilha 50/50)");
  const [acceptsPartnership, setAcceptsPartnership] = useState(true);
  const [condoFee, setCondoFee] = useState("");
  const [iptu, setIptu] = useState("");
  const [virtualTour, setVirtualTour] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  // Photo states
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [maxPhotosLimit, setMaxPhotosLimit] = useState(5);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    for (const file of files) {
      if (photos.length >= maxPhotosLimit) {
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
          setPhotos(prev => [...prev, data.url]);
        } else {
          const errData = await res.json();
          alert(`Falha ao subir imagem: ${errData.error || "Erro desconhecido"}`);
        }
      } catch (err: any) {
        alert(`Erro no upload: ${err.message}`);
      }
    }
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      uploadFiles(filesArray);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      uploadFiles(filesArray);
    }
  };

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.maxPhotosPerProperty === "number") {
          setMaxPhotosLimit(data.maxPhotosPerProperty);
        }
      })
      .catch(err => console.error("Error fetching max photo limits:", err));
  }, []);

  // Features list
  const [features, setFeatures] = useState<string[]>(["piscina", "varanda gourmet"]);
  const [newFeatureInput, setNewFeatureInput] = useState("");

  const popularFeatures = [
    "piscina",
    "varanda gourmet",
    "mobiliado",
    "frente mar",
    "academia",
    "churrasqueira",
    "segurança 24h",
    "ar condicionado",
    "portaria automatizada",
    "quadra de esportes"
  ];

  // AI Optimization suggestion states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedFeatures: string[];
    qualityScore: number;
    marketingTips: string[];
    estimatedConversionProgress: string;
  } | null>(null);

  const [savingLoading, setSavingLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Add customized feature
  const handleAddFeature = (f: string) => {
    const fn = f.trim().toLowerCase();
    if (fn && !features.includes(fn)) {
      setFeatures([...features, fn]);
    }
    setNewFeatureInput("");
  };

  const handleRemoveFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  // Call IA to optimize listing! (PRD Section 7 & 6.4)
  const handleAIOptimize = async () => {
    if (!title || !description || !neighborhood) {
      setErrorMessage("Por favor, preencha o Título, Bairro e Descrição para podermos otimizar com a IA.");
      return;
    }

    setIsOptimizing(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/properties/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, type, price, city, neighborhood, description, features
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAiSuggestions(data);
      } else {
        setErrorMessage(data.error || "Ocorreu um erro ao otimizar com IA.");
      }
    } catch (err) {
      setErrorMessage("Erro ao conectar ao servidor de inteligência artificial.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // User accepts the IA generated title and description
  const handleApplyAISuggestions = () => {
    if (aiSuggestions) {
      setTitle(aiSuggestions.suggestedTitle);
      setDescription(aiSuggestions.suggestedDescription);
      if (aiSuggestions.suggestedFeatures && aiSuggestions.suggestedFeatures.length > 0) {
        setFeatures(aiSuggestions.suggestedFeatures);
      }
      setAiSuggestions(null);
    }
  };

  // Write and save listing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !neighborhood || !description || !commission) {
      setErrorMessage("Preencha todos os campos obrigatórios (Marcados com *)");
      return;
    }

    setSavingLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("conectacorretor_user_id") || "admin-id"
        },
        body: JSON.stringify({
          title,
          type,
          purpose,
          price: Number(price),
          city,
          neighborhood,
          description,
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          parkingSpots: Number(parkingSpots),
          area: Number(area || 80),
          commission,
          acceptsPartnership,
          features,
          condoFee: condoFee ? Number(condoFee) : undefined,
          iptu: iptu ? Number(iptu) : undefined,
          virtualTour,
          videoUrl,
          photos,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined
        })
      });

      const data = await response.json();
      if (response.ok) {
        onSuccess(data);
      } else {
        setErrorMessage(data.error || "Erro ao publicar anúncio de imóvel.");
      }
    } catch (err) {
      setErrorMessage("Erro de rede ao salvar o imóvel.");
    } finally {
      setSavingLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Cadastrar Novo Imóvel</h2>
          <p className="text-sm text-gray-500">Divulgue suas captações nas cidades de atuação primárias e permita matches.</p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Main Grid: Form on left, IA Suggestions on right if triggered */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">Informações Gerais</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Título do Anúncio *</label>
              <input
                type="text"
                required
                placeholder="Ex Luzes do Bosque: Apartamento reformado 3 qts com varanda gourmet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Tipo do Imóvel *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PropertyType)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="apartamento">Apartamento</option>
                <option value="casa">Casa</option>
                <option value="terreno">Terreno</option>
                <option value="cobertura">Cobertura</option>
                <option value="comercial">Comercial</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Finalidade *</label>
              <div className="flex gap-2">
                {(["venda", "locação"] as PurposeType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurpose(p)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold capitalize transition-all ${
                      purpose === p
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Cidade *</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {(cities && cities.length > 0 ? cities : [{ id: "1", name: "Salvador", neighborhoods: [] }, { id: "2", name: "São Paulo", neighborhoods: [] }]).map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Bairro *</label>
              <input
                type="text"
                required
                placeholder="Ex: Pituba, Itaim Bibi"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Valor (R$) *</label>
              <input
                type="number"
                required
                placeholder="Valor de venda ou aluguel mensal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Área Útil (m²)</label>
              <input
                type="number"
                placeholder="Metragem quadrada útil"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 pt-2">Geolocalização</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Latitude</label>
              <input
                type="text"
                placeholder="Ex: -12.9714"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Longitude</label>
              <input
                type="text"
                placeholder="Ex: -38.5014"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 pt-2">Composição & Características</h3>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Quartos</label>
              <input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Banheiros</label>
              <input
                type="number"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Vagas Garagem</label>
              <input
                type="number"
                value={parkingSpots}
                onChange={(e) => setParkingSpots(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Diferenciais (Características)</label>
            <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-100 min-h-[46px]">
              {features.map((f, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100"
                >
                  {f}
                  <button type="button" onClick={() => handleRemoveFeature(idx)} className="text-blue-500 hover:text-blue-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {features.length === 0 && <span className="text-xs text-gray-400 italic">Nenhum diferencial adicionado</span>}
            </div>

            {/* Quick selectors & custom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Novo dif., ex: closet, portaria"
                  value={newFeatureInput}
                  onChange={(e) => setNewFeatureInput(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleAddFeature(newFeatureInput)}
                  className="rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-black"
                >
                  Add
                </button>
              </div>

              {/* Selector bubbles */}
              <div className="flex flex-wrap gap-1">
                {popularFeatures.filter(f => !features.includes(f)).slice(0, 5).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleAddFeature(f)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 border border-gray-300 hover:bg-slate-50"
                  >
                    + {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Condomínio (R$)</label>
              <input
                type="number"
                placeholder="Se houver"
                value={condoFee}
                onChange={(e) => setCondoFee(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">IPTU Anual (R$)</label>
              <input
                type="number"
                placeholder="Se houver"
                value={iptu}
                onChange={(e) => setIptu(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 pt-6">Fotos do Imóvel</h3>

          <div className="space-y-4">
            {/* Drag & Drop zone for MinIO S3 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                isDragging
                  ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                  : "border-gray-300 bg-slate-50 hover:bg-slate-100/50"
              } cursor-pointer relative`}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={photos.length >= maxPhotosLimit || isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="space-y-2 pointer-events-none">
                <div className="flex justify-center">
                  <div className={`p-3 rounded-full bg-blue-50 text-blue-600 ${isUploading ? "animate-pulse" : ""}`}>
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    ) : (
                      <ImageIcon className="h-6 w-6" />
                    )}
                  </div>
                </div>
                <div className="text-xs">
                  <span className="font-extrabold text-blue-600 hover:text-blue-700">Clique para enviar</span>
                  <span className="text-gray-500"> ou arraste e solte fotos do computador</span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">PNG, JPG, WEBP enviados diretamente para o servidor S3 (máx. {maxPhotosLimit} fotos)</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Adicionar Link de Foto Manualmente</label>
                <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 font-mono">
                  {photos.length} / {maxPhotosLimit} {maxPhotosLimit === 1 ? "foto" : "fotos"}
                </span>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={photos.length >= maxPhotosLimit ? "Limite máximo de uploads atingido!" : "Insira um link https:// contendo foto em formato jpeg, png..."}
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  disabled={photos.length >= maxPhotosLimit}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={photos.length >= maxPhotosLimit || !newPhotoUrl.trim()}
                  onClick={() => {
                    if (newPhotoUrl.trim()) {
                      setPhotos([...photos, newPhotoUrl.trim()]);
                      setNewPhotoUrl("");
                    }
                  }}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold px-5 text-sm cursor-pointer transition-all shrink-0"
                >
                  Adicionar
                </button>
              </div>
              <p className="text-[10.5px] text-gray-400">Insira imagens hospedadas para que outros corretores vejam. Limite de fotos gerenciado pelo Administrador da plataforma.</p>
            </div>

            {/* Quick Template Photos Helper */}
            {photos.length < maxPhotosLimit && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Fotos Rápidas de Alta Qualidade (Demonstração):</span>
                <div className="flex flex-wrap gap-2 py-0.5">
                  {[
                    { label: "Fachada Moderna", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop" },
                    { label: "Sala de Estar", url: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=600&auto=format&fit=crop" },
                    { label: "Cozinha Gourmet", url: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&auto=format&fit=crop" },
                    { label: "Suíte Master", url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&auto=format&fit=crop" },
                    { label: "Varanda/Vista", url: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&auto=format&fit=crop" }
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      disabled={photos.length >= maxPhotosLimit || photos.includes(tpl.url)}
                      onClick={() => setPhotos([...photos, tpl.url])}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ImageIcon className="h-3 w-3" />
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Added Thumbnail gallery preview slider */}
            {photos.length > 0 && (
              <div className="bg-slate-50 border rounded-2xl p-4 space-y-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Galeria de Fotos do Anúncio ({photos.length} fotos)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {photos.map((item, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-slate-200 border">
                      <img
                        src={item}
                        alt={`Photo preview ${idx}`}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-red-600/95 text-white active:bg-red-700 h-6 w-6 rounded-full flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-110 shadow-sm transition-all cursor-pointer"
                        title="Remover Foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 pt-6">Descrição & Parceria</h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Descrição Detalhada *</label>
                <button
                  type="button"
                  onClick={handleAIOptimize}
                  disabled={isOptimizing}
                  className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg px-2.5 py-1.5 border border-purple-200 transition-all cursor-pointer"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-purple-700" />
                      Interpretando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 text-purple-700 fill-purple-100" />
                      Otimizar com IA
                    </>
                  )}
                </button>
              </div>
              <textarea
                required
                rows={5}
                placeholder="Descreva minuciosamente o imóvel, proximidade de pontos de interesse, estado de conservação, sol nascente/poente..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100/50 space-y-3">
              <div>
                <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">Acordo de Comissão & Parceria *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 6% de comissão (partilha 50/50 garantida)"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm shadow-sm placeholder-blue-300 focus:border-blue-500"
                />
              </div>

              <label className="flex items-center gap-2.5 font-medium text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptsPartnership}
                  onChange={(e) => setAcceptsPartnership(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Aceito realizar parceria com corretores verificados neste anúncio</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 bg-white text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingLoading}
              className="rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 flex items-center gap-2 cursor-pointer disabled:bg-blue-300"
            >
              {savingLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="h-4.5 w-4.5 text-white" />
                  Publicar Anúncio
                </>
              )}
            </button>
          </div>
        </form>

        {/* IA Suggestions sidebar widget (Section 7: Otimização de Anúncios) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-purple-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </span>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Otimizador Imobiliário IA</h4>
                <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wider">Powered by OpenRouter IA</p>
              </div>
            </div>

            {!aiSuggestions && !isOptimizing && (
              <div className="text-center py-6 text-gray-500 space-y-3">
                <p className="text-xs leading-relaxed">
                  Insira o título, bairro e descrição ao lado e clique em <b>"Otimizar com IA"</b> para receber sugestões de texto persuasivo, novos diferenciais e auditoria de qualidade.
                </p>
                <div className="inline-flex h-9 items-center justify-center rounded-xl bg-white border border-[#e2e8f0] px-3.5 text-xs font-semibold text-gray-700 shadow-sm">
                  Aumente seus matches em até 40%
                </div>
              </div>
            )}

            {isOptimizing && (
              <div className="text-center py-10 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-700">IA está analisando...</p>
                  <p className="text-[10px] text-gray-400">Consultando termos de mercado imobiliário em {city}.</p>
                </div>
              </div>
            )}

            {aiSuggestions && !isOptimizing && (
              <div className="space-y-4 text-xs">
                {/* Score badge */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-purple-100 shadow-sm">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-gray-800">Nota de Completude</span>
                    <p className="text-[10px] text-gray-400">Score de qualidade do seu anúncio</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 border-2 border-purple-200">
                    <span className="text-sm font-bold text-purple-800">{aiSuggestions.qualityScore}%</span>
                  </div>
                </div>

                {/* Suggestions display preview */}
                <div className="space-y-2.5">
                  <div className="space-y-1.5 p-3 rounded-xl bg-white border border-purple-100">
                    <span className="font-bold text-gray-700 text-[10px] uppercase tracking-wider">Título Sugerido</span>
                    <p className="text-xs font-semibold text-gray-900 leading-snug">{aiSuggestions.suggestedTitle}</p>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-white border border-purple-100 max-h-56 overflow-y-auto">
                    <span className="font-bold text-gray-700 text-[10px] uppercase tracking-wider">Descrição Sugerida</span>
                    <MarkdownText text={aiSuggestions.suggestedDescription} className="text-xs text-gray-600" />
                  </div>

                  {aiSuggestions.marketingTips && aiSuggestions.marketingTips.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-white border border-purple-100 space-y-2">
                      <span className="inline-flex items-center gap-1 font-bold text-purple-900 uppercase tracking-widest text-[9px]">
                        <Lightbulb className="h-3.5 w-3.5 text-purple-600" />
                        Dicas de Apresentação
                      </span>
                      <ul className="space-y-1.5 list-disc list-inside text-gray-600 text-[11px] leading-relaxed">
                        {aiSuggestions.marketingTips.map((tip, i) => (
                          <li key={i}><MarkdownText text={tip} /></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-purple-100/30 rounded-xl p-3 border border-purple-200/40 text-[11px] text-purple-800 font-medium">
                    {aiSuggestions.estimatedConversionProgress}
                  </div>
                </div>

                {/* Apply Suggestions action */}
                <button
                  type="button"
                  onClick={handleApplyAISuggestions}
                  className="w-full rounded-xl bg-purple-600 py-3 font-semibold text-white border-0 shadow-md hover:bg-purple-700 transition-all cursor-pointer text-center text-xs"
                >
                  Substituir pelos Textos da IA
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
