export function displayProfile(width, height, dpr = 1, android = false) {
  const layout = height < 500 && width > height ? 'phone-landscape' : width >= 600 ? 'expanded' : 'phone';
  // Android renders one pixel per physical screen pixel, including after folding.
  const pixelRatio = android ? dpr : Math.min(dpr, 1.5);
  return { layout, pixelRatio };
}
