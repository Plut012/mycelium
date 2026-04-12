<script lang="ts">
  type Props = {
    analyserNode: AnalyserNode | null;
    width?: number;
    height?: number;
  };

  let { analyserNode, width = 120, height = 40 }: Props = $props();

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

    // Allocate (or re-allocate) buffer if fftSize changed
    if (!buffer || buffer.length !== analyserNode.fftSize) {
      buffer = new Uint8Array(analyserNode.fftSize);
    }

    analyserNode.getByteTimeDomainData(buffer);

    ctx.clearRect(0, 0, width, height);

    // Dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);

    // Dim centre baseline
    ctx.strokeStyle = 'rgba(127, 255, 127, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Waveform — colour from CSS custom property on the canvas element
    const signalColor =
      getComputedStyle(canvas).getPropertyValue('--signal-color').trim() || '#7fff7f';
    ctx.strokeStyle = signalColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = signalColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();

    const sliceWidth = width / buffer.length;
    let x = 0;

    for (let i = 0; i < buffer.length; i++) {
      // buffer[i]: 128 = silence, 0 = max negative, 255 = max positive
      const v = buffer[i] / 128.0;    // range [0, 2]; 1.0 = centre
      const y = (v / 2) * height;     // range [0, height]; centre = height/2

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
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
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);
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

<div class="signal-display" style:width="{width}px" style:height="{height}px">
  <canvas bind:this={canvas} {width} {height}></canvas>
</div>

<style>
  .signal-display {
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--panel-border-color, #3a2e24);
    background: rgba(0, 0, 0, 0.6);
  }

  canvas {
    display: block;
  }
</style>
