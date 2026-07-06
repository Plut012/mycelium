<script lang="ts">
  type Props = {
    analyserNode: AnalyserNode | null;
    /** Fixed size in px — omit both to fill the available panel space */
    width?: number;
    height?: number;
  };

  let { analyserNode, width, height }: Props = $props();

  // Responsive mode: no explicit size → stretch and track the container
  let fill = $derived(width === undefined && height === undefined);
  let clientW = $state(0);
  let clientH = $state(0);

  let W = $derived(width ?? Math.max(1, Math.floor(clientW)));
  let H = $derived(height ?? Math.max(1, Math.floor(clientH)));

  let canvas: HTMLCanvasElement | undefined = $state();
  let animFrame: number | null = null;
  let buffer: Uint8Array | undefined;

  function drawFrame() {
    if (!canvas || !analyserNode) {
      animFrame = null;
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animFrame = null;
      return;
    }

    const w = W;
    const h = H;

    // Allocate (or re-allocate) buffer if fftSize changed
    if (!buffer || buffer.length !== analyserNode.fftSize) {
      buffer = new Uint8Array(analyserNode.fftSize);
    }

    analyserNode.getByteTimeDomainData(buffer);

    ctx.clearRect(0, 0, w, h);

    // Dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    // Dim centre baseline
    ctx.strokeStyle = 'rgba(127, 255, 127, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Waveform — colour from CSS custom property on the canvas element
    const signalColor =
      getComputedStyle(canvas).getPropertyValue('--signal-color').trim() || '#7fff7f';
    ctx.strokeStyle = signalColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = signalColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();

    const sliceWidth = w / buffer.length;
    let x = 0;

    for (let i = 0; i < buffer.length; i++) {
      // buffer[i]: 128 = silence, 0 = max negative, 255 = max positive
      const v = buffer[i] / 128.0;    // range [0, 2]; 1.0 = centre
      const y = (v / 2) * h;          // range [0, h]; centre = h/2

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();

    animFrame = requestAnimationFrame(drawFrame);
  }

  function stopLoop() {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  function clearCanvas() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);
  }

  // Single reactive effect: start the loop when analyserNode + canvas are both present;
  // stop and clear when analyserNode goes away. Cleanup runs on unmount or before re-run.
  $effect(() => {
    if (analyserNode && canvas) {
      animFrame = requestAnimationFrame(drawFrame);
    } else {
      stopLoop();
      clearCanvas();
    }

    return () => stopLoop();
  });
</script>

<div
  class="signal-display"
  class:fill
  style:width={fill ? undefined : `${W}px`}
  style:height={fill ? undefined : `${H}px`}
  bind:clientWidth={clientW}
  bind:clientHeight={clientH}
>
  <canvas bind:this={canvas} width={W} height={H}></canvas>
</div>

<style>
  .signal-display {
    border-radius: var(--control-radius, 3px);
    overflow: hidden;
    border: 1px solid var(--panel-border-color, #3a2e24);
    background: rgba(0, 0, 0, 0.6);
  }

  .signal-display.fill {
    width: 100%;
    flex: 1;
    min-height: 32px;
  }

  canvas {
    display: block;
  }
</style>
