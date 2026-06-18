import { useState } from "react";
import { Sparkles, Loader2, Plus, X, Search, Lightbulb, CheckCircle2, Wand2 } from "lucide-react";
import { Demand, PropertyType, PurposeType, UrgencyType, City } from "../types";

interface DemandFormProps {
  onSuccess: (newDemand: Demand) => void;
  onCancel: () => void;
  cities?: City[];
  editDemand?: Demand | null;
}

export default function DemandForm({ onSuccess, onCancel, cities, editDemand }: DemandFormProps) {
  // Mode selection: Manual filling or full AI Extraction from text!
  const [useIa, setUseIa] = useState(false);
  const [iaRawText, setIaRawText] = useState("");
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [iaMatchedSuccessfully, setIaMatchedSuccessfully] = useState(false);

  // Manual & Extracted criteria fields
  const [type, setType] = useState<PropertyType>(editDemand?.type || "apartamento");
  const [purpose, setPurpose] = useState<PurposeType>(editDemand?.purpose || "venda");
  const [city, setCity] = useState(editDemand?.city || "Salvador");
  const [neighborhoods, setNeighborhoods] = useState<string[]>(editDemand?.neighborhoods || []);
  const [newNeighborhoodInput, setNewNeighborhoodInput] = useState("");
  const [maxPrice, setMaxPrice] = useState(editDemand?.maxPrice ? String(editDemand.maxPrice) : "");
  const [bedrooms, setBedrooms] = useState(editDemand?.bedrooms ? String(editDemand.bedrooms) : "3");
  const [parkingSpots, setParkingSpots] = useState(editDemand?.parkingSpots ? String(editDemand.parkingSpots) : "2");
  const [minArea, setMinArea] = useState(editDemand?.minArea ? String(editDemand.minArea) : "");
  const [urgency, setUrgency] = useState<UrgencyType>(editDemand?.urgency || "alta");
  const [paymentMethod, setPaymentMethod] = useState(editDemand?.paymentMethod || "Financiamento ou à vista");
  const [notes, setNotes] = useState(editDemand?.notes || "");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(editDemand?.coverPhoto || "");

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
      const url = editDemand ? `/api/demands/${editDemand.id}` : "/api/demands";
      const method = editDemand ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
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
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text">{editDemand ? "Editar Procura" : "Cadastrar Procura / Compra"}</h2>
          <p className="text-sm text-gray-500 dark:text-dark-muted">Insira os desejos do seu cliente. Nossa IA conectará imediatamente com imóveis compatíveis na rede.</p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-2 text-sm font-semibold text-gray-700 dark:text-dark-text shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Mode selection cards */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => { setUseIa(false); setIaMatchedSuccessfully(false); }}
          className={`p-4 rounded-xl border text-left transition-all ${
            !useIa 
              ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-2 ring-blue-500/10" 
              : "bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          <h4 className="font-semibold text-gray-900 dark:text-dark-text text-sm">Filtros Manuais</h4>
          <p className="text-xs text-gray-400 dark:text-dark-muted mt-1">Preencha cada campo de critérios manualmente de maneira tradicional.</p>
        </button>

        <button
          type="button"
          onClick={() => setUseIa(true)}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
            useIa 
              ? "bg-purple-50/50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 ring-2 ring-purple-500/10" 
              : "bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          <div className="absolute top-0 right-0 p-1 bg-purple-600 text-white text-[9px] font-bold uppercase rounded-bl-lg">IA Ativa</div>
          <h4 className="font-semibold text-gray-900 dark:text-dark-text text-sm">Texto Livre com IA (Interpretação)</h4>
          <p className="text-xs text-gray-400 dark:text-dark-muted mt-1">Digite um parágrafo livre e nossa IA extrairá quartos, bairros, valores, etc.</p>
        </button>
      </div>

      {/* Text Area for AI Interpretation */}
      {useIa && (
        <div className="bg-gradient-to-r from-purple-50/40 to-indigo-50/40 dark:from-gray-800 dark:to-gray-900 rounded-2xl border border-purple-100 dark:border-dark-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white">
              <Sparkles className="h-4 w-4 text-white fill-purple-100" />
            </span>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-dark-text text-sm">Interpretador de Procuras ConectaCorretor IA</h4>
              <p className="text-[10px] text-gray-400 dark:text-dark-muted font-medium">Escreva como o comprador descreveu e processaremos</p>
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
              className="w-full rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:text-dark-text"
            />

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-dark-muted font-medium">
                <Lightbulb className="h-4 w-4 text-purple-600 shrink-0" />
                Dica: Economize até 3 minutos de cadastro manual!
              </div>
              <button
                type="button"
                onClick={handleAIInterpretText}
                disabled={isInterpreting || !iaRawText.trim()}
                className="rounded-xl bg-purple-600 dark:bg-purple-700 px-6 py-2.5 text-xs font-bold text-white border-0 hover:bg-purple-700 dark:hover:bg-purple-800 transition shadow-md dark:shadow-none disabled:bg-purple-300 dark:disabled:bg-gray-700 flex items-center gap-1.5 cursor-pointer"
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
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3.5 flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Campos Extraídos e Preenchidos!</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">As informações foram mapeadas abaixo. Confirme as informações antes de finalizar.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main filter inputs form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-dark-card border border-[#e2e8f0] dark:border-dark-border rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text border-b border-gray-100 dark:border-dark-border pb-3">Especificações Desejadas</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Tipo do Imóvel Buscado</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PropertyType)}
              className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
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
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Finalidade</label>
            <div className="flex gap-2">
              {(["venda", "locação"] as PurposeType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold capitalize transition-all ${
                    purpose === p
                      ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-600 shadow-sm"
                      : "border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {p === "venda" ? "Compra" : "Aluguel"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Cidade de Interesse</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
            >
              {(cities && cities.length > 0 ? cities : [{ id: "1", name: "Salvador", neighborhoods: [] }, { id: "2", name: "São Paulo", neighborhoods: [] }]).map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Districts / neighborhoods tags inputs */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Bairros de Interesse (Vários)</label>
            <div className="flex flex-wrap gap-1 mb-2.5 p-2 rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-dark-border min-h-[42px]">
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
              {neighborhoods.length === 0 && <span className="text-xs text-gray-400 dark:text-dark-muted italic">Aceita qualquer bairro em {city}</span>}
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Ex Pituba, Pinheiros, Itaim"
                value={newNeighborhoodInput}
                onChange={(e) => setNewNeighborhoodInput(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 dark:border-dark-border px-3 py-2 text-xs dark:bg-gray-800 dark:text-dark-text"
              />
              <button
                type="button"
                onClick={() => handleAddNeighborhood(newNeighborhoodInput)}
                className="rounded-xl bg-slate-800 dark:bg-gray-700 px-4 text-xs font-semibold text-white hover:bg-black dark:hover:bg-gray-600"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Valor Máximo Tolerado *</label>
            <input
              type="number"
              required
              placeholder="Orçamento teto do cliente"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Metragem Útil Mínima (m²)</label>
            <input
              type="number"
              placeholder="Mínimo m² tolerado"
              value={minArea}
              onChange={(e) => setMinArea(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5 font-sans">Quartos Mínimos</label>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
            >
              <option value="0">Qualquer quantidade</option>
              <option value="1">1 quarto+</option>
              <option value="2">2 quartos+</option>
              <option value="3">3 quartos+</option>
              <option value="4">4 suítes+</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Grau de Urgência</label>
            <div className="flex gap-2">
              {(["baixa", "média", "alta"] as UrgencyType[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${
                    urgency === u
                      ? u === "alta" ? "bg-red-600 dark:bg-red-700 text-white border-red-600" : "bg-blue-600 dark:bg-blue-700 text-white border-blue-600"
                      : "border-gray-300 dark:border-dark-border bg-white dark:bg-dark-card text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text border-b border-gray-100 dark:border-dark-border pb-3 pt-2">Forma de Pagamento & Condições</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Formas de Pagamento Aceitas *</label>
            <input
              type="text"
              required
              placeholder="Ex: Financiamento Caixa, Consórcio, À vista, aceita permuta"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wider mb-1.5">Observações Livres</label>
            <input
              type="text"
              placeholder="Ex: Cliente tem cachorro grande, prefere andar alto"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
            />
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text border-b border-gray-100 dark:border-dark-border pb-3 pt-2">Foto de Capa</h3>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="URL da imagem de capa (opcional)"
            value={coverPhotoUrl}
            onChange={(e) => setCoverPhotoUrl(e.target.value)}
            className="w-full rounded-xl border border-gray-300 dark:border-dark-border px-4 py-3 text-sm shadow-sm dark:bg-gray-800 dark:text-dark-text"
          />
          {coverPhotoUrl && (
            <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-gray-800 border dark:border-dark-border">
              <img src={coverPhotoUrl} alt="Preview" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            </div>
          )}
          <p className="text-[11px] text-gray-400 dark:text-dark-muted">Cole uma URL de imagem para identificar visualmente esta procura</p>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-dark-border justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-300 dark:border-dark-border px-6 py-3 font-semibold text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={savingLoading}
            className="rounded-xl bg-blue-600 dark:bg-blue-700 px-8 py-3 font-semibold text-white text-sm shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 dark:hover:bg-blue-800 flex items-center gap-2 cursor-pointer disabled:bg-blue-300"
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
