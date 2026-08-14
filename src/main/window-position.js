function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function fitWindowToBounds(position, bounds, size, margin = 8) {
  const minimumX = bounds.x + margin;
  const minimumY = bounds.y + margin;
  const maximumX = bounds.x + bounds.width - size.width - margin;
  const maximumY = bounds.y + bounds.height - size.height - margin;
  return {
    x: Math.round(clamp(position.x, minimumX, maximumX)),
    y: Math.round(clamp(position.y, minimumY, maximumY))
  };
}

module.exports = { fitWindowToBounds };
