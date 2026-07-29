export type ResultadoGeneracion = {
  contenido: Record<string, unknown>;
  modelo: string;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  latenciaMs: number;
  costoMicros: number | null;
};

type Configuracion = {
  apiKey: string;
  model: string;
  jsonSchema: Record<string, unknown>;
  brief: string;
  currentContent: Record<string, unknown>;
  targetSection?: string;
};

export const PROMPT_VERSION = 'coffee-copy-v1';

/** Genera copy estructurado; el contrato decide después qué campos fusionar. */
export async function generarContenido(config: Configuracion): Promise<ResultadoGeneracion> {
  const inicio = Date.now();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
  const alcance = config.targetSection
    ? `Regenera únicamente la sección "${config.targetSection}".`
    : 'Genera todas las secciones incluidas en el schema.';
  const respuesta = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text:
        'Eres un copywriter de respuesta directa para Colombia. Devuelve solo JSON válido. ' +
        'No inventes testimonios, cifras, certificaciones, garantías, urgencia ni resultados. ' +
        'No escribas precios, URLs ni referencias de imágenes. Respeta literalmente el schema.'
      }] },
      contents: [{ role: 'user', parts: [{ text:
        `${alcance}\n\nBrief del vendedor:\n${config.brief}\n\nContenido actual:\n${JSON.stringify(config.currentContent)}`
      }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: config.jsonSchema },
    }),
  });
  const cuerpo = await respuesta.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  if (!respuesta.ok) throw new Error(cuerpo.error?.message ?? `Gemini respondió HTTP ${respuesta.status}`);
  const texto = cuerpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!texto) throw new Error('Gemini no devolvió contenido.');
  let contenido: Record<string, unknown>;
  try {
    const analizado = JSON.parse(texto) as unknown;
    if (!analizado || typeof analizado !== 'object' || Array.isArray(analizado)) throw new Error();
    contenido = analizado as Record<string, unknown>;
  } catch { throw new Error('Gemini devolvió JSON inválido.'); }
  const entrada = cuerpo.usageMetadata?.promptTokenCount ?? null;
  const salida = cuerpo.usageMetadata?.candidatesTokenCount ?? null;
  return { contenido, modelo: config.model, tokensEntrada: entrada, tokensSalida: salida,
    latenciaMs: Date.now() - inicio, costoMicros: estimarCostoMicros(config.model, entrada, salida) };
}

/** Gemini 3.6 Flash: USD 1,50/M input y USD 7,50/M output. */
export function estimarCostoMicros(modelo: string, entrada: number | null, salida: number | null): number | null {
  if (entrada === null || salida === null || modelo !== 'gemini-3.6-flash') return null;
  return Math.round(entrada * 1.5 + salida * 7.5);
}
