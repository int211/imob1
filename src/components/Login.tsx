import { useState } from "react";
import { Building2, Loader2, Eye, EyeOff, LogIn, UserPlus, CheckCircle } from "lucide-react";
import { Corretor } from "../types";

interface LoginProps {
  onLogin: (user: Corretor) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCreci, setRegCreci] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error || "Falha no login.");
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regName.trim() || !regEmail.trim() || !regCreci.trim() || !regPassword.trim()) {
      setError("Nome, E-mail, CRECI e senha são obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          creci: regCreci.trim(),
          phone: regPhone.trim(),
          city: regCity.trim() || "Salvador",
          password: regPassword
        })
      });
      const data = await res.json();
      if (res.ok || res.status === 201) {
        setRegSuccess(true);
        setTimeout(() => {
          setMode("login");
          setEmail(regEmail.trim());
          setPassword(regPassword);
          setRegSuccess(false);
        }, 2500);
      } else {
        setError(data.error || "Erro ao cadastrar.");
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1d1d1f] dark:bg-dark-bg">
      {/* Left panel - Login / Register form */}
      <div className="flex w-full md:w-1/2 items-center justify-center bg-[#f8fafc] p-8 dark:bg-dark-bg">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d1d1f] dark:bg-dark-card">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[#1d1d1f] dark:text-dark-text leading-tight">ConectaCorretor</h1>
              <p className="text-[10px] font-semibold text-[#86868b] dark:text-dark-muted tracking-wide uppercase">B2B</p>
            </div>
          </div>

          {/* Tab toggle */}
          <div className="flex mb-6 bg-[#e8e8ed] dark:bg-gray-800 p-0.5 rounded-full w-fit">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`px-5 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
                mode === "login" ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-dark-card dark:text-dark-text" : "text-[#515154] hover:text-[#1d1d1f] dark:text-dark-muted dark:hover:text-dark-text"
              }`}
            >
              <LogIn className="h-3.5 w-3.5 inline mr-1" />
              Entrar
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className={`px-5 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
                mode === "register" ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-dark-card dark:text-dark-text" : "text-[#515154] hover:text-[#1d1d1f] dark:text-dark-muted dark:hover:text-dark-text"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5 inline mr-1" />
              Cadastrar
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#1d1d1f] hover:bg-black dark:bg-dark-card dark:hover:bg-gray-800 text-white font-bold py-3 text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              {regSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mb-3" />
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Cadastro realizado com sucesso!</p>
                  <p className="text-xs text-gray-500 dark:text-dark-muted mt-1">Redirecionando para o login...</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">Nome</label>
                      <input
                        type="text"
                        placeholder="Seu nome"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">E-mail</label>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">CRECI</label>
                      <input
                        type="text"
                        placeholder="Ex: CRECI 00000-F"
                        value={regCreci}
                        onChange={(e) => setRegCreci(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">Telefone</label>
                      <input
                        type="text"
                        placeholder="+55 (71) 99999-0000"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">Cidade</label>
                    <input
                      type="text"
                      placeholder="Salvador"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#515154] dark:text-dark-muted uppercase tracking-wide mb-1 block">Senha</label>
                    <input
                      type="password"
                      placeholder="Crie uma senha"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-dark-text dark:border-dark-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {error && <p className="text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#1d1d1f] hover:bg-black dark:bg-dark-card dark:hover:bg-gray-800 text-white font-bold py-3 text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {loading ? "Cadastrando..." : "Criar conta"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Right panel - Full image with brand overlay */}
      <div className="hidden md:flex relative w-1/2 items-center justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&auto=format&fit=crop&q=80"
          alt="Imóveis"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />

        {/* Central brand */}
        <div className="relative z-10 flex flex-col items-center text-center px-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 mb-6 shadow-lg">
            <Building2 className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg">ConectaCorretor</h2>
          <p className="text-base md:text-lg text-white/80 mt-3 font-medium max-w-md drop-shadow-md">
            A plataforma B2B que conecta corretores a oportunidades reais de negócio.
          </p>
          <div className="mt-8 flex gap-6 text-white/60 text-xs font-semibold uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Imóveis</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Demandas</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Matches</span>
          </div>
        </div>
      </div>
    </div>
  );
}
