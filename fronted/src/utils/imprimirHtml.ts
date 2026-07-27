/**
 * imprimirHtml — abre un HTML autocontenido en una ventana y lanza la impresión.
 *
 * Los documentos laborales (certificado, desprendible) se generan como HTML
 * completo en el backend; para imprimirlos/guardarlos como PDF basta abrirlos en
 * una ventana y llamar a window.print(). Se comparte entre la emisión del admin
 * (TabDocumentos) y el autoservicio del trabajador (Perfil).
 *
 * Devuelve false si el navegador bloqueó la ventana emergente.
 */
export function imprimirHtml(html: string): boolean {
  const win = window.open('', '_blank', 'width=860,height=1000');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  // El load garantiza que el CSS y el QR estén pintados antes de imprimir.
  win.onload = () => { win.focus(); win.print(); };
  return true;
}
