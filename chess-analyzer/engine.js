import { MODES, depthLimitForLevel, parseUciMove, validateFen } from './utils.js';

const aborted = () => new DOMException('Lượt phân tích đã bị hủy.', 'AbortError');

export function parseInfo(line) {
  if (!line.startsWith('info ') || line.startsWith('info string ')) return null;
  const result = {};
  const depth = line.match(/\bdepth (\d+)/);
  const multipv = line.match(/\bmultipv (\d+)/);
  const score = line.match(/\bscore (cp|mate) (-?\d+)(?: (lowerbound|upperbound))?/);
  const pv = line.match(/\bpv (.+)$/);
  if (multipv && Number(multipv[1]) !== 1) return null;
  if (depth) result.depth = Number(depth[1]);
  if (score) result.score = { type: score[1], value: Number(score[2]), bound: score[3] ?? null };
  if (pv) result.pv = pv[1].trim().split(/\s+/).filter(move => parseUciMove(move));
  return Object.keys(result).length ? result : null;
}

export class StockfishEngine {
  constructor({ onInfo = () => {}, onState = () => {}, onError = () => {}, threads = 1,
    workerFactory = url => new Worker(url), timeout = 20000 } = {}) {
    this.onInfo = onInfo;
    this.onState = onState;
    this.onError = onError;
    this.threads = threads;
    this.workerFactory = workerFactory;
    this.timeout = timeout;
    this.worker = null;
    this.active = null;
    this.request = null;
    this.generation = 0;
    this.waiters = new Set();
    this.queue = Promise.resolve();
    this.initializing = null;
    this.destroyed = false;
    this.threadMax = 1;
    this.lastDepthLimit = null;
  }

  initialize() {
    if (this.destroyed) return Promise.reject(new Error('Engine đã đóng. Hãy tạo instance mới.'));
    if (this.initializing) return this.initializing;
    this.initializing = this._initialize().catch(error => {
      if (!this.destroyed) this._fail(error);
      throw error;
    });
    return this.initializing;
  }

  async _initialize() {
    this.onState('Đang nạp Stockfish…');
    const workerUrl = new URL('./engine/worker.js', import.meta.url);
    workerUrl.hash = encodeURIComponent(new URL('./engine/stockfish.wasm', import.meta.url).href);
    this.worker = this.workerFactory(workerUrl);
    let workerStarted = false;
    this.worker.onmessage = event => {
      if (event.data?.type === 'engine-stage') { workerStarted = true; return; }
      if (event.data?.type === 'engine-error') {
        this._fail(new Error(`Stockfish lỗi khi ${event.data.stage}: ${event.data.message}`));
        return;
      }
      if (typeof event.data !== 'string') return;
      for (const line of event.data.split(/\r?\n/)) this._line(line.trim());
    };
    this.worker.onerror = event => {
      const detail = event.message || (workerStarted
        ? 'Worker dừng mà trình duyệt không cung cấp chi tiết.'
        : 'Không tải được engine/worker.js. Kiểm tra CSP/COEP và file local; reload extension và tab.');
      const location = event.filename ? ` (${event.filename}:${event.lineno || 0})` : '';
      this._fail(new Error(`Stockfish Worker: ${detail}${location}`));
    };
    this.worker.onmessageerror = () => this._fail(new Error('Không đọc được thông điệp Stockfish.'));
    await this._commandUntil('uci', 'uciok');
    await this._commandUntil('isready', 'readyok');
    this._send('setoption name MultiPV value 1');
    this._send('setoption name Hash value 64');
    if (!Number.isInteger(this.threads) || this.threads < 1 || this.threads > this.threadMax ||
        (this.threads > 1 && !globalThis.crossOriginIsolated)) {
      throw new Error('Build/môi trường hiện tại không hỗ trợ số Threads đã chọn.');
    }
    // The bundled lite-single build uses one thread. Only set this option if advertised.
    if (this.hasThreads) this._send(`setoption name Threads value ${this.threads}`);
    await this._commandUntil('isready', 'readyok');
    this.onState('Stockfish sẵn sàng');
  }

  analyze(input, mode = 'strong', skillLevel = 20) {
    let fen, depthLimit;
    try {
      fen = validateFen(input).fen;
      if (!Object.hasOwn(MODES, mode)) throw new Error('Analysis mode không hợp lệ.');
      depthLimit = depthLimitForLevel(skillLevel);
      if (this.destroyed) throw new Error('Engine đã đóng.');
    } catch (error) { return Promise.reject(error); }
    this._invalidate();
    const id = this.generation;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const request = { id, fen, resolve, reject, settled: false };
    this.request = request;
    // Serialize preparation only. A new request stops and drains the active search.
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (!this._current(request)) return;
      await this.initialize();
      if (!this._current(request)) return;
      await this._stopSearch();
      if (!this._current(request)) return;
      if (depthLimit !== this.lastDepthLimit) {
        // Avoid reusing full-depth transposition entries for a shallower level.
        this._send('setoption name Clear Hash');
        this.lastDepthLimit = depthLimit;
      }
      await this._commandUntil('isready', 'readyok');
      if (!this._current(request)) return;
      let finish;
      const done = new Promise(yes => { finish = yes; });
      this.active = {
        request, done, finish, stopping: false,
        result: { analysisId: id, fen, bestMove: null, from: null, to: null, promotion: null,
          depth: null, score: null, evaluation: null, mate: null, pv: [] },
        timer: setTimeout(() => this._fail(new Error('Stockfish search hết thời gian chờ.')), MODES[mode] + 10000),
      };
      this.onState('Đang phân tích…');
      this._send(`position fen ${fen}`);
      this._send(`go movetime ${MODES[mode]}${depthLimit === null ? '' : ` depth ${depthLimit}`}`);
    }).catch(error => {
      this._settle(request, error);
      if (!this.destroyed) this._fail(error);
    });
    return promise;
  }

  stop() {
    this._invalidate();
    this.queue = this.queue.catch(() => {}).then(() => this._stopSearch()).catch(error => {
      if (!this.destroyed) this._fail(error);
    });
    return this.queue;
  }

  destroy(reason = aborted()) {
    if (this.destroyed) return;
    this.destroyed = true;
    this._invalidate(reason);
    if (this.worker) {
      try { this.worker.postMessage('stop'); } catch { /* Already terminated. */ }
      this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null;
      this.worker.terminate();
      this.worker = null;
    }
    if (this.active) {
      clearTimeout(this.active.timer);
      this.active.finish();
      this.active = null;
    }
    for (const waiter of this.waiters) { clearTimeout(waiter.timer); waiter.reject(reason); }
    this.waiters.clear();
  }

  _current(request) { return !this.destroyed && request.id === this.generation; }

  _invalidate(reason = aborted()) {
    this.generation += 1;
    if (this.request) this._settle(this.request, reason);
    // Send stop immediately, even if preparation is queued.
    if (this.active && !this.active.stopping && this.worker) {
      this.active.stopping = true;
      this._send('stop');
    }
  }

  _settle(request, error, value) {
    if (request.settled) return;
    request.settled = true;
    if (this.request === request) this.request = null;
    if (error) request.reject(error); else request.resolve(value);
  }

  async _stopSearch() {
    const active = this.active;
    if (!active) return;
    if (!active.stopping) { active.stopping = true; this._send('stop'); }
    let timer;
    try {
      await Promise.race([
        active.done,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Stockfish không xác nhận stop.')), 4000); }),
      ]);
    } finally { clearTimeout(timer); }
  }

  _send(command) {
    if (!this.worker) throw new Error('Stockfish Worker chưa sẵn sàng.');
    this.worker.postMessage(command);
  }

  _commandUntil(command, expected) {
    return new Promise((resolve, reject) => {
      const waiter = { expected, resolve, reject };
      waiter.timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error(`Stockfish không trả ${expected}. Kiểm tra JS/WASM và CSP.`));
      }, this.timeout);
      this.waiters.add(waiter);
      try { this._send(command); } catch (error) {
        clearTimeout(waiter.timer); this.waiters.delete(waiter); reject(error);
      }
    });
  }

  _line(line) {
    if (this.destroyed || !line) return;
    if (/^(?:Aborted\(|RuntimeError|Error:|info string ERROR)/i.test(line)) {
      this._fail(new Error(line)); return;
    }
    if (line.startsWith('option name Threads type spin')) {
      this.hasThreads = true;
      this.threadMax = Number(line.match(/\bmax (\d+)/)?.[1] || 1);
    }
    for (const waiter of this.waiters) {
      if (line === waiter.expected) {
        clearTimeout(waiter.timer); this.waiters.delete(waiter); waiter.resolve();
      }
    }
    const active = this.active;
    if (!active) return;
    if (line.startsWith('bestmove ')) {
      clearTimeout(active.timer);
      this.active = null;
      active.finish(); // Drain bestmove even when stale, before another position command.
      if (!this._current(active.request)) return;
      const raw = line.split(/\s+/)[1];
      const move = parseUciMove(raw);
      if (!move && !['(none)', '0000'].includes(raw)) {
        this._settle(active.request, new Error('Stockfish trả bestmove không hợp lệ.')); return;
      }
      const result = { ...active.result, ...(move || {}), bestMove: move ? raw : null };
      this._settle(active.request, null, result);
      this.onState(move ? 'Hoàn tất' : 'Không có nước đi hợp lệ');
      return;
    }
    if (!this._current(active.request)) return;
    const info = parseInfo(line);
    if (!info?.score || !info.pv?.length) return;
    Object.assign(active.result, info);
    const score = active.result.score;
    const sign = active.request.fen.split(' ')[1] === 'b' ? -1 : 1;
    active.result.evaluation = score?.type === 'cp' ? sign * score.value / 100 : null;
    active.result.mate = score?.type === 'mate' ? sign * score.value : null;
    this.onInfo({ ...active.result, pv: [...active.result.pv] });
  }

  _fail(error) {
    if (this.destroyed) return;
    this.destroy(error);
    this.onError(error);
  }
}
