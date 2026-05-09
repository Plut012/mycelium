/**
 * Waveform peak computation.
 *
 * Pre-computes a min/max peaks array from an AudioBuffer for efficient
 * rendering. The result is a Float32Array of interleaved [min, max] pairs,
 * one pair per horizontal pixel of the waveform display.
 */

/**
 * Compute waveform peaks from an AudioBuffer.
 *
 * @param buffer — decoded AudioBuffer
 * @param buckets — number of horizontal buckets (typically canvas width in px)
 * @returns Float32Array of length buckets * 2, interleaved [min, max] pairs
 */
export function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const peaks = new Float32Array(buckets * 2);
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const samplesPerBucket = length / buckets;

  // Get channel data (mono mix if stereo)
  const data = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] += channelData[i] / channels;
    }
  }

  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * samplesPerBucket);
    const end = Math.min(Math.floor((b + 1) * samplesPerBucket), length);

    let min = 1;
    let max = -1;

    for (let i = start; i < end; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    peaks[b * 2] = min;
    peaks[b * 2 + 1] = max;
  }

  return peaks;
}
