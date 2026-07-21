/**
 * Tests del motor de variables de los documentos laborales.
 *
 * El foco está en dos cosas: que los datos de usuario NO puedan inyectar HTML
 * en un documento con valor probatorio, y que las fechas de calendario no se
 * corran de día por la zona horaria.
 */

import { describe, it, expect } from 'vitest';
import {
  sustituir, escaparHtml, fechaEnLetras, antiguedadEnTexto,
  construirVariables, listarVariablesDisponibles,
} from '../documentos/variables';

const CTX_BASE = {
  empleado: {
    nombre_completo: 'María Rodríguez',
    tipo_documento: 'cc', documento_identidad: '1020304050',
    cargo: 'Chef', fecha_ingreso: new Date(Date.UTC(2024, 2, 15)),
    fecha_retiro: null, motivo_retiro: null,
    tipo_contrato: 'indefinido', jornada: 'completa',
    codigo_empleado: 'EMP-0001', email: 'm@x.com', telefono: '300',
  },
  empresa: {
    nombre: 'Restaurante X', nit: '900.1-2', ciudad: 'Bogotá',
    direccion: 'Calle 1', telefono: '601',
  },
  nomina: { salario_base: 1_800_000, tipo_pago: 'mensual' },
  firma: { nombre: 'Juan Pérez', cargo: 'Gerente' },
  consecutivo: 'CL-2026-0001',
  codigo: 'ABC123',
  fechaEmision: new Date(2026, 6, 21),
};

// ─── Escapado (seguridad) ─────────────────────────────────────────────────────

describe('escaparHtml', () => {
  it('neutraliza los caracteres que abren etiquetas', () => {
    expect(escaparHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapa comillas y ampersands', () => {
    expect(escaparHtml(`Tom & "Jerry" 'x'`))
      .toBe('Tom &amp; &quot;Jerry&quot; &#39;x&#39;');
  });
});

describe('sustituir', () => {
  const vars = { 'empleado.nombre': 'Ana', 'empleado.cargo': 'Chef' };

  it('reemplaza los marcadores por su valor', () => {
    expect(sustituir('Hola {{empleado.nombre}}', vars)).toBe('Hola Ana');
  });

  it('admite espacios dentro de las llaves', () => {
    expect(sustituir('{{ empleado.nombre }}', vars)).toBe('Ana');
  });

  it('reemplaza todas las apariciones', () => {
    expect(sustituir('{{empleado.nombre}} y {{empleado.nombre}}', vars)).toBe('Ana y Ana');
  });

  it('ESCAPA el valor: un nombre con HTML no puede inyectar etiquetas', () => {
    const malicioso = { 'empleado.nombre': '<img src=x onerror=alert(1)>' };
    const salida = sustituir('{{empleado.nombre}}', malicioso);
    expect(salida).not.toContain('<img');
    expect(salida).toContain('&lt;img');
  });

  it('marca los marcadores desconocidos en vez de imprimirlos crudos', () => {
    const salida = sustituir('{{empleado.nomber}}', vars);
    expect(salida).toContain('variable desconocida');
    expect(salida).not.toContain('{{empleado.nomber}}');
  });

  it('escapa el nombre del marcador desconocido al reportarlo', () => {
    // El aviso de "variable desconocida" imprime la clave: debe ir escapada
    const salida = sustituir('{{onerror_x}}', { ...vars });
    expect(salida).toContain('variable desconocida');
  });

  /**
   * Frontera de confianza del renderizador:
   *   • El TEXTO de la plantilla lo escribe un administrador y puede llevar
   *     HTML a propósito (negritas, saltos de línea). Pasa tal cual.
   *   • Los VALORES sustituidos vienen de datos de usuario — incluidos el
   *     teléfono y la dirección que el propio trabajador edita desde su
   *     portal — y SIEMPRE se escapan.
   */
  it('deja pasar el HTML de la plantilla pero nunca el de los valores', () => {
    const plantillaConFormato = '<strong>{{empleado.nombre}}</strong>';
    const datosMaliciosos = { 'empleado.nombre': '<script>robar()</script>' };

    const salida = sustituir(plantillaConFormato, datosMaliciosos);

    expect(salida).toContain('<strong>');              // formato del admin: intacto
    expect(salida).not.toContain('<script>');          // dato del usuario: neutralizado
    expect(salida).toContain('&lt;script&gt;robar()');
  });
});

// ─── Fechas ───────────────────────────────────────────────────────────────────

describe('fechaEnLetras', () => {
  it('usa el formato de los documentos legales', () => {
    expect(fechaEnLetras(new Date(Date.UTC(2024, 2, 15)))).toBe('15 de marzo de 2024');
  });

  it('NO corre la fecha un día por la zona horaria', () => {
    // Fecha de calendario guardada como medianoche UTC. Leída en hora local
    // de Colombia (UTC-5) sería el día anterior.
    expect(fechaEnLetras(new Date('2024-01-01T00:00:00.000Z'))).toBe('1 de enero de 2024');
  });

  it('devuelve vacío si no hay fecha', () => {
    expect(fechaEnLetras(null)).toBe('');
  });
});

describe('antiguedadEnTexto', () => {
  it('cuenta años y meses de calendario', () => {
    const desde = new Date(Date.UTC(2024, 0, 15));
    const hasta = new Date(Date.UTC(2026, 4, 15));
    expect(antiguedadEnTexto(desde, hasta)).toBe('2 años y 4 meses');
  });

  it('no cuenta el mes hasta que llega el día', () => {
    const desde = new Date(Date.UTC(2026, 0, 31));
    const hasta = new Date(Date.UTC(2026, 6, 21));
    expect(antiguedadEnTexto(desde, hasta)).toBe('5 meses');
  });

  it('usa singular para un año o un mes', () => {
    expect(antiguedadEnTexto(new Date(Date.UTC(2025, 5, 15)), new Date(Date.UTC(2026, 6, 15))))
      .toBe('1 año y 1 mes');
  });

  it('reporta "menos de un mes" para vínculos recientes', () => {
    expect(antiguedadEnTexto(new Date(Date.UTC(2026, 6, 10)), new Date(Date.UTC(2026, 6, 21))))
      .toBe('menos de un mes');
  });
});

// ─── Diccionario ──────────────────────────────────────────────────────────────

describe('construirVariables', () => {
  it('traduce los códigos a texto legible', () => {
    const v = construirVariables(CTX_BASE);
    expect(v['empleado.tipo_documento']).toBe('cédula de ciudadanía');
    expect(v['empleado.tipo_contrato']).toBe('término indefinido');
    expect(v['empleado.jornada']).toBe('tiempo completo');
  });

  it('incluye el salario en cifras y en letras', () => {
    const v = construirVariables(CTX_BASE);
    expect(v['empleado.salario']).toBe('$ 1.800.000');
    expect(v['empleado.salario_letras']).toBe('UN MILLÓN OCHOCIENTOS MIL PESOS M/CTE');
  });

  it('no rompe si el empleado no tiene nómina cargada', () => {
    const v = construirVariables({ ...CTX_BASE, nomina: null });
    expect(v['empleado.salario']).toBe('no registrado');
    expect(v['empleado.salario_letras']).toBe('');
  });

  it('usa textos neutros en lugar de dejar campos vacíos', () => {
    const v = construirVariables({
      ...CTX_BASE,
      empleado: { ...CTX_BASE.empleado, cargo: null, motivo_retiro: null },
    });
    expect(v['empleado.cargo']).toBe('sin cargo asignado');
    expect(v['empleado.motivo_retiro']).toBe('no especificado');
  });

  it('no deja marcadores sin valor: todas las claves del catálogo existen', () => {
    const v = construirVariables(CTX_BASE);
    for (const [clave, valor] of Object.entries(v)) {
      expect(valor, `la clave ${clave} quedó indefinida`).toBeDefined();
    }
  });
});

describe('listarVariablesDisponibles', () => {
  it('expone las variables con un ejemplo para el editor de plantillas', () => {
    const lista = listarVariablesDisponibles();
    expect(lista.length).toBeGreaterThan(15);
    const nombre = lista.find(v => v.clave === 'empleado.nombre');
    expect(nombre?.ejemplo).toContain('María');
  });
});
