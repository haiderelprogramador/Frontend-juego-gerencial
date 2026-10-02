import {
  FinancieroEntrada,
  aplicarImpacto,
  driversConPorcentajeInvalido,
  impactoANumeros,
  impactoDesdeApi,
  impactoVacio,
  previsualizarImpacto,
  aNumero,
  calcularFinanciero,
  camposConSignoInvalido,
  financieroDesdeApi,
  financieroEstaVacio,
  financieroVacio,
} from './financiero.model';

/** Balance que cuadra: activo 1.550.000 = pasivo 700.000 + patrimonio 850.000. */
const CUADRADO: FinancieroEntrada = {
  efectivo: 200000,
  cuentasPorCobrar: 150000,
  inventarios: 250000,
  propiedadPlantaEquipo: 900000,
  activosIntangibles: 50000,
  cuentasPorPagar: 180000,
  obligacionesFinancierasCortoPlazo: 120000,
  obligacionesFinancierasLargoPlazo: 400000,
  capitalSocial: 600000,
  utilidadesRetenidas: 120000,
  ventasNetas: 1200000,
  costoVentas: 700000,
  gastosAdministracion: 150000,
  gastosVentas: 100000,
  gastosFinancieros: 50000,
  impuestoRenta: 70000,
  flujoOperativo: 180000,
  flujoInversion: -80000,
  flujoFinanciacion: -50000,
};

describe('financiero.model', () => {
  it('calcula subtotales y totales del balance, resultados y flujo', () => {
    const { totales } = calcularFinanciero(CUADRADO);
    expect(totales).toEqual({
      activoCorriente: 600000,
      activoNoCorriente: 950000,
      activoTotal: 1550000,
      pasivoCorriente: 300000,
      pasivoNoCorriente: 400000,
      pasivoTotal: 700000,
      utilidadBruta: 500000,
      utilidadOperativa: 250000,
      utilidadAntesImpuestos: 200000,
      utilidadNeta: 130000,
      patrimonio: 850000, // capital + retenidas + utilidad neta del período
      efectivoFinal: 250000,
    });
  });

  it('el descuadre es 0 cuando activo = pasivo + patrimonio, y la diferencia exacta si no', () => {
    expect(calcularFinanciero(CUADRADO).descuadre).toBe(0);
    expect(calcularFinanciero({ ...CUADRADO, efectivo: 230000 }).descuadre).toBe(30000);
    // Un gasto más baja la utilidad → baja el patrimonio → el activo queda por encima.
    expect(calcularFinanciero({ ...CUADRADO, gastosVentas: 110000 }).descuadre).toBe(10000);
  });

  it('calcula los indicadores', () => {
    const { indicadores } = calcularFinanciero(CUADRADO);
    expect(indicadores.razonCorriente).toBeCloseTo(2);
    expect(indicadores.pruebaAcida).toBeCloseTo(350000 / 300000);
    expect(indicadores.endeudamiento).toBeCloseTo(700000 / 1550000);
    expect(indicadores.margenNeto).toBeCloseTo(130000 / 1200000);
    expect(indicadores.roe).toBeCloseTo(130000 / 850000);
    expect(indicadores.roa).toBeCloseTo(130000 / 1550000);
  });

  it('un indicador con denominador 0 es null, no Infinity/NaN', () => {
    const { indicadores } = calcularFinanciero({ ...CUADRADO, cuentasPorPagar: 0, obligacionesFinancierasCortoPlazo: 0, ventasNetas: 0 });
    expect(indicadores.razonCorriente).toBeNull();
    expect(indicadores.pruebaAcida).toBeNull();
    expect(indicadores.margenNeto).toBeNull();
  });

  it('solo utilidades retenidas y los 3 flujos admiten negativo', () => {
    const conNegativos = {
      ...CUADRADO,
      utilidadesRetenidas: -1,
      flujoOperativo: -1,
      flujoFinanciacion: -1,
      inventarios: -1,
      gastosFinancieros: -1,
    };
    expect(camposConSignoInvalido(conNegativos)).toEqual(['inventarios', 'gastosFinancieros']);
    expect(camposConSignoInvalido(CUADRADO)).toEqual([]);
  });

  it('las partidas en null (casos viejos) quedan como campo vacío, no "null"', () => {
    const texto = financieroDesdeApi({ efectivo: null, inventarios: 250000 });
    expect(texto.efectivo).toBe('');
    expect(texto.inventarios).toBe('250000');
    expect(texto.ventasNetas).toBe('');
    expect(financieroEstaVacio(financieroDesdeApi(undefined))).toBe(true);
    expect(financieroEstaVacio(financieroVacio())).toBe(true);
  });

  it('convierte texto en formato latino a número', () => {
    expect(aNumero('$1.850.000')).toBe(1850000);
    expect(aNumero('-80.000,5')).toBe(-80000.5);
    expect(aNumero('')).toBe(0);
  });

  describe('impacto de una opción', () => {
    it('aplica % sobre el valor base y monto fijo como suma; un driver ausente no cambia', () => {
      const despues = aplicarImpacto(CUADRADO, {
        ventasNetas: { tipo: 'porcentaje', valor: 10 },
        costoVentas: { tipo: 'monto', valor: 50000 },
        gastosVentas: { tipo: 'porcentaje', valor: -100 },
      });
      expect(despues.ventasNetas).toBeCloseTo(1320000);
      expect(despues.costoVentas).toBe(750000);
      expect(despues.gastosVentas).toBe(0);
      expect(despues.gastosAdministracion).toBe(CUADRADO.gastosAdministracion);
      expect(despues.efectivo).toBe(CUADRADO.efectivo);
    });

    it('la vista previa mueve utilidad neta, patrimonio y efectivo por el mismo delta', () => {
      const previa = previsualizarImpacto(CUADRADO, {
        ventasNetas: { tipo: 'porcentaje', valor: 10 }, // +120.000
        costoVentas: { tipo: 'monto', valor: 50000 }, // −50.000 de utilidad
      });
      expect(previa.utilidadNetaAntes).toBe(130000);
      expect(previa.utilidadNetaDespues).toBeCloseTo(200000);
      expect(previa.patrimonioAntes).toBe(850000);
      expect(previa.patrimonioDespues).toBeCloseTo(920000);
      expect(previa.efectivoAntes).toBe(200000);
      expect(previa.efectivoDespues).toBeCloseTo(270000);
      // Activo y patrimonio suben lo mismo → el balance sigue cuadrando.
      expect(previa.efectivoDespues - previa.efectivoAntes).toBeCloseTo(
        previa.patrimonioDespues - previa.patrimonioAntes,
      );
    });

    it('sin drivers declarados la vista previa no cambia nada', () => {
      const previa = previsualizarImpacto(CUADRADO, {});
      expect(previa.utilidadNetaDespues).toBe(previa.utilidadNetaAntes);
      expect(previa.efectivoDespues).toBe(previa.efectivoAntes);
    });

    it('solo manda los drivers con valor escrito', () => {
      const texto = impactoVacio();
      texto.ventasNetas = { tipo: 'porcentaje', valor: '12,5' };
      texto.impuestoRenta = { tipo: 'monto', valor: '-20.000' };
      expect(impactoANumeros(texto)).toEqual({
        ventasNetas: { tipo: 'porcentaje', valor: 12.5 },
        impuestoRenta: { tipo: 'monto', valor: -20000 },
      });
    });

    it('un % menor a -100 es inválido; -100 exacto y un monto negativo grande no', () => {
      expect(
        driversConPorcentajeInvalido({
          ventasNetas: { tipo: 'porcentaje', valor: -100.5 },
          costoVentas: { tipo: 'porcentaje', valor: -100 },
          gastosVentas: { tipo: 'monto', valor: -999999 },
        }),
      ).toEqual(['ventasNetas']);
    });

    it('al cargar desde el backend ignora un tipo desconocido y los null', () => {
      const texto = impactoDesdeApi({
        ventasNetas: { tipo: 'porcentaje', valor: 5 },
        costoVentas: { tipo: 'otro' as never, valor: 5 },
      });
      expect(texto.ventasNetas).toEqual({ tipo: 'porcentaje', valor: '5' });
      expect(texto.costoVentas.valor).toBe('');
      expect(impactoDesdeApi(null)).toEqual(impactoVacio());
    });
  });
});
