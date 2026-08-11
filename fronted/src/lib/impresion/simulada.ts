/**
 * simulada.ts — Driver de impresión sin hardware (dev / sin impresora).
 * "Imprime" descargando el archivo .escpos (bytes crudos) para inspección o
 * envío manual a una impresora real luego. Permite validar el flujo end-to-end.
 */

export const impresoraSimulada = {
  async disponible(): Promise<boolean> {
    return false; // no es una impresora real
  },

  async listarImpresoras(): Promise<string[]> {
    return [];
  },

  async imprimir(bytes: Uint8Array, _printer?: string): Promise<void> {
    const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${Date.now()}.escpos`;
    a.click();
    URL.revokeObjectURL(url);
    // eslint-disable-next-line no-console
    console.info(`[impresion:sim] ${bytes.length} bytes ESC/POS (descargado)`);
  },
};
