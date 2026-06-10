import { useState } from "react";
import { Sparkles, Loader2, MessageSquare, ArrowRight, CheckCircle, Clock, AlertCircle, RefreshCw, Star, Info, ShieldCheck, X } from "lucide-react";
import { Match, MatchStatus } from "../types";
import MarkdownText from "./MarkdownText";

interface MatchesListProps {
  matches: Match[];
  onRefresh: () => void;
  onStatusChange: (matchId: string, newStatus: MatchStatus, notes: string) => void;
}

export default function MatchesList({ matches, onRefresh, onStatusChange }: MatchesListProps) {
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // IA advice state managers
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [matchInsights, setMatchInsights] = useState<{
    explanation: string;
    advice: string;
    scoreExplanation: string;
  } | null>(null);

  // Status transition states
  const [newStatus, setNewStatus] = useState<MatchStatus>("Novo");
  const [transitionNotes, setTransitionNotes] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  // Fetch the IA Match Insight (PRD Section 6.7 and 7)
  const handleFetchInsights = async (matchId: string) => {
    setLoadingInsights(true);
    setMatchInsights(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/insights`, {
        method: "GET",
        headers: {
          "x-user-id": localStorage.getItem("conectacorretor_user_id") || "admin-id"
        }
      });
      const data = await response.json();
      if (response.ok) {
        setMatchInsights(data);
      } else {
        alert(data.error || "Houve um erro ao renderizar parecer da AI.");
      }
    } catch (err) {
      alert("Erro ao contatar servidor de inteligência imobiliária.");
    } finally {
      setLoadingInsights(false);
    }
  };

  // Select a match to open modal
  const handleOpenDetails = (match: any) => {
    setSelectedMatch(match);
    setNewStatus(match.status);
    setTransitionNotes("");
    setMatchInsights(null);
    handleFetchInsights(match.id);
  };

  // Shifting status sequence
  const handleSaveStatus = async () => {
    if (!selectedMatch) return;
    setStatusLoading(true);
    try {
      await onStatusChange(selectedMatch.id, newStatus, transitionNotes);
      // Update local state
      setSelectedMatch({
        ...selectedMatch,
        status: newStatus,
        history: [
          {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: "Você",
            notes: transitionNotes
          },
          ...selectedMatch.history
        ]
      });
    } catch (err) {
      alert("Houve um erro ao atualizar status do Match.");
    } finally {
      setStatusLoading(false);
    }
  };

  // WhatsApp chat simulation (PRD Section 6.10: Integration with WhatsApp)
  const handleStartWhatsAppContact = (matchObj: any) => {
    const isOwnerOfProperty = matchObj.propertyCreatedBy === (localStorage.getItem("conectacorretor_user_id") || "admin-id");
    const otherBroker = isOwnerOfProperty ? matchObj.brokerDemand : matchObj.brokerProperty;
    
    if (!otherBroker) {
      alert("Dados do contato profissional parceiro ausentes.");
      return;
    }

    const cleanPhone = otherBroker.whatsapp ? otherBroker.whatsapp.replace(/\D/g, "") : otherBroker.phone.replace(/\D/g, "");
    
    // Custom prefilled introduction text
    const textMessage = `Olá ${otherBroker.name}! Vi seu perfil na plataforma ConectaCorretor. Temos um Match inteligente de ${matchObj.score}% entre meu anúncio de imóvel '${matchObj.propertyTitle}' e sua procura cadastrada no local. Gostaria de alinharmos a parceria imobiliária/visita?`;
    
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textMessage)}`;
    window.open(whatsappUrl, "_blank");
  };

  // Status style helper
  const getStatusBadgeClass = (status: MatchStatus) => {
    switch (status) {
      case "Novo": return "bg-[#e8e8ed] text-[#1d1d1f] border-transparent font-semibold";
      case "Visualizado": return "bg-[#0071e3]/10 text-[#0071e3] border-transparent font-semibold";
      case "Em contato": return "bg-[#ff9500]/10 text-[#ff9500] border-transparent font-semibold";
      case "Em negociação": return "bg-[#ff453a]/10 text-[#ff453a] border-transparent font-semibold";
      case "Fechado": return "bg-[#34c759]/10 text-[#34c759] border-transparent font-semibold";
      case "Perdido": return "bg-[#86868b]/10 text-[#86868b] border-transparent font-semibold";
      default: return "bg-gray-100 text-gray-700 border-transparent";
    }
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 90) return "text-[#34c759] bg-[#34c759]/10 border-transparent font-extrabold";
    if (score >= 80) return "text-[#0071e3] bg-[#0071e3]/10 border-transparent font-extrabold";
    return "text-[#ff9500] bg-[#ff9500]/10 border-transparent font-extrabold";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Matches e Parcerias Inteligentes</h2>
          <p className="text-sm text-[#86868b]">Veja quais ofertas e procuras foram vinculadas de forma ágil pela IA.</p>
        </div>
        <button
          onClick={async () => {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-bold text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer transition shadow-none disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#515154] ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Recalculando..." : "Recalcular Matches"}
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center bg-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-gray-400">
            <Info className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">Nenhum Match Encontrado</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            Nossos algoritmos realizam matches cruzando localização, faixa de preço, tipo de imóvel e cômodos. Cadastre mais imóveis ou procuras ativas!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {matches.map((m: any) => {
            const isOwnerOfProperty = m.propertyCreatedBy === (localStorage.getItem("conectacorretor_user_id") || "admin-id");
            const otherBroker = isOwnerOfProperty ? m.brokerDemand : m.brokerProperty;
            
            return (
              <div
                key={m.id}
                className="group relative rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Top: Broker info bar */}
                {otherBroker && (
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <img
                        src={otherBroker.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&auto=format&fit=crop&q=80"}
                        alt={otherBroker.name}
                        className="h-6 w-6 rounded-full object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-700 leading-tight">{otherBroker.name}</p>
                        <p className="text-[10px] text-gray-400">{otherBroker.creci}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(m.status)}`}>
                        {m.status}
                      </span>
                      <span className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}

                {/* Main: Three-column layout */}
                <div className="flex flex-col md:flex-row items-stretch gap-3">

                  {/* Left: Property photo */}
                  <div className="relative w-full md:w-[140px] shrink-0">
                    <div className="aspect-[4/3] md:aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                      {m.property?.photos?.[0] ? (
                        <img
                          src={m.property.photos[0]}
                          alt={m.propertyTitle || "Imóvel"}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[10px] text-gray-400 font-medium">Sem foto</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-center">
                      <p className="text-[10px] font-bold text-gray-900 truncate px-1">{m.property?.neighborhood || ""}</p>
                      <p className="text-[10px] text-gray-400">{m.property?.city || ""}</p>
                    </div>
                  </div>

                  {/* Center: Match score visualization */}
                  <div className="flex flex-col items-center justify-center gap-2 py-2 md:px-4">
                    <div className="relative flex items-center justify-center">
                      <svg width="90" height="90" viewBox="0 0 120 120" className="shrink-0">
                        <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                        <circle
                          cx="60" cy="60" r="54"
                          fill="none"
                          stroke={m.score >= 90 ? "#22c55e" : m.score >= 80 ? "#3b82f6" : m.score >= 70 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="10"
                          strokeDasharray={`${(m.score / 100) * 339.292} 339.292`}
                          strokeLinecap="round"
                          transform="rotate(-90 60 60)"
                          className="transition-all duration-700"
                        />
                        <text x="60" y="52" textAnchor="middle" className="text-2xl font-bold" fill="#1d1d1f" fontSize="28" fontWeight="800">
                          {m.score}%
                        </text>
                        <text x="60" y="72" textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="600">
                          MATCH
                        </text>
                      </svg>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-[10px] text-gray-500 font-medium">
                        {isOwnerOfProperty ? "Oferta ↔ Procura" : "Procura ↔ Oferta"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Demand info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quem Procura</p>
                    <p className="font-bold text-gray-900 text-sm leading-snug">
                      {m.property?.type || "Imóvel"} • {m.demand?.bedrooms || "?"}qt {m.demand?.parkingSpots || "?"}vg
                    </p>
                    <p className="text-xs text-gray-600 font-medium leading-tight">
                      Até <span className="font-bold text-gray-900">R$ {Number(m.demand?.maxPrice || 0).toLocaleString("pt-BR")}</span>
                      {m.demand?.neighborhoods?.length > 0 && (
                        <> em <span className="font-bold text-gray-900">{m.demand.neighborhoods.slice(0, 2).join(", ")}{m.demand.neighborhoods.length > 2 ? "..." : ""}</span></>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-400">{m.demand?.paymentMethod || ""}</p>
                    {m.demand?.notes && (
                      <p className="text-[10px] text-gray-500 italic mt-1 line-clamp-2">"{m.demand.notes}"</p>
                    )}
                  </div>

                </div>

                {/* Bottom: Actions */}
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleStartWhatsAppContact(m)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-xs font-semibold text-white shadow-sm hover:brightness-105 transition"
                  >
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => handleOpenDetails(m)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
                  >
                    Detalhes
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extreme Detail Slider / Dialog (With IA justifications of match) */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-all overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white border border-gray-100 shadow-2xl p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header close */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border font-mono font-bold text-lg ${getScoreColorClass(selectedMatch.score)}`}>
                  {selectedMatch.score}%
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Detalhes da Parceria CC-{selectedMatch.id.slice(-4)}</h3>
                  <p className="text-xs text-gray-400">Match imobiliário calculado em {new Date(selectedMatch.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 hover:text-black hover:bg-slate-50 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* AI Insights Segment (PRD Section 6.7 match score generated by IA) */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-purple-600 text-white">
                  <Sparkles className="h-4.5 w-4.5 text-white fill-purple-100" />
                </span>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Parecer do Consultor IA ConectaCorretor</h4>
                  <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider block">Estudo de Viabilidade B2B</span>
                </div>
              </div>

              {loadingInsights && (
                <div className="py-6 text-center space-y-3">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600 mx-auto" />
                  <p className="text-xs text-gray-500 font-medium">A IA está analisando os diferenciais do imóvel e valores de partilha...</p>
                </div>
              )}

              {matchInsights && !loadingInsights && (
                <div className="space-y-3 text-xs leading-relaxed text-gray-700">
                  <div className="bg-white p-3 rounded-xl border border-purple-100/60 shadow-sm space-y-1">
                    <span className="text-[10px] uppercase font-bold text-purple-800">Por que é compatível?</span>
                    <MarkdownText text={matchInsights.explanation} className="text-gray-700 font-medium" />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-100/60 shadow-sm space-y-1">
                    <span className="text-[10px] uppercase font-bold text-purple-800">Conselho Consultivo de Parceria</span>
                    <MarkdownText text={matchInsights.advice} className="text-gray-700 font-medium" />
                  </div>

                  <div className="text-[10px] text-purple-500 font-medium italic">
                    <MarkdownText text={matchInsights.scoreExplanation} />
                  </div>
                </div>
              )}
            </div>

            {/* Double cards comparing listing with client requirements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Offer Panel */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <h5 className="font-bold text-xs text-blue-900 uppercase">Imóvel Disponível</h5>
                </div>
                {selectedMatch.property ? (
                  <div className="text-xs space-y-2">
                    <p className="font-bold text-gray-900 leading-tight">{selectedMatch.property.title}</p>
                    <p className="text-gray-500 font-medium">Bairro: <b>{selectedMatch.property.neighborhood}</b> (Cidade: {selectedMatch.property.city})</p>
                    <p className="font-bold text-gray-800">Preço: R$ {selectedMatch.property.price.toLocaleString("pt-BR")}</p>
                    <div className="flex gap-4 text-gray-500">
                      <span>Quartos: {selectedMatch.property.bedrooms}</span>
                      <span>Vagas: {selectedMatch.property.parkingSpots}</span>
                      <span>Área: {selectedMatch.property.area} m²</span>
                    </div>
                    {selectedMatch.property.commission && (
                      <div className="bg-blue-50 text-blue-800 rounded-lg p-2 font-semibold">
                        Comissão de Parceria: {selectedMatch.property.commission}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Disponibilidade de dados corrompida</p>
                )}
              </div>

              {/* Demand Panel */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  <h5 className="font-bold text-xs text-indigo-900 uppercase">Cadastros da Procura</h5>
                </div>
                {selectedMatch.demand ? (
                  <div className="text-xs space-y-2">
                    <p className="font-bold text-gray-900 leading-tight">Procura ID: {selectedMatch.demand.id.toUpperCase().slice(-5)}</p>
                    <p className="text-gray-500 font-medium">Locais de Interesse: <b>{selectedMatch.demand.neighborhoods.join(", ") || "Qualquer bairro"}</b></p>
                    <p className="font-bold text-gray-800">Preço Máximo: R$ {selectedMatch.demand.maxPrice.toLocaleString("pt-BR")}</p>
                    <div className="flex gap-4 text-gray-500">
                      <span>Min Quartos: {selectedMatch.demand.bedrooms}</span>
                      <span>Min Vagas: {selectedMatch.demand.parkingSpots}</span>
                      <span>Min Área: {selectedMatch.demand.minArea} m²</span>
                    </div>
                    <p className="text-gray-600 font-medium">Forma Pagto: {selectedMatch.demand.paymentMethod}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Dados da procura não localizados</p>
                )}
              </div>
            </div>

            {/* Negotiation History & Shift Status (PRD Section 6.9 Statuses) */}
            <div className="border-t border-gray-150 pt-5 space-y-4">
              <h4 className="font-bold text-gray-900 text-sm">Atualizar Status da Parceria B2B</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status de Negociação</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as MatchStatus)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="Novo">Novo (Gerado automaticamente)</option>
                      <option value="Visualizado">Visualizado</option>
                      <option value="Em contato">Em contato direto</option>
                      <option value="Em negociação">Em negociação ativa</option>
                      <option value="Fechado">Fechado (Negócio Realizado! 🎉)</option>
                      <option value="Perdido">Perdido (Cancelado/Incompatível)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Anotações / Histórico de Parceria</label>
                    <textarea
                      rows={2}
                      value={transitionNotes}
                      placeholder="Adicione um detalhe do status da conversa, ex: 'Agendamos visita com comprador para amanhã às 14h.'"
                      onChange={(e) => setTransitionNotes(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveStatus}
                    disabled={statusLoading}
                    className="rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold px-6 py-3 border-0 transition cursor-pointer disabled:bg-slate-300"
                  >
                    {statusLoading ? "Salvando..." : "Registrar Novo Status"}
                  </button>
                </div>

                {/* Audit history logs */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4.5 space-y-3 overflow-y-auto max-h-56">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Histórico de Alterações</span>
                  <div className="space-y-3.5 relative pl-3 border-l border-gray-200">
                    {selectedMatch.history?.map((hist: any, index: number) => (
                      <div key={index} className="relative text-xs space-y-1">
                        {/* Bullet indicators */}
                        <div className="absolute -left-5 top-1 h-3 w-3 rounded-full border bg-white border-blue-500 shrink-0" />
                        
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-800">{hist.status}</span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {new Date(hist.updatedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-500 font-medium">Por: <b>{hist.updatedBy}</b></p>
                        {hist.notes && <p className="text-gray-600 bg-white/60 p-2.5 rounded-lg border border-slate-100/50 leading-relaxed italic">{hist.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-100 justify-end">
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="rounded-xl border border-gray-300 bg-white px-6 py-2.5 font-semibold text-gray-700 text-xs hover:bg-gray-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => handleStartWhatsAppContact(selectedMatch)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-6 py-2.5 text-xs font-bold text-white hover:brightness-105 shadow-sm transition"
              >
                <MessageSquare className="h-4.5 w-4.5 text-white" />
                Dobra Comercial: Iniciar Conversa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
