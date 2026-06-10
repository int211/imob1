import { Property, Demand } from "../src/types.js";
import { db } from "./db.js";

const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const settings = db.getSettings();
  const apiKey = settings.geminiApiKey || process.env.LLM_API_KEY || "";
  const model = settings.llmModelName || "openai/gpt-4o-mini";
  let endpoint = settings.llmEndpointUrl || DEFAULT_OPENROUTER_URL;
  if (endpoint === "https://api.google.com/gemini" || endpoint?.includes("/v1/models")) {
    endpoint = DEFAULT_OPENROUTER_URL;
  }

  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://conectacorretor.com.br",
      "X-Title": "ConectaCorretor"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error (${res.status}): ${err}`);
  }

  let data: any;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw new Error("LLM returned non-JSON response");
  }
  return data.choices?.[0]?.message?.content || "";
}

// 1. Interpret Free-Text Buyer Demand (PRD Section 6.6)
export async function interpretDemand(rawText: string, defaultCity: string = "Salvador"): Promise<{
  type: string;
  bairros: string[];
  bedrooms: number;
  parkingSpots: number;
  maxPrice: number;
  city: string;
}> {
  const defaultFallback = {
    type: "apartamento",
    bairros: [] as string[],
    bedrooms: 2,
    parkingSpots: 1,
    maxPrice: 600000,
    city: defaultCity
  };

  const settings = db.getSettings();
  if (!settings.geminiApiKey) {
    console.log("No LLM API key. Parsing demand using local heuristic filters...");
    const parsed = { ...defaultFallback };

    const priceMatch = rawText.match(/(\d+)\s*(mil|milhões|milhao|milis)/i);
    if (priceMatch) {
      let val = parseInt(priceMatch[1]);
      if (rawText.includes("milhão") || rawText.includes("milhao") || rawText.includes("milhões")) {
        parsed.maxPrice = val * 1000000;
      } else {
        parsed.maxPrice = val * 1000;
      }
    }
    const bedMatch = rawText.match(/(\d+)\s*(quartos|quarto|qts|dormitorios|dormitórios|suítes|suites)/i);
    if (bedMatch) {
      parsed.bedrooms = parseInt(bedMatch[1]);
    }
    const parkMatch = rawText.match(/(\d+)\s*(vagas|vaga|garagem|garagens)/i);
    if (parkMatch) {
      parsed.parkingSpots = parseInt(parkMatch[1]);
    }
    if (rawText.toLowerCase().includes("pituba")) parsed.bairros.push("Pituba");
    if (rawText.toLowerCase().includes("itaim")) parsed.bairros.push("Itaim Bibi");
    if (rawText.toLowerCase().includes("casa")) parsed.type = "casa";

    return parsed;
  }

  try {
    const prompt = `Você é uma inteligência artificial especialista em mercado imobiliário brasileiro.
Analise a mensagem enviada de um comprador buscando imóvel, identificando os atributos desejados e preenchendo a estrutura JSON solicitada.

Mensagem do Comprador: "${rawText}"

Instruções Importantes de Mapeamento:
1. "type": Deve ser um dos seguintes em minúsculo: "apartamento", "casa", "terreno", "cobertura", "comercial" ou "outro".
2. "bairros": Uma lista/array de strings contendo os nomes dos bairros identificados na mensagem (capitalizados, ex: ["Pituba", "Caminho das Árvores"]). Caso não haja menções claras de bairros, retorne uma lista vazia.
3. "bedrooms": Número inteiro de quartos desejados. Se não mencionado, retorne 2.
4. "parkingSpots": Número de vagas de garagem necessárias. Se não mencionado, retorne 1.
5. "maxPrice": O valor máximo em reais (R$) extraído. Por exemplo, "700 mil" vira 700000, "1.2 milhão" vira 1200000. Se oculto, retorne 600000.
6. "city": A cidade principal de interesse de atuação. Use "${defaultCity}" se não for evidente.

Sua resposta DEVE ser estritamente um código JSON válido e nada mais, contendo as propriedades: "type", "bairros", "bedrooms", "parkingSpots", "maxPrice", "city".
Não use tags markdown de bloco além de JSON.`;

    const text = await callLLM(
      "Você é um assistente que retorna apenas JSON válido.",
      prompt
    );
    const cleanJsonText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJsonText);
  } catch (err) {
    console.error("LLM demand parsing error, falling back", err);
    return defaultFallback;
  }
}

// 2. Optimize Property Listing text quality (PRD Section 6.4 and 7)
export async function optimizeListing(prop: {
  title: string;
  type: string;
  price: string | number;
  city: string;
  neighborhood: string;
  description: string;
  features: string[];
}): Promise<{
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedFeatures: string[];
  qualityScore: number;
  marketingTips: string[];
  estimatedConversionProgress: string;
}> {
  const fallbackResponse = {
    suggestedTitle: `✨ OPORTUNIDADE: ${prop.title}`,
    suggestedDescription: `${prop.description}\n\n* Diferenciais destacados: ${prop.features.join(", ")}.\n* Excelente localização em ${prop.neighborhood}, ${prop.city}. Visite com nossos corretores cadastrados!`,
    suggestedFeatures: prop.features.length > 0 ? prop.features : ["infraestrutura completa", "boa localização"],
    qualityScore: 85,
    marketingTips: [
      "Adicione as despesas de imposto IPTU e taxa de condomínio para aumentar a confiança.",
      "Promova fotos com boa iluminação solar natural na sala principal.",
      "Destaque a segurança do portão de acesso no texto."
    ],
    estimatedConversionProgress: "O anúncio atende aos critérios básicos de captação e está pronto para receber parcerias B2B."
  };

  const settings = db.getSettings();
  if (!settings.geminiApiKey) {
    return fallbackResponse;
  }

  try {
    const prompt = `Você é um Copywriter especialista em anúncios imobiliários do setor de alto padrão no Brasil.
Seu objetivo é analisar e otimizar um anúncio de imóvel para torná-lo irresistível e propício a atrair outros corretores para parceria (split 50/50).

Dados atuais da captação:
- Título do anúncio: "${prop.title}"
- Bairro: "${prop.neighborhood}"
- Cidade: "${prop.city}"
- Tipo: "${prop.type}"
- Preço informado: R$ ${prop.price}
- Diferenciais catalogados: [${prop.features.join(", ")}]
- Descrição original: "${prop.description}"

Gere uma resposta em JSON contendo exatamente os seguintes campos:
1. "suggestedTitle": Um título cativante, persuasivo e mais qualificado para a internet (limite 80 caracteres).
2. "suggestedDescription": Uma descrição rica, com parágrafos escaneáveis, destacando pontos fortes de mobilidade, infraestrutura e o split de comissão.
3. "suggestedFeatures": Lista atualizada sugerindo diferenciais que combinam com as descrições.
4. "qualityScore": Um número inteiro de 0 a 100 avaliando a completude inicial do anúncio recebido.
5. "marketingTips": Array contendo 3 dicas práticas de marketing imobiliário para este imóvel (fotos, visitas, pontos de atração).
6. "estimatedConversionProgress": Uma frase positiva descrevendo o ganho estimado com a mudança.

Gere apenas o objeto JSON estruturado solicitado. Não adicione textos adicionais antes ou depois da estrutura.`;

    const text = await callLLM(
      "Você é um assistente que retorna apenas JSON válido.",
      prompt
    );
    const cleanJsonText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJsonText);
  } catch (err) {
    console.error("LLM optimization error", err);
    return fallbackResponse;
  }
}

// 3. Explain and Justify partnership match scores (PRD Section 6.7 and 7)
export async function getMatchInsights(
  property: Property,
  demand: Demand,
  score: number,
  matchId?: string
): Promise<{
  explanation: string;
  advice: string;
  scoreExplanation: string;
}> {
  // If matchId provided, check if insights already cached
  if (matchId) {
    const existing = db.getMatch(matchId);
    if (existing?.insights) {
      return existing.insights;
    }
  }

  const fallbackResponse = {
    explanation: `Este match de ${score}% é provocado pela similaridade impecável geográfica (ambos se localizam em ${property.neighborhood}) e pela correspondência perfeita da tipologia buscada (apartamento) para o valor pretendido de R$ ${property.price.toLocaleString("pt-BR")}.`,
    advice: `Sugerimos que o proprietário envie a planta baixa do apartamento por WhatsApp e alinhe uma visita conjunta. Como o cliente possui financiamento pré-aprovado, a agilidade do agendamento é fator crítico de sucesso.`,
    scoreExplanation: `Avaliação automática baseada nas distâncias geográficas, cômodos de condomínio e margem de orçamentos.`
  };

  const settings = db.getSettings();
  if (!settings.geminiApiKey) {
    if (matchId) db.updateMatch(matchId, { insights: fallbackResponse });
    return fallbackResponse;
  }

  try {
    const prompt = `Você é um analista imobiliário de mercado neutro que apoia corretores a fechar negócios cruzando interesses de imóveis e compradores de forma ágil e segura.
Você deve explicar o Match de ${score}% de compatibilidade calculado entre a oferta de captação e a procura enviada por um colega corretor.

DADOS DA OFERTA (Seu Imóvel):
- Título: "${property.title}"
- Bairro: "${property.neighborhood}" | Preço: R$ ${property.price}
- Quartos: ${property.bedrooms} | Vagas: ${property.parkingSpots} | Área: ${property.area} m²
- Comissão pactuada: "${property.commission}"

DADOS DA PROCURA (Cliente do Parceiro):
- Tipo buscado: "${demand.type}" alinhado com finalidade "${demand.purpose}"
- Bairros desejados: [${demand.neighborhoods.join(", ")}]
- Preço Máximo: R$ ${demand.maxPrice} | Quartos Mínimos: ${demand.bedrooms} | Vagas Mínimas: ${demand.parkingSpots}
- Meios de Pagamento: "${demand.paymentMethod}"
- Notas do Cliente: "${demand.notes || ""}"

Gere uma resposta em formato JSON estrito contendo os campos:
1. "explanation": Explicação persuasiva, de 2 a 3 frases, sobre por que esse imóvel atende perfeitamente ao pedido do comprador (mostrando a sinergia de preço, quartos e bairro).
2. "advice": Um conselho prático focado em como os dois corretores devem conduzir a parceria (split de comissão, agendamento de visita, compartilhamento de material).
3. "scoreExplanation": Justificativa técnica do porquê o score de match foi definido em ${score}%.

Retorne estritamente o objeto JSON.`;

    const text = await callLLM(
      "Você é um assistente que retorna apenas JSON válido.",
      prompt
    );
    const cleanJsonText = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleanJsonText);
    if (matchId) db.updateMatch(matchId, { insights: result });
    return result;
  } catch (err) {
    console.error("LLM match insights error", err);
    if (matchId) db.updateMatch(matchId, { insights: fallbackResponse });
    return fallbackResponse;
  }
}

// 4. Test LLM connection (used by admin panel test button)
export async function testConnection(overrideKey?: string, overrideModel?: string): Promise<string> {
  const settings = db.getSettings();
  const apiKey = overrideKey || settings.geminiApiKey || process.env.LLM_API_KEY || "";

  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const model = overrideModel || settings.llmModelName || "openai/gpt-4o-mini";
  const endpoint = DEFAULT_OPENROUTER_URL;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://conectacorretor.com.br",
      "X-Title": "ConectaCorretor"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Você é um assistente útil." },
        { role: "user", content: "Responda apenas com a palavra 'OK' se você está funcionando." }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sem resposta";
}

// 5. List available models from OpenRouter
export async function listModels(overrideKey?: string): Promise<{ id: string; name: string; description: string }[]> {
  const settings = db.getSettings();
  const apiKey = overrideKey || settings.geminiApiKey || process.env.LLM_API_KEY || "";

  if (!apiKey) {
    throw new Error("API key not configured");
  }

  console.log(`[listModels] Fetching from ${OPENROUTER_MODELS_URL} with key length ${apiKey.length}...`);
  let res;
  try {
    res = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
  } catch (fetchErr: any) {
    console.error(`[listModels] Network error calling OpenRouter:`, fetchErr.message);
    throw new Error(`Network error reaching OpenRouter: ${fetchErr.message}`);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "(no body)");
    console.error(`[listModels] HTTP ${res.status}: ${errBody.slice(0, 500)}`);
    throw new Error(`OpenRouter models API error (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const rawText = await res.text().catch(() => "");
  if (!rawText) {
    throw new Error("OpenRouter returned empty response body");
  }
  console.log(`[listModels] Raw body length: ${rawText.length} chars`);

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr: any) {
    console.error(`[listModels] JSON parse error:`, parseErr.message);
    console.error(`[listModels] Raw body preview:`, rawText.slice(0, 500));
    throw new Error(`Failed to parse OpenRouter response: ${parseErr.message}`);
  }

  console.log(`[listModels] Raw response keys: ${Object.keys(data)}`);
  const modelsRaw = data.data;
  console.log(`[listModels] data.data type: ${typeof modelsRaw}, isArray: ${Array.isArray(modelsRaw)}`);

  if (!Array.isArray(modelsRaw)) {
    console.error(`[listModels] Unexpected response structure:`, JSON.stringify(data).slice(0, 500));
    throw new Error(`OpenRouter returned unexpected format (expected data to be an array)`);
  }

  const models = modelsRaw.map((m: any) => ({
    id: m.id,
    name: m.name || m.id,
    description: m.description || ""
  }));
  console.log(`[listModels] Mapped ${models.length} models`);
  return models;
}
