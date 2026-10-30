import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  NgZone,
  inject,
  booleanAttribute,
  numberAttribute,
} from '@angular/core';

/**
 * Directiva Angular de Vidrio Líquido (Liquid Glass Refraction with CSS & SVG)
 * Basada en la física óptica de Chris Feijoo (kube.io / "Liquid Glass in the Browser"):
 * 1. Perfil de superficie Convex Squircle: y = (1 - (1 - x)^4)^(1/4).
 * 2. Trazado de rayos 1D mediante la Ley de Snell-Descartes (n1 = 1.0 aire, n2 = 1.5 vidrio).
 * 3. Mapa de desplazamiento 2D (R = eje X, G = eje Y, 128 = neutro sin distorsión en el centro).
 * 4. Mapa de brillo especular perimetral (ángulo de luz -60°) combinado con saturación óptica
 *    en el borde mediante <feColorMatrix type="saturate"> y <feComposite operator="in">.
 */
@Directive({
  selector: '[appLiquidGlass]',
  standalone: true,
})
export class LiquidGlassDirective implements OnInit, OnChanges, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  /** Radio de curvatura del elemento en px */
  @Input({ transform: numberAttribute }) radius = 24;

  /** Ancho del bisel refractivo (bezelWidth) en px */
  @Input({ transform: numberAttribute }) rimThickness = 18;

  /** Escala / nivel de refracción óptica */
  @Input({ transform: numberAttribute }) scale = 24;

  /** Desenfoque base en px (0.2 para lente de cristal puro como el Slider/Switch del video, 3.5 para tarjetas) */
  @Input({ transform: numberAttribute }) blur = 3.5;

  /** Opacidad del reflejo especular perimetral (0.4 por defecto en el video) */
  @Input({ transform: numberAttribute }) specularOpacity = 0.42;

  /** Saturación cromática en el bisel especular (6 por defecto en el video) */
  @Input({ transform: numberAttribute }) specularSaturation = 6;

  /**
   * Permite activar/desactivar el filtro SVG pesado bajo demanda (ej. solo mientras la píldora se desliza).
   * Cuando es `false`, libera a la GPU del filtro SVG de 9 pasos en estado de reposo.
   */
  @Input({ transform: booleanAttribute }) active = true;

  /** Compatibilidad con inputs existentes */
  @Input({ transform: booleanAttribute }) chromatic = true;
  @Input({ transform: booleanAttribute }) interactive = false;

  /** Caché estática de texturas ópticas por dimensiones para evitar recalcular `toDataURL` en cada cambio de tab */
  private static readonly mapCache = new Map<
    string,
    { displacementUrl: string; specularUrl: string; maxDisplacement: number }
  >();

  private readonly filterId = `glass-lens-${Math.random().toString(36).slice(2, 9)}`;
  private svgElement: SVGSVGElement | null = null;
  private feDisplaceEl: Element | null = null;
  private maxCalculatedDisplacement = 30;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastRadius = -1;
  private lastRim = -1;
  private lastBlur = -1;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private isChromium = false;
  private initialized = false;

  ngOnInit(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.checkBrowserSupport();
    this.setupElementBaseStyle();
    this.initialized = true;
    this.buildAndApplyLiquidLens();

    this.setupResizeObserver();
  }

  ngOnChanges(): void {
    if (!this.initialized) return;
    this.buildAndApplyLiquidLens();
  }

  ngOnDestroy(): void {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    this.resizeObserver?.disconnect();
    this.cleanupSvg();
  }

  private checkBrowserSupport(): void {
    const hasBackdrop =
      typeof CSS !== 'undefined' &&
      (CSS.supports('backdrop-filter', 'blur(10px)') ||
        CSS.supports('-webkit-backdrop-filter', 'blur(10px)'));
    const userAgent = navigator.userAgent;
    this.isChromium =
      hasBackdrop &&
      (!!(window as unknown as { chrome?: unknown }).chrome ||
        userAgent.includes('Chrome') ||
        userAgent.includes('Edg'));
  }

  private setupElementBaseStyle(): void {
    const el = this.el.nativeElement;
    el.classList.add('liquid-glass-lens');
  }

  private buildAndApplyLiquidLens(): void {
    const el = this.el.nativeElement;
    const rect = el.getBoundingClientRect();
    const width = Math.max(Math.round(el.offsetWidth || rect.width || 180), 32);
    const height = Math.max(Math.round(el.offsetHeight || rect.height || 38), 24);

    // Si solo cambió `scale` o `active` (por ejemplo al animar la transición), actualizamos
    // en el lugar sin reconstruir los mapas en canvas ni el nodo SVG.
    if (
      this.svgElement &&
      width === this.lastWidth &&
      height === this.lastHeight &&
      this.radius === this.lastRadius &&
      this.rimThickness === this.lastRim &&
      this.blur === this.lastBlur
    ) {
      this.updateScaleInPlace();
      this.applyBackdropFilterStyle(el);
      return;
    }

    const cacheKey = `${width}x${height}_r${this.radius}_b${this.rimThickness}`;
    let maps = LiquidGlassDirective.mapCache.get(cacheKey) ?? null;
    if (!maps) {
      maps = this.generateSnellAndSpecularMaps(width, height, this.radius, this.rimThickness);
      if (!maps) return;
      if (LiquidGlassDirective.mapCache.size > 24) {
        const firstKey = LiquidGlassDirective.mapCache.keys().next().value;
        if (firstKey) LiquidGlassDirective.mapCache.delete(firstKey);
      }
      LiquidGlassDirective.mapCache.set(cacheKey, maps);
    }

    this.lastWidth = width;
    this.lastHeight = height;
    this.lastRadius = this.radius;
    this.lastRim = this.rimThickness;
    this.lastBlur = this.blur;
    this.maxCalculatedDisplacement = maps.maxDisplacement;

    this.injectSvgFilter(maps.displacementUrl, maps.specularUrl, width, height);
    this.applyBackdropFilterStyle(el);
  }

  private applyBackdropFilterStyle(el: HTMLElement): void {
    if (!this.isChromium) return;
    const filterCss = this.active ? `url(#${this.filterId})` : 'none';
    el.style.backdropFilter = filterCss;
    (el.style as unknown as Record<string, string>)['webkitBackdropFilter'] = filterCss;
  }

  private updateScaleInPlace(): void {
    const scaleRatio = Math.max(0, this.scale) / 24;
    const effectiveScale = this.maxCalculatedDisplacement * scaleRatio;
    this.feDisplaceEl?.setAttribute('scale', effectiveScale.toFixed(2));
  }

  /**
   * Filtro SVG exacto de Chris Feijoo (kube.io/blog/liquid-glass-css-svg):
   * 1. feGaussianBlur (blurred_source)
   * 2. feImage (displacement_map) + feDisplacementMap (displaced)
   * 3. feColorMatrix type="saturate" (displaced_saturated)
   * 4. feImage (specular_layer) + feComposite operator="in" (specular_saturated)
   * 5. feComponentTransfer feFuncA slope (specular_faded)
   * 6. feBlend specular_saturated over displaced -> feBlend specular_faded over withSaturation
   */
  private injectSvgFilter(
    displacementMapUrl: string,
    specularMapUrl: string,
    width: number,
    height: number
  ): void {
    this.cleanupSvg();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('color-interpolation-filters', 'sRGB');
    svg.setAttribute('style', 'display: none; position: absolute; width: 0; height: 0; pointer-events: none;');
    svg.setAttribute('aria-hidden', 'true');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', this.filterId);
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    // 1. Desenfoque base (solo se agrega al grafo SVG si blur > 0; para lentes puras evita un pase extra de GPU)
    let sourceInput = 'SourceGraphic';
    if (this.blur > 0) {
      const feBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      feBlur.setAttribute('in', 'SourceGraphic');
      feBlur.setAttribute('stdDeviation', this.blur.toString());
      feBlur.setAttribute('result', 'blurred_source');
      filter.appendChild(feBlur);
      sourceInput = 'blurred_source';
    }

    // 2. Mapa de desplazamiento físico (Ley de Snell)
    const feDispImg = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
    feDispImg.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', displacementMapUrl);
    feDispImg.setAttribute('href', displacementMapUrl);
    feDispImg.setAttribute('x', '0');
    feDispImg.setAttribute('y', '0');
    feDispImg.setAttribute('width', width.toString());
    feDispImg.setAttribute('height', height.toString());
    feDispImg.setAttribute('preserveAspectRatio', 'none');
    feDispImg.setAttribute('result', 'displacement_map');
    filter.appendChild(feDispImg);

    // 3. Desplazamiento de rayos refractados
    const scaleRatio = Math.max(0, this.scale) / 24;
    const effectiveScale = this.maxCalculatedDisplacement * scaleRatio;
    const feDisplace = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    feDisplace.setAttribute('in', sourceInput);
    feDisplace.setAttribute('in2', 'displacement_map');
    feDisplace.setAttribute('scale', effectiveScale.toFixed(2));
    feDisplace.setAttribute('xChannelSelector', 'R');
    feDisplace.setAttribute('yChannelSelector', 'G');
    feDisplace.setAttribute('result', 'displaced');
    filter.appendChild(feDisplace);
    this.feDisplaceEl = feDisplace;

    // 4. Saturación cromática intensa para el borde del cristal
    const satValue = this.chromatic ? this.specularSaturation : 1;
    const feSaturate = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    feSaturate.setAttribute('in', 'displaced');
    feSaturate.setAttribute('type', 'saturate');
    feSaturate.setAttribute('values', satValue.toString());
    feSaturate.setAttribute('result', 'displaced_saturated');
    filter.appendChild(feSaturate);

    // 5. Mapa especular perimetral
    const feSpecImg = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
    feSpecImg.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', specularMapUrl);
    feSpecImg.setAttribute('href', specularMapUrl);
    feSpecImg.setAttribute('x', '0');
    feSpecImg.setAttribute('y', '0');
    feSpecImg.setAttribute('width', width.toString());
    feSpecImg.setAttribute('height', height.toString());
    feSpecImg.setAttribute('preserveAspectRatio', 'none');
    feSpecImg.setAttribute('result', 'specular_layer');
    filter.appendChild(feSpecImg);

    // 6. Recortar la refracción saturada únicamente al bisel especular
    const feCompSpec = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
    feCompSpec.setAttribute('in', 'displaced_saturated');
    feCompSpec.setAttribute('in2', 'specular_layer');
    feCompSpec.setAttribute('operator', 'in');
    feCompSpec.setAttribute('result', 'specular_saturated');
    filter.appendChild(feCompSpec);

    // 7. Control de opacidad del brillo especular del borde
    const feTransfer = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
    feTransfer.setAttribute('in', 'specular_layer');
    feTransfer.setAttribute('result', 'specular_faded');
    const feFuncA = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncA');
    feFuncA.setAttribute('type', 'linear');
    feFuncA.setAttribute('slope', this.specularOpacity.toString());
    feTransfer.appendChild(feFuncA);
    filter.appendChild(feTransfer);

    // 8. Mezclar la refracción cromática del borde sobre la imagen refractada
    const feBlendSat = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend');
    feBlendSat.setAttribute('in', 'specular_saturated');
    feBlendSat.setAttribute('in2', 'displaced');
    feBlendSat.setAttribute('mode', 'normal');
    feBlendSat.setAttribute('result', 'withSaturation');
    filter.appendChild(feBlendSat);

    // 9. Mezclar el brillo de luz especular sobre el borde
    const feBlendSpec = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend');
    feBlendSpec.setAttribute('in', 'specular_faded');
    feBlendSpec.setAttribute('in2', 'withSaturation');
    feBlendSpec.setAttribute('mode', 'normal');
    filter.appendChild(feBlendSpec);

    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);
    this.svgElement = svg;
  }

  private cleanupSvg(): void {
    this.feDisplaceEl = null;
    if (this.svgElement && this.svgElement.parentNode) {
      this.svgElement.parentNode.removeChild(this.svgElement);
      this.svgElement = null;
    }
  }

  /**
   * Ecuación de superficie Convex Squircle de Apple (usada en el video de Chris Feijoo):
   * y = (1 - (1 - x)^4)^(1/4)
   */
  private convexSquircle(x: number): number {
    const clamped = Math.max(0, Math.min(1, x));
    return Math.pow(1 - Math.pow(1 - clamped, 4), 0.25);
  }

  /**
   * Simulación de 128 rayos mediante la Ley de Snell-Descartes (función `Zt` del video):
   * n1 * sin(theta1) = n2 * sin(theta2), con n1 = 1.0 (aire) y n2 = 1.5 (vidrio).
   */
  private computeSnellProfile(
    glassThickness: number,
    bezelWidth: number,
    refractiveIndex = 1.5,
    samples = 128
  ): number[] {
    const eta = 1 / refractiveIndex;
    const refract = (normalX: number, normalY: number): [number, number] | null => {
      const cosI = normalY;
      const k = 1 - eta * eta * (1 - cosI * cosI);
      if (k < 0) return null;
      const sq = Math.sqrt(k);
      return [-(eta * cosI + sq) * normalX, eta - (eta * cosI + sq) * normalY];
    };

    return Array.from({ length: samples }, (_, i) => {
      const x = i / samples;
      const y = this.convexSquircle(x);
      const dx = x < 1 ? 1e-4 : -1e-4;
      const derivative = (this.convexSquircle(x + dx) - y) / dx;
      const mag = Math.sqrt(derivative * derivative + 1);
      const normalX = -derivative / mag;
      const normalY = -1 / mag;
      const refracted = refract(normalX, normalY);
      if (refracted) {
        const heightAtPoint = y * bezelWidth + glassThickness;
        return refracted[0] * (heightAtPoint / refracted[1]);
      }
      return 0;
    });
  }

  /**
   * Genera tanto el Mapa de Desplazamiento (`Qt`) como el Mapa Especular (`Yr`) del video.
   */
  private generateSnellAndSpecularMaps(
    width: number,
    height: number,
    radius: number,
    bezel: number
  ): { displacementUrl: string; specularUrl: string; maxDisplacement: number } | null {
    const dispCanvas = document.createElement('canvas');
    dispCanvas.width = width;
    dispCanvas.height = height;
    const dispCtx = dispCanvas.getContext('2d');
    if (!dispCtx) return null;

    const specCanvas = document.createElement('canvas');
    specCanvas.width = width;
    specCanvas.height = height;
    const specCtx = specCanvas.getContext('2d');
    if (!specCtx) return null;

    const maxR = Math.min(width, height) / 2;
    const r = Math.min(radius, maxR);
    const bWidth = Math.max(2, Math.min(bezel, r));

    // Grosor óptico del cristal proporcional al bisel (como en los componentes UI del video)
    const glassThickness = Math.max(28, bWidth * 2.2);
    const profile = this.computeSnellProfile(glassThickness, bWidth, 1.5, 128);
    const maxDisplacement = Math.max(...profile.map(Math.abs), 1);

    const dispImg = dispCtx.createImageData(width, height);
    const dispData = dispImg.data;
    // Rellenar con neutro R=128, G=128, B=0, A=255 (4278222976 en uint32 little-endian)
    new Uint32Array(dispData.buffer).fill(0xff008080);

    const specImg = specCtx.createImageData(width, height);
    const specData = specImg.data;

    const rSq = r * r;
    const rOuterSq = (r + 1.5) * (r + 1.5);
    const rInnerDispSq = Math.max(0, r - bWidth) * Math.max(0, r - bWidth);
    const specRimWidth = Math.max(3.5, Math.min(bWidth * 0.55, 10));
    const rInnerSpecSq = Math.max(0, r - specRimWidth) * Math.max(0, r - specRimWidth);

    const innerW = width - r * 2;
    const innerH = height - r * 2;

    const lightAngle = -Math.PI / 3; // -60° como en el video
    const lightX = Math.cos(lightAngle);
    const lightY = Math.sin(lightAngle);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        const isLeft = x < r;
        const isRight = x >= width - r;
        const isTop = y < r;
        const isBottom = y >= height - r;

        const dx = isLeft ? x - r : isRight ? x - r - innerW : 0;
        const dy = isTop ? y - r : isBottom ? y - r - innerH : 0;
        const distSq = dx * dx + dy * dy;

        if (distSq <= rOuterSq && distSq >= rInnerDispSq && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const distFromBorder = r - dist;
          const edgeFeather = distSq < rSq ? 1 : Math.max(0, 1 - (dist - r) / 1.5);
          // Suavizado progresivo (smoothstep) hacia el interior de la cápsula para evitar un corte duro
          const innerRatio = Math.max(0, Math.min(1, 1 - distFromBorder / bWidth));
          const innerSmooth = innerRatio * innerRatio * (3 - 2 * innerRatio);
          const nx = dx / dist;
          const ny = dy / dist;

          // 1. Pixel del mapa de desplazamiento (Qt) con interpolación lineal entre muestras
          const exactIdx = Math.max(0, Math.min(profile.length - 1, (distFromBorder / bWidth) * (profile.length - 1)));
          const idx0 = Math.floor(exactIdx);
          const idx1 = Math.min(profile.length - 1, idx0 + 1);
          const frac = exactIdx - idx0;
          const mag = ((profile[idx0] ?? 0) * (1 - frac) + (profile[idx1] ?? 0) * frac) * innerSmooth;
          const vx = (-nx * mag) / maxDisplacement;
          const vy = (-ny * mag) / maxDisplacement;

          dispData[idx] = Math.min(255, Math.max(0, Math.round(128 + vx * 127 * edgeFeather)));
          dispData[idx + 1] = Math.min(255, Math.max(0, Math.round(128 + vy * 127 * edgeFeather)));
          dispData[idx + 2] = 0;
          dispData[idx + 3] = 255;

          // 2. Pixel del mapa especular perimetral (Yr)
          if (distSq >= rInnerSpecSq && distFromBorder >= 0) {
            const normT = Math.min(1, distFromBorder / specRimWidth);
            const rimFalloff = Math.pow(1 - normT, 1.6);
            const dot = Math.abs(nx * lightX + -ny * lightY) * rimFalloff;
            const c = Math.min(255, Math.round(255 * dot));
            const a = Math.min(255, Math.round(c * dot * edgeFeather));

            specData[idx] = c;
            specData[idx + 1] = c;
            specData[idx + 2] = c;
            specData[idx + 3] = a;
          }
        }
      }
    }

    dispCtx.putImageData(dispImg, 0, 0);
    specCtx.putImageData(specImg, 0, 0);

    return {
      displacementUrl: dispCanvas.toDataURL('image/png'),
      specularUrl: specCanvas.toDataURL('image/png'),
      maxDisplacement,
    };
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.resizeTimer) clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          this.buildAndApplyLiquidLens();
        }, 24);
      });

      this.resizeObserver.observe(this.el.nativeElement);
    });
  }
}
