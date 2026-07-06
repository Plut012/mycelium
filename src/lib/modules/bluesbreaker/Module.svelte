<script lang="ts">
  import KingModule from '../king-of-tone/Module.svelte';
  import type { BluesbreakerEngine } from './engine.js';

  type Props = {
    engine: BluesbreakerEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();
</script>

<!-- Same pedal face as the King side — only the voicing (in the engine) differs -->
<KingModule {engine} {connectedPorts} {onPortConnect} {moduleId} title="Bluesbreaker" footswitchLabel="BLUES" />
