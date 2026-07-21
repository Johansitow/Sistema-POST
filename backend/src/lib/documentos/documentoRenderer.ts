/**
 * documentoRenderer.ts — genera el HTML de los documentos laborales.
 *
 * Equivalente de `ticketRenderer.ts` (frontend) para el otro extremo del
 * espectro: aquel imprime tirillas térmicas monoespaciadas de 58/80 mm, este
 * produce documentos formales en A4 con tipografía serif.
 *
 * ¿Por qué en el BACKEND y no junto al ticketRenderer?
 * Un certificado laboral tiene valor probatorio. Si el HTML lo armara el
 * navegador, el contenido del documento dependería de lo que enviara el
 * cliente, y ni el snapshot ni el hash servirían de nada. Renderizando aquí,
 * el servidor es la única fuente del documento. El preview del editor llama a
 * este mismo código, así que preview ≡ documento emitido por construcción.
 */

import QRCode from 'qrcode';
import type { DocumentoConfig } from './catalogo';
import { construirVariables, sustituir, escaparHtml, type ContextoDocumento } from './variables';

// ─── CSS ──────────────────────────────────────────────────────────────────────

const TAMANOS: Record<string, string> = { small: '11pt', medium: '12pt', large: '13pt' };

function buildCSS(cfg: DocumentoConfig['config']): string {
  const base = TAMANOS[cfg.fontSize] ?? TAMANOS.medium;

  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${cfg.paperWidth === 'Carta' ? 'letter' : 'A4'}; margin: 25mm 25mm 20mm 25mm; }
  body {
    font-family: 'Times New Roman', Georgia, serif;
    font-size: ${base};
    line-height: 1.6;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .membrete      { text-align: center; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 26px; }
  .membrete .empresa { font-size: 1.35em; font-weight: bold; letter-spacing: .5px; }
  .membrete .datos   { font-size: .8em; color: #444; margin-top: 3px; }
  .logo          { max-height: 60px; margin-bottom: 8px; }

  .consecutivo   { text-align: right; font-size: .8em; color: #555; margin-bottom: 18px; }
  .titulo        { text-align: center; font-size: 1.15em; font-weight: bold;
                   letter-spacing: 1.5px; text-decoration: underline; margin: 26px 0; }

  .cuerpo p      { margin-bottom: 14px; text-align: justify; }
  .despedida     { margin-top: 26px; text-align: justify; }

  .firma         { margin-top: 70px; }
  .firma .linea  { border-top: 1px solid #111; width: 260px; margin-bottom: 4px; }
  .firma .nombre { font-weight: bold; }
  .firma .cargo  { font-size: .85em; color: #444; }
  .firma img     { max-height: 55px; display: block; margin-bottom: 2px; }

  .verificacion  { margin-top: 42px; border-top: 1px dashed #999; padding-top: 12px;
                   display: flex; gap: 14px; align-items: center; font-size: .72em; color: #555; }
  .verificacion svg { width: 84px; height: 84px; flex-shrink: 0; }
  .verificacion .codigo { font-family: 'Courier New', monospace; font-weight: bold;
                          font-size: 1.35em; letter-spacing: 2px; color: #111; }
  .vencimiento   { margin-top: 6px; font-style: italic; }
`;
}

// ─── Bloques ──────────────────────────────────────────────────────────────────

function membrete(ctx: ContextoDocumento, mostrarLogo: boolean, logoUrl?: string | null): string {
  const { empresa } = ctx;
  const datos = [
    empresa.nit ? `NIT ${escaparHtml(empresa.nit)}` : '',
    empresa.direccion ? escaparHtml(empresa.direccion) : '',
    empresa.ciudad ? escaparHtml(empresa.ciudad) : '',
    empresa.telefono ? `Tel. ${escaparHtml(empresa.telefono)}` : '',
  ].filter(Boolean).join(' · ');

  return `
    <div class="membrete">
      ${mostrarLogo && logoUrl ? `<img class="logo" src="${escaparHtml(logoUrl)}" alt="" />` : ''}
      <div class="empresa">${escaparHtml(empresa.nombre)}</div>
      ${datos ? `<div class="datos">${datos}</div>` : ''}
    </div>`;
}

function bloqueFirma(doc: DocumentoConfig['documento'], vars: Record<string, string>, firmaUrl?: string | null): string {
  if (!doc.firma.mostrar) return '';

  const nombre = sustituir(doc.firma.nombre || '{{firma.nombre}}', vars);
  const cargo  = sustituir(doc.firma.cargo  || '{{firma.cargo}}',  vars);

  return `
    <div class="firma">
      ${firmaUrl ? `<img src="${escaparHtml(firmaUrl)}" alt="" />` : ''}
      <div class="linea"></div>
      <div class="nombre">${nombre}</div>
      <div class="cargo">${cargo}</div>
    </div>`;
}

/**
 * Bloque de verificación con QR.
 *
 * Deliberadamente NO incluye datos sensibles: el QR apunta a una página que
 * confirma la autenticidad del documento sin revelar el salario. Quien
 * verifica quiere saber "¿este certificado es real?", no cuánto gana la
 * persona.
 */
async function bloqueVerificacion(
  ctx: ContextoDocumento,
  urlVerificacion: string,
  vigenciaHasta: Date | null,
): Promise<string> {
  const qr = await QRCode.toString(urlVerificacion, {
    type: 'svg', margin: 0, errorCorrectionLevel: 'M',
  });

  const vence = vigenciaHasta
    ? `<div class="vencimiento">Válido hasta el ${vigenciaHasta.toLocaleDateString('es-CO')}.</div>`
    : '';

  return `
    <div class="verificacion">
      ${qr}
      <div>
        <div>Documento verificable en línea. Escanea el código o visita:</div>
        <div>${escaparHtml(urlVerificacion)}</div>
        <div class="codigo">${escaparHtml(ctx.codigo)}</div>
        ${vence}
      </div>
    </div>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

export interface RenderOpciones {
  plantilla:       DocumentoConfig;
  contexto:        ContextoDocumento;
  urlVerificacion: string;
  vigenciaHasta:   Date | null;
  logoUrl?:        string | null;
  firmaUrl?:       string | null;
}

/**
 * renderizarDocumento — HTML completo y autocontenido del documento.
 * Devuelve también las variables resueltas, que se guardan como snapshot de
 * los datos con los que se emitió.
 */
export async function renderizarDocumento(
  opts: RenderOpciones,
): Promise<{ html: string; variables: Record<string, string> }> {
  const { plantilla, contexto, urlVerificacion, vigenciaHasta, logoUrl, firmaUrl } = opts;
  const doc  = plantilla.documento;
  const vars = construirVariables(contexto);

  const cuerpo = doc.cuerpo
    .map(p => `<p>${sustituir(p, vars)}</p>`)
    .join('\n');

  const verificacion = doc.mostrar_qr
    ? await bloqueVerificacion(contexto, urlVerificacion, vigenciaHasta)
    : '';

  const body = `
    ${membrete(contexto, plantilla.config.showLogo, logoUrl)}
    <div class="consecutivo">${escaparHtml(contexto.consecutivo)}</div>
    <div class="titulo">${sustituir(doc.titulo, vars)}</div>
    <div class="cuerpo">${cuerpo}</div>
    <div class="despedida">${sustituir(doc.despedida, vars)}</div>
    ${bloqueFirma(doc, vars, firmaUrl)}
    ${verificacion}
  `;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">`
    + `<title>${sustituir(doc.titulo, vars)}</title>`
    + `<style>${buildCSS(plantilla.config)}</style></head><body>${body}</body></html>`;

  return { html, variables: vars };
}
