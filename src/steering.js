// The character faces local +Z. From the chase camera behind it, positive
// course offset (local +X) appears on the left, including when loops roll over.
export function steerFromControls({ left = false, right = false, axis = 0 } = {}) {
  return Math.max(-1, Math.min(1, Number(left) - Number(right) - axis));
}

export function laneForOffset(offset) {
  return offset < -1.8 ? 'RIGHT' : offset > 1.8 ? 'LEFT' : 'CENTER';
}
