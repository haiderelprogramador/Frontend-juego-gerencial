import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, model } from '@angular/core';

import {
  DRIVERS_IMPACTO,
  DriverImpacto,
  ETIQUETAS_FINANCIERO,
  FinancieroEntrada,
  ImpactoTexto,
  TipoImpacto,
  driversConPorcentajeInvalido,
  formatearMoneda,
  impactoANumeros,
  impactoEstaVacio,
  previsualizarImpacto,
} from '../../../simulacion/models/financiero.model';

/**
 * Sección opcional "Impacto financiero" de una opción del caso: hasta 6
 * drivers del estado de resultados, cada uno en % del valor base o monto fijo,
 * y una vista previa en vivo contra la información financiera del caso.
 *
 * La vista previa NO se guarda ni se usa para las decisiones de los
 * estudiantes: solo ayuda al docente a dimensionar el efecto mientras arma el caso.
 */
@Component({
  selector: 'app-impacto-opcion',
  templateUrl: './impacto-opcion.html',
  styleUrl: './impacto-opcion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpactoFinancieroOpcion {
  /** Drivers como texto de formulario (two-way: `[(impacto)]`). */
  readonly impacto = model.required<ImpactoTexto>();
  /** Partidas del caso (pestaña Información Financiera) sobre las que se aplica el impacto. */
  readonly base = input.required<FinancieroEntrada>();
  /** `true` si la pestaña Información Financiera está vacía: la vista previa partiría de 0. */
  readonly baseVacia = input(false);

  readonly drivers = DRIVERS_IMPACTO;
  readonly etiquetas = ETIQUETAS_FINANCIERO;

  readonly vacio = computed(() => impactoEstaVacio(this.impacto()));
  /** Arranca abierta si la opción ya trae impacto; después solo la cambia el docente. */
  readonly abierta = linkedSignal<boolean, boolean>({
    source: () => this.vacio(),
    computation: (vacio, previo) => previo?.value ?? !vacio,
  });
  readonly declarado = computed(() => impactoANumeros(this.impacto()));
  readonly invalidos = computed(() => new Set(driversConPorcentajeInvalido(this.declarado())));
  readonly cantidad = computed(() => Object.keys(this.declarado()).length);
  readonly previa = computed(() => previsualizarImpacto(this.base(), this.declarado()));

  setTipo(driver: DriverImpacto, tipo: TipoImpacto): void {
    this.impacto.update((i) => ({ ...i, [driver]: { ...i[driver], tipo } }));
  }

  setValor(driver: DriverImpacto, valor: string): void {
    this.impacto.update((i) => ({ ...i, [driver]: { ...i[driver], valor } }));
  }

  moneda(n: number): string {
    return formatearMoneda(n);
  }
}
