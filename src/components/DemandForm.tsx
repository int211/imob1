import { useState } from "react";
import { Sparkles, Loader2, Plus, X, Search, Lightbulb, CheckCircle2, Wand2 } from "lucide-react";
import { Demand, PropertyType, PurposeType, UrgencyType, City } from "../types";

interface DemandFormProps {
  onSuccess: (newDemand: Demand) => void;
  onCancel: () => void;
  cities?: City[];
}

export default function DemandForm({ onSuccess, onCancel, cities }: DemandFormProps) {
  // Mode selection: Manual filling or full AI Extraction from text!
  const [useIa, setUseIa] = useState(false);
  const [iaRawText, setIaRawText] = useState("");
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [iaMatchedSuccessfully, setIaMatchedSuccessfully] = useState(false);

  // Manual & Extracted criteria fields
  const [type, setType] = useState<PropertyType>("apartamento");
  const [purpose, setPurpose] = useState<PurposeType>("venda");
  const [city, setCity] = useState("Salvador");
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [newNeighborhoodInput, setNewNeighborhoodInput] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("3");
  const [parkingSpots, setParkingSpots] = useState("2");
  const [minArea, setMinArea] = useState("");
  const [urgency, setUrgency] = useState<UrgencyType>("alta");
  const [paymentMethod, setPaymentMethod] = useState("Financiamento ou à vista");
  const [notes, setNotes] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");

  const [savingLoading, setSavingLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Call IA to interpret free text! (PRD Section 6.5 & 6.6)
  const handleAIInterpretText = async () => {
    if (!iaRawText.trim()) {
      setErrorMessage("Por favor, digite a descrição do pedido do seu cliente no campo de texto livre.");
      return;
    }

    setIsInterpreting(true);
    setErrorMessage("");
    setIaMatchedSuccessfully(false);

    try {
      const response = await fetch("/api/demands", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("conectacorretor_user_id") || "admin-id" 
        },
        body: JSON.stringify({
          city,
          purpose,
          useIa: true,
          iaRawText,
          // Empty attributes for the AI to fill
          type: "apartamento" 
        })
      });

      const data = await response.json();
      if (response.ok) {
        // Hydrate manual inputs with IA interpreted values!
        const criteria = data.iaStructuredCriteria || {};
        if (criteria.type) setType(criteria.type as PropertyType);
        if (criteria.bairros && criteria.bairros.length > 0) setNeighborhoods(criteria.bairros);
        if (criteria.bedrooms) setBedrooms(String(criteria.bedrooms));
        if (criteria.parkingSpots) setParkingSpots(String(criteria.parkingSpots));
        if (criteria.maxPrice) setMaxPrice(String(criteria.maxPrice));
        if (criteria.city) setCity(criteria.city);
        
        // Populate note about what the client sought
        setNotes(`Interpretação IA de: "${iaRawText}"`);
        setIaMatchedSuccessfully(true);
      } else {
        setErrorMessage(data.error || "Ocorreu um erro ao interpretar a procura com IA.");
      }
    } catch (err) {
      setErrorMessage("Erro ao conectar à inteligência artificial ConectaCorretor.");
    } finally {
      setIsInterpreting(false);
    }
  };

  const handleAddNeighborhood = (n: string) => {
    const val = n.trim();
    if (val && !neighborhoods.includes(val)) {
      setNeighborhoods([...neighborhoods, val]);
    }
    setNewNeighborhoodInput("");
  };

  const handleRemoveNeighborhood = (idx: number) => {
    setNeighborhoods(neighborhoods.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maxPrice || !paymentMethod) {
      setErrorMessage("Por favor, preencha o valor máximo e a forma de pagamento do cliente.");
      return;
    }

    setSavingLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/demands", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("conectacorretor_user_id") || "admin-id" 
        },
        body: JSON.stringify({
          type,
          purpose,
          city,
          neighborhoods,
          maxPrice: Number(maxPrice),
          bedrooms: Number(bedrooms),
          parkingSpots: Number(parkingSpots),
          minArea: Number(minArea || 60),
          urgency,
          paymentMethod,
          notes,
          iaRawText,
          useIa: useIa && !!iaRawText,
          coverPhoto: coverPhotoUrl || undefined
        })
      });

      const data = await response.json();
      if (response.ok) {
        onSuccess(data);
      } else {
        setErrorMessage(data.error || "Erro ao salvar procura imobiliária.");
      }
    } catch (err) {
      setErrorMessage("Erro de rede ao salvar a procura do comprador.");
    } finally {
      setSavingLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Cadastrar Procura / Compra</h2>
          <p className="text-sm text-gray-500">Insira os desejos do seu cliente. Nossa IA conectará imediatamente com imóveis compatíveis na rede.</p>
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

      {/* Mode selection cards */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => { setUseIa(false); setIaMatchedSuccessfully(false); }}
          className={`p-4 rounded-xl border text-left transition-all ${
            !useIa 
              ? "bg-blue-50/50 border-blue-200 ring-2 ring-blue-500/10" 
              : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <h4 className="font-semibold text-gray-900 text-sm">Filtros Manuais</h4>
          <p className="text-xs text-gray-400 mt-1">Preencha cada campo de critérios manualmente de maneira tradicional.</p>
        </button>

        <button
          type="button"
          onClick={() => setUseIa(true)}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
            useIa 
              ? "bg-purple-50/50 border-purple-200 ring-2 ring-purple-500/10" 
              : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <div className="absolute top-0 right-0 p-1 bg-purple-600 text-white text-[9px] font-bold uppercase rounded-bl-lg">IA Ativa</div>
          <h4 className="font-semibold text-gray-900 text-sm">Texto Livre com IA (Interpretação)</h4>
          <p className="text-xs text-gray-400 mt-1">Digite um parágrafo livre e nossa IA extrairá quartos, bairros, valores, etc.</p>
        </button>
      </div>

      {/* Text Area for AI Interpretation */}
      {useIa && (
        <div className="bg-gradient-to-r from-purple-50/40 to-indigo-50/40 rounded-2xl border border-purple-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white">
              <Sparkles className="h-4 w-4 text-white fill-purple-100" />
            </span>
            <div>
              <h4 className="font-bold text-gray-900 text-sm">Interpretador de Procuras ConectaCorretor IA</h4>
              <p className="text-[10px] text-gray-400 font-medium">Escreva como o comprador descreveu e processaremos</p>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              rows={3}
              value={iaRawText}
              onChange={(e) => {
                setIaRawText(e.target.value);
                setIaMatchedSuccessfully(false);
              }}
              placeholder="Exemplo para colar do WhatsApp: 'Cliente busca apartamento de 3 dormitórios com 2 vagas até 700 mil na Pituba ou Caminho das Árvores com varanda gourmet.'"
              className="w-full rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                <Lightbulb className="h-4 w-4 text-purple-600 shrink-0" />
                Dica: Economize até 3 minutos de cadastro manual!
              </div>
              <button
                type="button"
                onClick={handleAIInterpretText}
                disabled={isInterpreting || !iaRawText.trim()}
                className="rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white border-0 hover:bg-purple-700 transition shadow-md disabled:bg-purple-300 flex items-center gap-1.5 cursor-pointer"
              >
                {isInterpreting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    IA está convertendo...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    Extrair Critérios Técnicos
                  </>
                )}
              </button>
            </div>
          </div>

          {iaMatchedSuccessfully && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5 flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Campos Extraídos e Preenchidos!</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">As informações foram mapeadas abaixo. Confirme as informações antes de finalizar.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main filter inputs form */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">Especificações Desejadas</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Tipo do Imóvel Buscado</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PropertyType)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
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
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Finalidade</label>
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
                  {p === "venda" ? "Compra" : "Aluguel"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Cidade de Interesse</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
            >
              {(cities && cities.length > 0 ? cities : [{ id: "1", name: "Salvador", neighborhoods: [] }, { id: "2", name: "São Paulo", neighborhoods: [] }]).map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Districts / neighborhoods tags inputs */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Bairros de Interesse (Vários)</label>
            <div className="flex flex-wrap gap-1 mb-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 min-h-[42px]">
              {neighborhoods.map((n, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100"
                >
                  {n}
                  <button type="button" onClick={() => handleRemoveNeighborhood(idx)} className="text-blue-500 hover:text-blue-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {neighborhoods.length === 0 && <span className="text-xs text-gray-400 italic">Aceita qualquer bairro em {city}</span>}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Ex Pituba, Pinheiros, Itaim"
                value={newNeighborhoodInput}
                onChange={(e) => setNewNeighborhoodInput(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => handleAddNeighborhood(newNeighborhoodInput)}
                className="rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-black"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Valor Máximo Tolerado *</label>
            <input
              type="number"
              required
              placeholder="Orçamento teto do cliente"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Metragem Útil Mínima (m²)</label>
            <input
              type="number"
              placeholder="Mínimo m² tolerado"
              value={minArea}
              onChange={(e) => setMinArea(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 font-sans">Quartos Mínimos</label>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
            >
              <option value="0">Qualquer quantidade</option>
              <option value="1">1 quarto+</option>
              <option value="2">2 quartos+</option>
              <option value="3">3 quartos+</option>
              <option value="4">4 suítes+</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Grau de Urgência</label>
            <div className="flex gap-2">
              {(["baixa", "média", "alta"] as UrgencyType[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${
                    urgency === u
                      ? u === "alta" ? "bg-red-600 text-white border-red-600" : "bg-blue-600 text-white border-blue-600"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 pt-2">Forma de Pagamento & Condições</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Formas de Pagamento Aceitas *</label>
            <input
              type="text"
              required
              placeholder="Ex: Financiamento Caixa, Consórcio, À vista, aceita permuta"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Observações Livres</label>
            <input
              type="text"
              placeholder="Ex: Cliente tem cachorro grande, prefere andar alto"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
            />
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 pt-2">Foto de Capa</h3>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="URL da imagem de capa (opcional)"
            value={coverPhotoUrl}
            onChange={(e) => setCoverPhotoUrl(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm"
          />
          {coverPhotoUrl && (
            <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-100 border">
              <img src={coverPhotoUrl} alt="Preview" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            </div>
          )}
          <p className="text-[11px] text-gray-400">Cole uma URL de imagem para identificar visualmente esta procura</p>
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
                Publicar Pedido
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
