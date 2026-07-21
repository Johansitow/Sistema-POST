/**
 * catalogo.ts — tipos de documento laboral y sus plantillas por defecto.
 *
 * Los documentos reutilizan el modelo PlantillaImpresion que ya existía para
 * tickets y facturas (mismo scoping por grupo/sede, mismo es_default, mismo
 * CRUD). Lo único nuevo es la familia de tipos `documento_*` y una estructura
 * de plantilla con párrafos de texto en lugar de secciones de ítems.
 *
 * Este catálogo actúa como respaldo: si un grupo no ha creado su propia
 * plantilla, se emite con la de aquí. Así el módulo funciona desde el primer
 * día sin obligar a correr un seed.
 *
 * NOTA sobre el desprendible de pago: no está en esta lista a propósito. Un
 * comprobante de pago debe reflejar una liquidación REAL (devengados,
 * deducciones, días trabajados, novedades), y ese modelo llega con el módulo
 * de nómina. Emitir hoy un documento que afirme "se pagó X" sin un pago
 * registrado sería fabricar un registro contable.
 */

export const TIPOS_DOCUMENTO = [
  'documento_certificado_laboral',
  'documento_carta_terminacion',
  'documento_paz_y_salvo',
  'documento_acta_dotacion',
  'documento_desprendible_pago',
] as const;

export type TipoDocumento = typeof TIPOS_DOCUMENTO[number];

/** Configuración de un documento dentro del campo `plantilla` (JSON en BD). */
export interface DocumentoConfig {
  config: {
    paperWidth: string;
    fontSize:   string;
    showLogo:   boolean;
  };
  documento: {
    titulo:        string;
    /** Párrafos del cuerpo; admiten variables {{...}}. */
    cuerpo:        string[];
    despedida:     string;
    /** Días de validez del documento; 0 = sin vencimiento. */
    vigencia_dias: number;
    mostrar_qr:    boolean;
    firma: {
      mostrar: boolean;
      nombre:  string;
      cargo:   string;
    };
  };
}

export interface TipoDocumentoMeta {
  tipo:        TipoDocumento;
  nombre:      string;
  descripcion: string;
  /** Prefijo del consecutivo: CL-2026-0001 */
  prefijo:     string;
  /** Si true, solo puede emitirse a empleados con estado_laboral = retirado. */
  requiereRetiro: boolean;
  /**
   * Si true, necesita un periodo de nómina liquidado: no se arma con párrafos
   * sino con las líneas reales de la liquidación.
   */
  requierePeriodo?: boolean;
  plantilla:   DocumentoConfig;
}

const CONFIG_A4 = { paperWidth: 'A4', fontSize: 'medium', showLogo: true };

const FIRMA_DEFAULT = {
  mostrar: true,
  nombre:  '',                    // vacío = se resuelve con el representante legal configurado
  cargo:   'Representante Legal',
};

export const CATALOGO_DOCUMENTOS: Record<TipoDocumento, TipoDocumentoMeta> = {

  documento_certificado_laboral: {
    tipo:        'documento_certificado_laboral',
    nombre:      'Certificado laboral',
    descripcion: 'Certifica el vínculo, el cargo, la fecha de ingreso y opcionalmente el salario. Es el documento que piden bancos y embajadas.',
    prefijo:     'CL',
    requiereRetiro: false,
    plantilla: {
      config: CONFIG_A4,
      documento: {
        titulo: 'CERTIFICACIÓN LABORAL',
        cuerpo: [
          'El suscrito {{firma.cargo}} de {{empresa.nombre}}, identificada con NIT {{empresa.nit}},',
          'CERTIFICA QUE:',
          '{{empleado.nombre}}, identificado(a) con {{empleado.tipo_documento}} No. {{empleado.documento}}, labora en esta empresa desde el {{empleado.fecha_ingreso_texto}}, desempeñando el cargo de {{empleado.cargo}}, mediante contrato a {{empleado.tipo_contrato}} en jornada de {{empleado.jornada}}.',
          'Su asignación salarial actual es de {{empleado.salario}} ({{empleado.salario_letras}}), pagaderos de forma {{empleado.frecuencia_pago}}.',
        ],
        despedida: 'La presente certificación se expide a solicitud del interesado(a) en {{empresa.ciudad}}, el {{documento.fecha_texto}}.',
        vigencia_dias: 30,
        mostrar_qr:    true,
        firma: FIRMA_DEFAULT,
      },
    },
  },

  documento_carta_terminacion: {
    tipo:        'documento_carta_terminacion',
    nombre:      'Carta de terminación de contrato',
    descripcion: 'Formaliza la terminación del vínculo laboral, con su fecha y motivo. Solo puede emitirse a empleados retirados.',
    prefijo:     'CT',
    requiereRetiro: true,
    plantilla: {
      config: CONFIG_A4,
      documento: {
        titulo: 'TERMINACIÓN DE CONTRATO DE TRABAJO',
        cuerpo: [
          'Señor(a) {{empleado.nombre}}',
          '{{empleado.tipo_documento}} No. {{empleado.documento}}',
          'Por medio de la presente le comunicamos que {{empresa.nombre}}, identificada con NIT {{empresa.nit}}, da por terminado el contrato de trabajo suscrito con usted el {{empleado.fecha_ingreso_texto}}, con efectividad a partir del {{empleado.fecha_retiro_texto}}.',
          'Motivo de la terminación: {{empleado.motivo_retiro}}.',
          'Su tiempo de servicio fue de {{empleado.antiguedad}}, desempeñando el cargo de {{empleado.cargo}}.',
          'La liquidación de sus prestaciones sociales le será entregada conforme a los términos de ley.',
        ],
        despedida: 'Dada en {{empresa.ciudad}}, el {{documento.fecha_texto}}.',
        vigencia_dias: 0,
        mostrar_qr:    true,
        firma: FIRMA_DEFAULT,
      },
    },
  },

  documento_paz_y_salvo: {
    tipo:        'documento_paz_y_salvo',
    nombre:      'Paz y salvo',
    descripcion: 'Hace constar que el empleado no tiene obligaciones pendientes con la empresa al momento de su retiro.',
    prefijo:     'PS',
    requiereRetiro: true,
    plantilla: {
      config: CONFIG_A4,
      documento: {
        titulo: 'PAZ Y SALVO',
        cuerpo: [
          '{{empresa.nombre}}, identificada con NIT {{empresa.nit}},',
          'HACE CONSTAR QUE:',
          '{{empleado.nombre}}, identificado(a) con {{empleado.tipo_documento}} No. {{empleado.documento}}, quien se desempeñó como {{empleado.cargo}} entre el {{empleado.fecha_ingreso_texto}} y el {{empleado.fecha_retiro_texto}}, se encuentra a PAZ Y SALVO por todo concepto con esta empresa.',
          'Lo anterior incluye la devolución de los elementos de trabajo, uniformes y dotación entregados durante su vinculación.',
        ],
        despedida: 'Se expide en {{empresa.ciudad}}, el {{documento.fecha_texto}}.',
        vigencia_dias: 0,
        mostrar_qr:    true,
        firma: FIRMA_DEFAULT,
      },
    },
  },

  documento_desprendible_pago: {
    tipo:        'documento_desprendible_pago',
    nombre:      'Desprendible de pago',
    descripcion: 'Comprobante de nómina con los devengados y las deducciones del periodo. Requiere un periodo de nómina liquidado.',
    prefijo:     'DP',
    requiereRetiro: false,
    requierePeriodo: true,
    plantilla: {
      config: CONFIG_A4,
      documento: {
        titulo: 'COMPROBANTE DE NÓMINA',
        // El cuerpo de este documento no son párrafos: es la tabla de conceptos
        // de la liquidación, que arma renderizarDesprendible().
        cuerpo: [],
        despedida: 'Este comprobante se genera a partir de la liquidación del periodo y no requiere firma autógrafa.',
        vigencia_dias: 0,
        mostrar_qr:    true,
        firma: { mostrar: false, nombre: '', cargo: '' },
      },
    },
  },

  documento_acta_dotacion: {
    tipo:        'documento_acta_dotacion',
    nombre:      'Acta de entrega de dotación',
    descripcion: 'Deja constancia de la entrega de uniformes y calzado. En Colombia la dotación es obligatoria tres veces al año para quienes ganan hasta dos salarios mínimos.',
    prefijo:     'AD',
    requiereRetiro: false,
    plantilla: {
      config: CONFIG_A4,
      documento: {
        titulo: 'ACTA DE ENTREGA DE DOTACIÓN',
        cuerpo: [
          'En {{empresa.ciudad}}, el {{documento.fecha_texto}}, {{empresa.nombre}} hace entrega de la dotación de labor a:',
          '{{empleado.nombre}}, identificado(a) con {{empleado.tipo_documento}} No. {{empleado.documento}}, quien desempeña el cargo de {{empleado.cargo}}.',
          'Elementos entregados:',
          '{{documento.observaciones}}',
          'El trabajador se compromete a usar la dotación en el desempeño de sus funciones y a devolverla al terminar el contrato, salvo el desgaste natural por su uso.',
        ],
        despedida: 'En constancia se firma por las partes.',
        vigencia_dias: 0,
        mostrar_qr:    true,
        firma: { mostrar: true, nombre: '', cargo: 'Representante Legal' },
      },
    },
  },
};

export const esTipoDocumento = (tipo: string): tipo is TipoDocumento =>
  (TIPOS_DOCUMENTO as readonly string[]).includes(tipo);
