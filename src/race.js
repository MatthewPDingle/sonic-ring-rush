const FIXED_STEP = 1 / 120;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function randomGenerator(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Pure, deterministic race simulation. Distances and offsets are in meters. */
export class Race {
  constructor({ length = 2000, items = [], loops = [], parrots = [], difficulty = 'easy', laps = 2, seed = 1, halfWidth = 7, autoAccelerate = true } = {}) {
    if (!Number.isFinite(length) || length <= 0) throw new RangeError('Track length must be positive.');
    if (!Number.isInteger(laps) || laps <= 0) throw new RangeError('Laps must be a positive integer.');
    this.length = length;
    this.laps = laps;
    this.totalDistance = length * laps;
    this.items = items;
    this.loops = loops.filter(loop => Number.isFinite(loop.start) && Number.isFinite(loop.end) && loop.start >= 0 && loop.end <= length && loop.end > loop.start).map(loop => ({ ...loop }));
    // Descriptors are copied: starting another race never inherits a bird's attack state.
    this.parrots = parrots.filter(bird => Number.isFinite(bird.s) && bird.s >= 0 && bird.s < length).map((bird, index) => ({
      ...bird, id: bird.id ?? `parrot-${index}`, side: bird.side === -1 ? -1 : 1,
      treeOffset: bird.treeOffset ?? 16, perchHeight: bird.perchHeight ?? 10,
      warningDistance: Math.max(90, bird.warningDistance ?? 90), attackDuration: Math.max(1.2, bird.attackDuration ?? 1.4),
      hitOffset: bird.hitOffset ?? 0, knockDirection: bird.knockDirection ?? -(bird.side === -1 ? -1 : 1),
      phase: 'perched', progress: 0, targetOffset: 0, worldS: bird.s, lap: 1, lastAttackLap: 0,
      warningAt: null, attackAt: null, returnAt: null, impactAt: null, impactProgress: 0.5, launchS: null,
    }));
    this.difficulty = ['easy', 'normal', 'challenge'].includes(difficulty) ? difficulty : 'easy';
    this.halfWidth = Math.max(2, halfWidth);
    this.autoAccelerate = autoAccelerate;
    this.state = 'ready';
    this.time = 0;
    this.countdown = 3;
    this.events = [];
    this.player = { name: 'Sonic', color: '#2387ff', s: 0, offset: 0, speed: 0, y: 0, vY: 0, rings: 0, boost: 70, boosting: false, lap: 1, finished: false, time: null, invulnerable: 0, knockVelocity: 0, inLoop: false, loopName: null, loopProgress: 0 };
    const random = randomGenerator(seed);
    const speeds = { easy: [40, 43, 39], normal: [51, 53, 50], challenge: [56, 58, 55] }[this.difficulty];
    this.rivals = ['Blaze', 'Dash', 'Pixel'].map((name, index) => ({
      name, color: ['#ff8a39', '#d86cff', '#32dec0'][index], s: 0, offset: [-3.3, 3.3, 1.7][index],
      speed: 0, y: 0, vY: 0, rings: 0, boost: 55 + index * 8, boosting: false, invulnerable: 0, finished: false, time: null, lap: 1,
      baseSpeed: speeds[index], index, targetLane: [-3.3, 3.3, 1.7][index], decision: 'launch',
      nextDecision: 0, boostUntil: 0, nextBoost: 1.5 + random() * 2, itemLaps: new Map(),
      stats: { rings: 0, pads: 0, springs: 0, jumps: 0, hits: 0, boosts: 0, overtakes: 0 },
      aheadOfPlayer: false,
      inLoop: false, loopName: null, loopProgress: 0,
    }));
    this._itemLaps = new Map();
    this._jumpHeld = false;
    this._boostExhausted = false;
    this._resumeState = null;
    this._countMark = 3;
    this._finalResults = null;
    this.items.forEach(item => { item.collected = false; });
  }

  start() {
    if (this.state !== 'ready') return;
    this.state = 'countdown';
    this.events = [{ type: 'countdown', count: 3 }];
  }

  togglePause() {
    if (this.state === 'paused') return this.resume();
    if (this.state !== 'countdown' && this.state !== 'racing') return;
    this._resumeState = this.state;
    this.state = 'paused';
    this.player.boosting = false;
    this.events = [{ type: 'pause' }];
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this._resumeState || 'racing';
    this._resumeState = null;
    this.events = [{ type: 'resume' }];
  }

  /** dt is capped at 250ms to avoid tab-return teleports, then substepped. */
  step(dt, input = {}) {
    this.events = [];
    if (!Number.isFinite(dt) || dt <= 0 || this.state === 'paused' || this.state === 'ready' || this.state === 'finished') return;
    let remaining = Math.min(dt, 0.25);
    const jumpPressed = Boolean(input.jump) && !this._jumpHeld;
    this._jumpHeld = Boolean(input.jump);
    if (this.state === 'countdown') {
      const used = Math.min(remaining, this.countdown);
      this.countdown = Math.max(0, this.countdown - used);
      remaining -= used;
      const count = Math.ceil(this.countdown - 1e-8);
      if (count > 0 && count < this._countMark) this.events.push({ type: 'countdown', count });
      this._countMark = count;
      if (this.countdown <= 1e-8) {
        this.countdown = 0;
        this.state = 'racing';
        this.events.push({ type: 'go' });
      }
    }
    if (this.state !== 'racing') return;
    this._updateLoop(this.player, true);
    if (jumpPressed && this.player.y <= 0.001 && !this.player.inLoop) {
      this.player.vY = 11.8;
      this.events.push({ type: 'jump' });
    }
    while (remaining > 1e-9 && this.state === 'racing') {
      const step = Math.min(FIXED_STEP, remaining);
      this._integrate(step, input);
      remaining -= step;
    }
  }

  _integrate(dt, input) {
    const player = this.player;
    const oldDistance = player.s;
    const oldTime = this.time;
    const oldOffset = player.offset;
    const oldY = player.y;
    this.time += dt;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const steer = clamp(Number(input.steer) || 0, -1, 1);
    player.offset = clamp(player.offset + (steer * (8 + player.speed * 0.075) + player.knockVelocity) * dt, -this.halfWidth + 0.65, this.halfWidth - 0.65);
    player.knockVelocity *= Math.exp(-4 * dt);
    if (Math.abs(player.knockVelocity) < 0.01) player.knockVelocity = 0;
    const wantsBoost = Boolean(input.boost) && !input.brake;
    if (!wantsBoost || player.boost >= 20) this._boostExhausted = false;
    const boosting = wantsBoost && player.boost > 0 && !this._boostExhausted;
    if (boosting && !player.boosting) this.events.push({ type: 'boost' });
    player.boosting = boosting;
    player.boost = clamp(player.boost + (boosting ? -27 : 3.5) * dt, 0, 100);
    if (player.boost <= 0) { this._boostExhausted = true; player.boosting = false; }
    const accelerate = this.autoAccelerate || Boolean(input.accelerate);
    const targetSpeed = input.brake ? 15 : accelerate ? (boosting ? 80 : 52) : 0;
    const acceleration = targetSpeed > player.speed ? (boosting ? 37 : 22) : (input.brake ? 55 : 15);
    player.speed += clamp(targetSpeed - player.speed, -acceleration * dt, acceleration * dt);
    if (player.inLoop) { player.speed = Math.max(40, player.speed); player.y = 0; player.vY = 0; }
    player.y += player.vY * dt;
    if (player.y > 0 || player.vY > 0) player.vY -= 25 * dt;
    if (player.y < 0) { player.y = 0; player.vY = 0; this.events.push({ type: 'land' }); }
    const distanceSpeed = player.speed;
    player.s = Math.min(this.totalDistance, player.s + distanceSpeed * dt);
    this._collectItems(oldDistance, player.s, oldTime, oldOffset, oldY);
    this._updateParrots(oldDistance, player.s, oldOffset, oldY, oldTime);
    this._updateLoop(player, true);
    const lap = Math.min(this.laps, Math.floor((player.s + 1e-8) / this.length) + 1);
    if (lap !== player.lap) {
      player.lap = lap;
      this.items.forEach(item => { item.collected = false; });
      this.events.push({ type: 'lap', lap });
    }
    for (const rival of this.rivals) {
      if (rival.finished) continue;
      this._integrateRival(rival, dt, oldTime);
    }
    if (player.s >= this.totalDistance) {
      player.finished = true;
      player.time = oldTime + (this.totalDistance - oldDistance) / Math.max(0.01, distanceSpeed);
      this.time = player.time;
      player.boosting = false;
      this.state = 'finished';
      // Remaining AI times are projected for a complete, stable finish board.
      this._finalResults = this._rankedRacers().map(racer => ({
        name: racer.name, player: racer === player,
        time: racer.time ?? this.time + (this.totalDistance - racer.s) / Math.max(1, racer.speed),
        finished: racer.finished, estimated: !racer.finished,
      })).sort((a, b) => a.time - b.time || (a.player ? -1 : b.player ? 1 : a.name.localeCompare(b.name)))
        .map((row, index) => ({ ...row, position: index + 1 }));
      this.events.push({ type: 'finish', position: this.position, time: player.time });
    }
  }

  _upcoming(racer, horizon) {
    const lap = Math.floor(racer.s / this.length);
    const upcoming = [];
    this.items.forEach((item, index) => {
      if (!Number.isFinite(item.s) || item.s < 0 || item.s >= this.length) return;
      let itemLap = lap, ahead = item.s + itemLap * this.length - racer.s;
      if (ahead < 0) { itemLap++; ahead += this.length; }
      if (ahead > horizon || itemLap >= this.laps || racer.itemLaps.get(index) === itemLap) return;
      const time = this.time + ahead / Math.max(25, racer.speed);
      const lane = (item.lane || 0) + (item.type === 'pendulum' ? (item.swayAmplitude ?? 5) * Math.sin(time * (item.swayFrequency ?? item.frequency ?? 1.5) + (item.phase ?? 0)) : 0);
      upcoming.push({ item, ahead, lane, distance: racer.s + ahead });
    });
    return upcoming.sort((a, b) => a.ahead - b.ahead);
  }

  _decideRival(rival) {
    const upcoming = this._upcoming(rival, Math.max(65, rival.speed * 1.5));
    rival.threats = upcoming.filter(({item}) => ['hazard', 'log', 'pendulum'].includes(item.type));
    const edge = this.halfWidth - .7;
    const lanes = [...new Set([rival.offset, -4, 0, 4, ...upcoming.filter(({item}) => ['ring', 'boost'].includes(item.type)).map(({lane}) => lane)])].map(lane => clamp(lane, -edge, edge));
    let best = { lane: rival.targetLane, score: -Infinity, reason: 'run' };
    for (const lane of lanes) {
      let score = -Math.abs(lane - rival.offset) * .25, reason = 'run', attraction = 0;
      for (const entry of upcoming) {
        const { item, ahead } = entry;
        const reach = (8 + rival.speed * .075) * ahead / Math.max(25, rival.speed);
        if (Math.abs(lane - rival.offset) > reach + 1.1 || Math.abs(lane - entry.lane) > 1.3) continue;
        const urgency = 1 / (1 + ahead * .035);
        if (item.type === 'ring' || item.type === 'boost') {
          const weight = item.type === 'ring' ? (rival.index === 2 ? 4 : 3) : this.difficulty === 'easy' ? (rival.index === 1 ? 11 : 5) : (rival.index === 1 ? 17 : 13);
          const gain = weight * urgency;
          score += gain;
          if (gain > attraction) { attraction = gain; reason = item.type === 'boost' ? 'boost pad' : 'rings'; }
        } else if (['hazard', 'log', 'pendulum'].includes(item.type)) {
          // Prefer a clear lane; committed ring routes can be cleared with a jump.
          score -= (rival.inLoop ? 25 : 5) * urgency;
        } else if (item.type === 'spring') score -= urgency;
      }
      for (const other of [this.player, ...this.rivals]) {
        if (other === rival || other.finished) continue;
        const gap = other.s - rival.s;
        if (gap > -2 && gap < 12 && Math.abs(lane - other.offset) < 1.3) score -= 3;
      }
      if (score > best.score) best = { lane, score, reason };
    }
    rival.targetLane = best.lane;
    rival.decision = best.reason;
    rival.nextDecision = this.time + .15;
    const blocked = upcoming.some(({item, ahead, lane}) => ['hazard', 'log', 'pendulum'].includes(item.type) && ahead < rival.speed * .65 && Math.abs(lane - rival.offset) < 2);
    const chasing = this.player.s > rival.s && this.player.s - rival.s < 160;
    const defending = this.rivals.some(other => other !== rival && rival.s > other.s && rival.s - other.s < 25 && other.speed > rival.speed);
    const canSpend = rival.boost >= (this.difficulty === 'easy' ? 70 : chasing || defending ? 42 : 58);
    if (this.time >= rival.nextBoost && canSpend && !blocked && rival.y < .2) {
      // Charge and real position drive the decision, never a catch-up speed multiplier.
      rival.boostUntil = this.time + (this.difficulty === 'easy' ? 1.1 : 1.8);
      rival.nextBoost = this.time + (this.difficulty === 'easy' ? 8 : chasing || defending ? 4.5 : 6) + rival.index * .35;
      rival.decision = chasing ? 'chase Sonic' : defending ? 'defend position' : 'boost straight';
      rival.stats.boosts++;
      this.events.push({ type: 'rivalBoost', rival: rival.index });
    }
  }

  _integrateRival(rival, dt, oldTime) {
    this._updateLoop(rival);
    if (this.time >= rival.nextDecision) this._decideRival(rival);
    rival.invulnerable = Math.max(0, rival.invulnerable - dt);
    const oldS = rival.s, oldOffset = rival.offset, oldY = rival.y;
    const steer = clamp((rival.targetLane - rival.offset) * 1.6, -1, 1);
    rival.offset = clamp(rival.offset + steer * (8 + rival.speed * .075) * dt, -this.halfWidth + .65, this.halfWidth - .65);
    // A swept prediction allows an actual jump, rather than an idle hop animation.
    if (rival.y <= .001 && rival.vY <= 0 && !rival.inLoop) {
      const threat = rival.threats?.find(({distance, lane}) => distance >= rival.s && distance - rival.s < Math.max(8, rival.speed * .32) && Math.abs(lane - rival.offset) < 2);
      if (threat) {
        rival.vY = 11.8; rival.stats.jumps++; rival.decision = 'jump obstacle';
        this.events.push({ type: 'rivalJump', rival: rival.index });
      }
    }
    rival.boosting = this.time < rival.boostUntil && rival.boost > 8 && rival.invulnerable === 0;
    rival.boost = clamp(rival.boost + (rival.boosting ? -27 : 3.5) * dt, 0, 100);
    const target = rival.boosting ? (this.difficulty === 'easy' ? 65 : this.difficulty === 'challenge' ? 82 : 78) : rival.baseSpeed;
    const acceleration = target > rival.speed ? (rival.boosting ? 37 : 22) : this.difficulty === 'easy' ? 35 : 15;
    rival.speed += clamp(target - rival.speed, -acceleration * dt, acceleration * dt);
    if (rival.inLoop) { rival.speed = Math.max(40, rival.speed); rival.y = 0; rival.vY = 0; }
    rival.y += rival.vY * dt;
    if (rival.y > 0 || rival.vY > 0) rival.vY -= 25 * dt;
    if (rival.y < 0) { rival.y = 0; rival.vY = 0; }
    const distanceSpeed = rival.speed;
    rival.s = Math.min(this.totalDistance, rival.s + distanceSpeed * dt);
    this._collectItems(oldS, rival.s, oldTime, oldOffset, oldY, rival);
    rival.lap = Math.min(this.laps, Math.floor((rival.s + 1e-8) / this.length) + 1);
    this._updateLoop(rival);
    if (rival.s > this.player.s && !rival.aheadOfPlayer) rival.stats.overtakes++;
    rival.aheadOfPlayer = rival.s > this.player.s;
    if (rival.s >= this.totalDistance) {
      rival.finished = true; rival.boosting = false;
      rival.time = oldTime + (this.totalDistance - oldS) / Math.max(.01, distanceSpeed);
    }
  }

  _updateLoop(racer, emit = false) {
    const local = racer.s % this.length;
    const loop = racer.s < this.totalDistance ? this.loops.find(segment => local >= segment.start && local < segment.end) : null;
    const key = loop ? `${Math.floor(racer.s / this.length)}:${this.loops.indexOf(loop)}` : null;
    if (key !== (racer._loopKey ?? null)) {
      if (emit && racer.inLoop) this.events.push({ type: 'loopExit', name: racer.loopName, lap: racer._loopLap });
      if (emit && loop) this.events.push({ type: 'loopEnter', name: loop.name ?? 'Loop', lap: Math.floor(racer.s / this.length) + 1 });
      racer._loopKey = key;
    }
    racer.inLoop = Boolean(loop);
    racer.loopName = loop ? loop.name ?? 'Loop' : null;
    racer.loopProgress = loop ? clamp((local - loop.start) / (loop.end - loop.start), 0, 1) : 0;
    racer._loopLap = Math.floor(racer.s / this.length) + 1;
    if (loop) { racer.speed = Math.max(40, racer.speed); racer.y = 0; if ('vY' in racer) racer.vY = 0; }
  }

  _updateParrots(start, end, oldOffset, oldY, oldTime) {
    const player = this.player;
    const lap = Math.min(this.laps, Math.floor(end / this.length) + 1);
    for (const bird of this.parrots) {
      if (bird.lap !== lap) {
        bird.lap = lap;
        bird.worldS = bird.s + (lap - 1) * this.length;
        bird.phase = 'perched'; bird.progress = 0; bird.targetOffset = 0;
        bird.warningAt = null; bird.attackAt = null; bird.impactAt = null; bird.returnAt = null; bird.launchS = null;
      }
      const remaining = bird.worldS - end;
      if (bird.phase === 'perched' && bird.lastAttackLap !== lap && remaining > 0 && remaining <= bird.warningDistance) {
        bird.lastAttackLap = lap;
        bird.phase = 'warning'; bird.warningAt = this.time; bird.progress = 0;
        bird.targetOffset = clamp(player.offset + bird.hitOffset, -this.halfWidth + 0.65, this.halfWidth - 0.65);
        this.events.push({ type: 'parrotWarning', id: bird.id, direction: bird.knockDirection, lane: bird.targetOffset });
      }
      if (bird.phase === 'warning') {
        bird.progress = clamp((this.time - bird.warningAt) / 0.35, 0, 1);
        if (this.time - bird.warningAt >= 0.35) {
          bird.phase = 'swooping'; bird.progress = 0; bird.attackAt = this.time; bird.launchS = end;
          this.events.push({ type: 'parrotSwoop', id: bird.id, lane: bird.targetOffset });
        }
      }
      if (bird.phase === 'swooping') {
        if (bird.impactAt === null && start <= bird.worldS && end >= bird.worldS && end > start) {
          const crossing = clamp((bird.worldS - start) / (end - start), 0, 1);
          bird.impactAt = oldTime + (this.time - oldTime) * crossing;
          const offset = oldOffset + (player.offset - oldOffset) * crossing;
          const height = oldY + (player.y - oldY) * crossing;
          // Even birds near the start cannot cause an unannounced, unavoidable hit.
          if (bird.impactAt - bird.warningAt >= 0.8 && Math.abs(offset - bird.targetOffset) <= 1.6 && height < 2 && player.invulnerable <= 0) {
            const easy = this.difficulty === 'easy';
            const lost = Math.min(easy ? 5 : 8, player.rings);
            player.rings -= lost;
            player.speed = Math.max(20, player.speed * (easy ? 0.72 : 0.6));
            player.knockVelocity = (bird.knockDirection < 0 ? -1 : 1) * (easy ? 8 : 12);
            player.invulnerable = 1.25; player.boosting = false;
            this.events.push({ type: 'parrotHit', id: bird.id, lost, direction: bird.knockDirection, lane: bird.targetOffset });
          }
        }
        // Flight meets the locked target at progress .5 exactly as Sonic crosses it.
        bird.progress = bird.impactAt === null
          ? 0.5 * clamp((end - bird.launchS) / Math.max(0.01, bird.worldS - bird.launchS), 0, 1)
          : 0.5 + 0.5 * clamp((this.time - bird.impactAt) / (bird.attackDuration * 0.5), 0, 1);
        if (remaining < 0 && bird.impactAt === null) bird.impactAt = this.time;
        if (bird.progress >= 1) { bird.phase = 'returning'; bird.progress = 0; bird.returnAt = this.time; }
      }
      if (bird.phase === 'returning') {
        bird.progress = clamp((this.time - bird.returnAt) / 0.8, 0, 1);
        if (bird.progress >= 1) { bird.phase = 'perched'; bird.progress = 0; }
      }
    }
  }

  _collectItems(start, end, oldTime = this.time, oldOffset = this.player.offset, oldY = this.player.y, player = this.player) {
    if (end <= start) return;
    const isPlayer = player === this.player;
    const itemLaps = isPlayer ? this._itemLaps : player.itemLaps;
    const emit = (type, data) => this.events.push(isPlayer ? { type, ...data } : { type: `rival${type[0].toUpperCase()}${type.slice(1)}`, rival: player.index, ...data });
    const firstLap = Math.floor(start / this.length);
    const lastLap = Math.min(this.laps - 1, Math.floor(end / this.length));
    for (let lap = firstLap; lap <= lastLap; lap++) {
      this.items.forEach((item, index) => {
        if (!Number.isFinite(item.s) || item.s < 0 || item.s >= this.length) return;
        const distance = item.s + lap * this.length;
        if (distance < start || distance > end || itemLaps.get(index) === lap) return;
        const tolerance = item.type === 'ring' ? 1.55 : item.type === 'hazard' ? 1.35 : item.type === 'pendulum' ? 1.65 : 1.9;
        const crossing = clamp((distance - start) / (end - start), 0, 1);
        const crossingTime = oldTime + (this.time - oldTime) * crossing;
        const lane = (item.lane || 0) + (item.type === 'pendulum' ? (item.swayAmplitude ?? 5) * Math.sin(crossingTime * (item.swayFrequency ?? item.frequency ?? 1.5) + (item.phase ?? 0)) : 0);
        const crossingOffset = item.type === 'pendulum' ? oldOffset + (player.offset - oldOffset) * crossing : player.offset;
        if (Math.abs(crossingOffset - lane) > tolerance) return;
        if (item.type === 'ring' && player.y < 2.8) {
          itemLaps.set(index, lap);
          if (isPlayer) item.collected = true;
          else player.stats.rings++;
          player.rings += 1;
          player.boost = Math.min(100, player.boost + 6);
          emit('ring', { item, index, rings: player.rings, lap: lap + 1 });
        } else if (['hazard', 'log', 'pendulum'].includes(item.type) && player.y < (item.type === 'log' ? 1.4 : item.type === 'pendulum' ? 2 : 1.15) && player.invulnerable <= 0) {
          itemLaps.set(index, lap);
          if (!isPlayer) { player.stats.hits++; player.boostUntil = 0; }
          const lost = Math.min(10, player.rings);
          player.rings -= lost;
          player.speed = Math.max(13, player.speed * 0.52);
          player.boosting = false;
          player.invulnerable = 1.25;
          emit('hit', { item, index, lost });
        } else if (item.type === 'boost' && player.y < 0.8) {
          itemLaps.set(index, lap);
          if (!isPlayer) player.stats.pads++;
          player.speed = Math.max(player.speed, 76);
          player.boost = Math.min(100, player.boost + 14);
          emit('pad', { item, index });
        } else if (item.type === 'spring' && player.y < 0.8 && !player.inLoop) {
          itemLaps.set(index, lap);
          if (!isPlayer) player.stats.springs++;
          player.vY = 16;
          emit('spring', { item, index });
        }
      });
    }
  }

  _rankedRacers() {
    return [this.player, ...this.rivals].sort((a, b) => {
      if (a.finished && b.finished) return a.time - b.time || (a === this.player ? -1 : b === this.player ? 1 : a.name.localeCompare(b.name));
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.s - a.s || (a === this.player ? -1 : b === this.player ? 1 : a.name.localeCompare(b.name));
    });
  }

  get position() { return this._rankedRacers().indexOf(this.player) + 1; }

  get results() {
    if (this._finalResults) return this._finalResults.map(row => ({ ...row }));
    return this._rankedRacers().map((racer, index) => ({ position: index + 1, name: racer.name, time: racer.time, player: racer === this.player, finished: racer.finished, estimated: false }));
  }
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.--';
  const centiseconds = Math.floor((seconds + 1e-8) * 100);
  const minutes = Math.floor(centiseconds / 6000);
  return `${minutes}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

export function medalFor(position) { return position === 1 ? 'GOLD' : position === 2 ? 'SILVER' : position === 3 ? 'BRONZE' : 'FINISHER'; }
