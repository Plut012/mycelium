<script lang="ts">
  type Props = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    signalActive?: boolean;
  };

  let { x1, y1, x2, y2, signalActive = false }: Props = $props();

  const NUM_POINTS = 32;
  const DEFAULT_DROOP = 0.4;

  /**
   * Build an SVG polyline points string approximating a catenary (hanging cable).
   *
   * Uses a parabolic approximation: y_sag = sag * 4 * t * (1 - t)
   * where sag = droopFactor * euclidean_distance.
   *
   * A parabola closely matches a catenary for visual purposes and is
   * trivially cheap to compute. Longer cables droop more, matching physics.
   */
  function buildPoints(
    px1: number, py1: number,
    px2: number, py2: number,
    droopFactor: number
  ): string {
    const dist = Math.hypot(px2 - px1, py2 - py1);
    // Sag in the downward Y direction — gravity is always down
    const sag = droopFactor * dist;

    const pts: string[] = [];
    for (let i = 0; i <= NUM_POINTS; i++) {
      const t = i / NUM_POINTS;
      const lx = px1 + t * (px2 - px1);
      const ly = py1 + t * (py2 - py1);
      // Parabolic sag: max at t=0.5, zero at endpoints
      const droop = sag * 4 * t * (1 - t);
      pts.push(`${lx.toFixed(1)},${(ly + droop).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  let svgEl: SVGSVGElement | undefined = $state();
  let droopFactor = $state(DEFAULT_DROOP);

  // Read --cable-droop from computed style after the element mounts.
  // Re-runs if svgEl changes (mount/unmount).
  $effect(() => {
    if (!svgEl) return;
    const raw = getComputedStyle(svgEl).getPropertyValue('--cable-droop').trim();
    const parsed = parseFloat(raw);
    droopFactor = isNaN(parsed) ? DEFAULT_DROOP : parsed;
  });

  const points = $derived(buildPoints(x1, y1, x2, y2, droopFactor));

  // Unique SVG filter ID per instance — use a stable derivation to avoid
  // filter ID collisions when multiple cables are on screen simultaneously.
  // Using a counter would require module-level state; hashing coords is fine.
  const filterId = $derived(
    `cg-${(Math.abs(x1) | 0)}-${(Math.abs(y1) | 0)}-${(Math.abs(x2) | 0)}-${(Math.abs(y2) | 0)}`
  );
</script>

<!--
  PatchCable is an SVG overlay fragment. The parent should place this inside a
  full-rack <svg> with position:absolute covering the rack workspace.
  (x1,y1) and (x2,y2) are absolute rack coordinates.
-->
<svg
  bind:this={svgEl}
  class="patch-cable"
  aria-hidden="true"
  style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;"
>
  <defs>
    {#if signalActive}
      <!--
        Layered glow: blur copy composited behind the crisp line.
        feComposite in2="SourceGraphic" operator="over" keeps the sharp cable
        on top of the blurred halo.
      -->
      <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    {/if}
  </defs>

  <!-- Drop shadow for depth -->
  <polyline
    class="cable-shadow"
    points={points}
  />

  <!-- Main cable body -->
  <polyline
    class="cable-body"
    class:active={signalActive}
    points={points}
    filter={signalActive ? `url(#${filterId})` : undefined}
  />
</svg>

<style>
  .cable-shadow {
    fill: none;
    stroke: rgba(0, 0, 0, 0.35);
    stroke-width: calc(var(--cable-width, 3px) + 2px);
    stroke-linecap: round;
    stroke-linejoin: round;
    transform: translate(1px, 2px);
  }

  .cable-body {
    fill: none;
    stroke: var(--cable-stroke, #4a7a3a);
    stroke-width: var(--cable-width, 3px);
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: var(--cable-opacity, 0.85);
  }

  .cable-body.active {
    stroke: var(--cable-glow, #7fff7f);
    opacity: 1;
  }
</style>
