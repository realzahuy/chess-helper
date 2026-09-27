import { parseUciMove, squareToCoordinates } from './utils.js';

const NS = 'http://www.w3.org/2000/svg';
const svgElement = (name, attributes = {}) => {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
};

export class BoardOverlay {
  // Keep extension graphics outside the board's DOM managed by Chess.com.
  constructor(container, orientation = 'white', { onLayout = () => {} } = {}) {
    this.container = container;
    this.onLayout = onLayout;
    this.orientation = orientation;
    this.move = null;
    this.svg = svgElement('svg', { class: 'move-overlay', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    this.group = svgElement('g', { opacity: 0.76 });
    this.svg.append(this.group);
    this.host = document.createElement('div');
    this.host.className = 'chess-analyzer-overlay-host';
    this.host.dataset.chessAnalyzerOwned = 'overlay';
    this.host.append(this.svg);
    document.body.append(this.host);
    this.onScroll = () => {
      if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = null; this.redraw(); });
    };
    window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    this.observer = new ResizeObserver(() => this.redraw());
    this.observer.observe(container);
    this.redraw();
  }

  setOrientation(orientation) {
    if (!['white', 'black'].includes(orientation)) throw new Error('Orientation không hợp lệ.');
    this.orientation = orientation;
    this.redraw();
  }

  drawBestMoveArrow(uci) {
    const move = parseUciMove(uci);
    if (!move) { this.clearArrow(); return false; }
    this.drawArrow(move.from, move.to);
    return true;
  }

  drawArrow(from, to) {
    this.clearArrow();
    if (!parseUciMove(from + to)) throw new Error('Nước đi không hợp lệ.');
    this.move = { from, to };
    this.redraw();
  }

  redraw() {
    this.group.replaceChildren();
    const rect = this.container.getBoundingClientRect();
    const { width, height } = rect;
    if (this.host) {
      this.host.style.left = `${rect.left + scrollX}px`;
      this.host.style.top = `${rect.top + scrollY}px`;
      this.host.style.width = `${width}px`;
      this.host.style.height = `${height}px`;
    }
    this.onLayout(rect);
    if (!width || !height) return;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (!this.move) return;
    const from = squareToCoordinates(this.move.from, { width, height }, this.orientation);
    const to = squareToCoordinates(this.move.to, { width, height }, this.orientation);
    // One filled shape: no line cap can protrude through the pointed arrowhead.
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const ux = (to.x - from.x) / length, uy = (to.y - from.y) / length;
    const squareSize = Math.min(width, height) / 8;
    const shaftHalf = squareSize * 0.08, headHalf = squareSize * 0.23;
    const headLength = Math.min(squareSize * 0.38, length * 0.5);
    const neck = { x: to.x - ux * headLength, y: to.y - uy * headLength };
    const offset = (point, amount) => `${point.x - uy * amount},${point.y + ux * amount}`;
    const points = [offset(from, shaftHalf), offset(neck, shaftHalf), offset(neck, headHalf),
      `${to.x},${to.y}`, offset(neck, -headHalf), offset(neck, -shaftHalf), offset(from, -shaftHalf)];
    this.group.append(svgElement('path', { d: `M ${points.join(' L ')} Z`, fill: '#16b8a6', stroke: 'none' }));
  }

  clearArrow() { this.move = null; this.group.replaceChildren(); }

  destroy() {
    this.observer.disconnect();
    if (this.onScroll) {
      window.removeEventListener('scroll', this.onScroll, true);
      window.removeEventListener('resize', this.onScroll);
      cancelAnimationFrame(this.frame);
    }
    this.clearArrow(); this.svg.remove(); this.host?.remove();
  }
}
