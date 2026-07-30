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

// ─── Desprendible de pago ─────────────────────────────────────────────────────

export interface LineaDesprendible {
  codigo:   string;
  nombre:   string;
  tipo:     string;
  cantidad: number;
  valor:    number;
}

export interface DatosDesprendible {
  periodo_nombre: string;
  fecha_inicio:   Date;
  fecha_fin:      Date;
  dias:           number;
  salario_base:   number;
  ibc:            number;
  conceptos:      LineaDesprendible[];
  total_devengado:   number;
  total_deducciones: number;
  neto_pagar:        number;
  banco?:         string | null;
  numero_cuenta?: string | null;
}

const money = (v: number) => '$ ' + Math.round(v).toLocaleString('es-CO');

/**
 * renderizarDesprendible — comprobante de nómina.
 *
 * No usa el cuerpo de párrafos de los demás documentos: un desprendible es una
 * tabla de devengados y deducciones. Comparte el membrete, el bloque de
 * verificación y el consecutivo con el resto de documentos laborales.
 *
 * Muestra las líneas del trabajador (devengados y deducciones). Los aportes
 * del empleador y las provisiones NO aparecen: son costo de la empresa, no
 * conceptos del trabajador, y ponerlos confundiría a quien lee su colilla.
 */
export async function renderizarDesprendible(opts: {
  plantilla:       DocumentoConfig;
  contexto:        ContextoDocumento;
  datos:           DatosDesprendible;
  urlVerificacion: string;
  logoUrl?:        string | null;
}): Promise<{ html: string; variables: Record<string, string> }> {
  const { plantilla, contexto, datos, urlVerificacion, logoUrl } = opts;
  const vars = construirVariables(contexto);

  const filas = (tipo: string) => datos.conceptos
    .filter(c => c.tipo === tipo)
    .map(c => `
      <tr>
        <td>${escaparHtml(c.nombre)}</td>
        <td class="num">${c.cantidad > 0 ? c.cantidad.toLocaleString('es-CO') : ''}</td>
        <td class="num">${money(c.valor)}</td>
      </tr>`)
    .join('');

  const fecha = (d: Date) => d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const cuerpo = `
    <table class="datos-empleado">
      <tr>
        <td><strong>Empleado:</strong> ${escaparHtml(contexto.empleado.nombre_completo)}</td>
        <td><strong>Documento:</strong> ${escaparHtml(contexto.empleado.documento_identidad ?? '—')}</td>
      </tr>
      <tr>
        <td><strong>Cargo:</strong> ${escaparHtml(contexto.empleado.cargo ?? '—')}</td>
        <td><strong>Código:</strong> ${escaparHtml(contexto.empleado.codigo_empleado ?? '—')}</td>
      </tr>
      <tr>
        <td><strong>Periodo:</strong> ${escaparHtml(datos.periodo_nombre)}</td>
        <td><strong>Del</strong> ${fecha(datos.fecha_inicio)} <strong>al</strong> ${fecha(datos.fecha_fin)}</td>
      </tr>
      <tr>
        <td><strong>Días liquidados:</strong> ${datos.dias}</td>
        <td><strong>Salario base:</strong> ${money(datos.salario_base)}</td>
      </tr>
    </table>

    <table class="conceptos">
      <thead>
        <tr><th colspan="3">DEVENGADOS</th></tr>
        <tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Valor</th></tr>
      </thead>
      <tbody>
        ${filas('devengado')}
        <tr class="subtotal">
          <td colspan="2">Total devengado</td>
          <td class="num">${money(datos.total_devengado)}</td>
        </tr>
      </tbody>
    </table>

    <table class="conceptos">
      <thead>
        <tr><th colspan="3">DEDUCCIONES</th></tr>
        <tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Valor</th></tr>
      </thead>
      <tbody>
        ${filas('deduccion') || '<tr><td colspan="3">Sin deducciones</td></tr>'}
        <tr class="subtotal">
          <td colspan="2">Total deducciones</td>
          <td class="num">${money(datos.total_deducciones)}</td>
        </tr>
      </tbody>
    </table>

    <table class="neto">
      <tr>
        <td>NETO A PAGAR</td>
        <td class="num">${money(datos.neto_pagar)}</td>
      </tr>
    </table>

    ${datos.banco ? `<p class="pago">Pago por ${escaparHtml(datos.banco)}${
      datos.numero_cuenta ? ` — cuenta terminada en ${escaparHtml(datos.numero_cuenta.slice(-4))}` : ''
    }.</p>` : ''}

    <p class="nota">Base de cotización (IBC): ${money(datos.ibc)}.</p>
  `;

  const verificacion = plantilla.documento.mostrar_qr
    ? await bloqueVerificacion(contexto, urlVerificacion, null)
    : '';

  const cssExtra = `
    .datos-empleado { width: 100%; margin-bottom: 18px; font-size: .9em; }
    .datos-empleado td { padding: 3px 0; }
    .conceptos { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: .9em; }
    .conceptos th, .conceptos td { border: 1px solid #999; padding: 5px 7px; text-align: left; }
    .conceptos thead th { background: #eee; font-weight: bold; }
    .conceptos .num { text-align: right; }
    .conceptos .subtotal td { font-weight: bold; background: #f6f6f6; }
    .neto { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .neto td { border: 2px solid #111; padding: 9px; font-size: 1.1em; font-weight: bold; }
    .neto .num { text-align: right; }
    .pago, .nota { font-size: .82em; color: #444; margin-top: 10px; }
  `;

  const body = `
    ${membrete(contexto, plantilla.config.showLogo, logoUrl)}
    <div class="consecutivo">${escaparHtml(contexto.consecutivo)}</div>
    <div class="titulo">${sustituir(plantilla.documento.titulo, vars)}</div>
    ${cuerpo}
    <div class="despedida">${sustituir(plantilla.documento.despedida, vars)}</div>
    ${verificacion}
  `;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">`
    + `<title>${sustituir(plantilla.documento.titulo, vars)}</title>`
    + `<style>${buildCSS(plantilla.config)}${cssExtra}</style></head><body>${body}</body></html>`;

  return { html, variables: { ...vars, 'periodo.nombre': datos.periodo_nombre } };
}

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
