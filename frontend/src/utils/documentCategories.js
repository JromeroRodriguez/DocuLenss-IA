/**
 * Utilidades para inferir la categoría y tipo de documento
 * basándose en la descripción del modelo de visión IA y el OCR.
 */

export function getDocumentCategory(description, pageNumber) {
  if (!description) {
    return {
      category: pageNumber ? `Pág. ${pageNumber}` : 'Documento',
      type: 'document',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      label: 'Documento',
    };
  }

  const lower = description.toLowerCase();

  // 1. Cédulas y documentos de identidad
  if (
    lower.includes('cédula') ||
    lower.includes('cedula') ||
    lower.includes('ciudadanía') ||
    lower.includes('ciudadania') ||
    lower.includes('identificación') ||
    lower.includes('identificacion') ||
    lower.includes('república de colombia') ||
    lower.includes('republica de colombia') ||
    lower.includes('tarjeta de identidad') ||
    lower.includes('identidad')
  ) {
    return {
      category: 'Cédula',
      type: 'idcard',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
      label: 'Cédula de Ciudadanía',
    };
  }

  // 2. Facturas, recibos y cuentas
  if (
    lower.includes('factura') ||
    lower.includes('recibo') ||
    lower.includes('cuenta de cobro') ||
    lower.includes('subtotal') ||
    (lower.includes('total') && (lower.includes('$') || lower.includes('cop') || lower.includes('precio') || lower.includes('iva')))
  ) {
    return {
      category: 'Factura',
      type: 'receipt',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
      label: 'Factura / Recibo',
    };
  }

  // 3. Órdenes médicas, fórmulas, recetas y medicamentos
  if (
    lower.includes('fórmula') ||
    lower.includes('formula') ||
    lower.includes('médica') ||
    lower.includes('medica') ||
    lower.includes('receta') ||
    lower.includes('orden médica') ||
    lower.includes('prescripción') ||
    lower.includes('prescripcion') ||
    lower.includes('medicamento') ||
    lower.includes('diagnóstico') ||
    lower.includes('diagnostico') ||
    lower.includes('dosis') ||
    lower.includes('paciente')
  ) {
    return {
      category: 'Orden Médica',
      type: 'clipboard',
      badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/80',
      label: 'Orden Médica / Receta',
    };
  }

  // 4. Reverso de documentos o huellas dactilares
  if (
    lower.includes('reverso') ||
    lower.includes('huella') ||
    lower.includes('código de barras') ||
    lower.includes('codigo de barras')
  ) {
    return {
      category: 'Reverso',
      type: 'refresh',
      badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80',
      label: 'Reverso / Huella',
    };
  }

  return {
    category: pageNumber ? `Pág. ${pageNumber}` : 'Página',
    type: 'image',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    label: `Página ${pageNumber || ''}`,
  };
}
