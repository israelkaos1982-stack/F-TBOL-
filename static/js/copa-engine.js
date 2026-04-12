/* ================================================================
   COPA DEL REY ENGINE v2.0
   - Secciones desplegables en Copa y Calendario
   - Simulación IA coherente con Liga + prórroga/penaltis
   - Registro cruzado de stats/bajas en fichas de jugador
   ================================================================ */
(function () {
  var HUMAN_TEAMS = ['Real Madrid', 'FC Barcelona', 'Bayern Munich', 'Arsenal', 'Sporting CP'];
  var ROUND_LABEL = {
    r1: '1ª Ronda',
    r2: '2ª Ronda',
    r16: 'Dieciseisavos',
    oct: 'Octavos',
    cua: 'Cuartos',
    fin: 'Final'
  };
  var TWO_LEG = { oct: true, cua: true };
  var ROUNDS = ['r1', 'r2', 'r16', 'oct', 'cua', 'fin'];
  var NEXT_ROUND = { r1: 'r2', r2: 'r16', r16: 'oct', oct: 'cua', cua: 'fin' };
  var CAL_IDS = {
    r1: 'cal-copa-1r',
    r2: 'cal-copa-2r',
    r16: 'cal-copa-16',
    oct_ida: 'cal-copa-8i',
    oct_vta: 'cal-copa-8v',
    cua_ida: 'cal-copa-4i',
    cua_vta: 'cal-copa-4v',
    fin: 'cal-copa-fin'
  };
  var PLAYER_STORE_KEY = 'copa';
  var _copa = {};
  var _simTimers = {};
  var _appliedMeta = {};

  function canonicalTeam(name) {
    if (typeof window.TEAM_ALIASES !== 'undefined') {
      var key = String(name || '').trim().toLowerCase();
      return window.TEAM_ALIASES[key] || String(name || '').trim();
    }
    return String(name || '').trim();
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isHuman(a, b) {
    return HUMAN_TEAMS.indexOf(canonicalTeam(a)) !== -1 || HUMAN_TEAMS.indexOf(canonicalTeam(b)) !== -1;
  }

  function allPlayed(resList, n) {
    if (!resList || resList.length < n) return false;
    for (var i = 0; i < n; i++) {
      if (!resList[i] || !resList[i].jugado) return false;
    }
    return true;
  }

  function isRoundComplete(ronda, matches, resultados) {
    if (!matches || !matches.length) return false;
    if (TWO_LEG[ronda]) {
      var vta = resultados[ronda + '_vta'] || [];
      return allPlayed(vta, matches.length) && vta.slice(0, matches.length).every(function (r) {
        return r && r.winner;
      });
    }
    return allPlayed(resultados[ronda], matches.length);
  }

  function getResultKey(ronda, esVuelta) {
    return TWO_LEG[ronda] ? ronda + (esVuelta ? '_vta' : '_ida') : ronda;
  }

  function getCalendarKey(ronda, esVuelta) {
    if (!TWO_LEG[ronda]) return ronda;
    return ronda + '_' + (esVuelta ? 'vta' : 'ida');
  }

  function getResultList(ronda, esVuelta) {
    return ((_copa.resultados || {})[getResultKey(ronda, esVuelta)] || []);
  }

  function getRowStatValue(row, key, attr) {
    var clsMap = {
      gol: 'ps-gol',
      yel: 'ps-yel',
      red: 'ps-red',
      mvp: 'ps-mvp',
      'pen-prov': 'ps-pen-prov',
      'pen-parado': 'ps-pen-parado',
      'pen-gol': 'ps-pen-gol',
      'falta-gol': 'ps-falta-gol',
      propia: 'ps-propia',
      'pen-fallado': 'ps-pen-fallado'
    };
    var cls = clsMap[key];
    var el = cls ? row.querySelector('.' + cls) : null;
    return el ? Number(el.getAttribute(attr) || 0) : 0;
  }

  function ensureStatSpan(row, key) {
    var clsMap = {
      gol: 'ps-gol',
      yel: 'ps-yel',
      red: 'ps-red',
      mvp: 'ps-mvp',
      'pen-prov': 'ps-pen-prov',
      'pen-parado': 'ps-pen-parado',
      'pen-gol': 'ps-pen-gol',
      'falta-gol': 'ps-falta-gol',
      propia: 'ps-propia',
      'pen-fallado': 'ps-pen-fallado'
    };
    var cls = clsMap[key];
    if (!cls) return null;
    var span = row.querySelector('.' + cls);
    if (!span) {
      span = document.createElement('span');
      span.className = cls;
      span.hidden = true;
      span.setAttribute('data-global', '0');
      span.setAttribute('data-liga', '0');
      span.setAttribute('data-copa', '0');
      span.setAttribute('data-ucl', '0');
      span.setAttribute('data-uecl', '0');
      span.setAttribute('data-europa', '0');
      span.setAttribute('data-super', '0');
      row.appendChild(span);
    }
    return span;
  }

  function updateVisibleStatCell(span) {
    if (!span || !span.parentElement) return;
    var parent = span.parentElement;
    var liga = Number(span.getAttribute('data-liga') || 0);
    var copa = Number(span.getAttribute('data-copa') || 0);
    var superV = Number(span.getAttribute('data-super') || 0);
    var ucl = Number(span.getAttribute('data-ucl') || 0);
    var uecl = Number(span.getAttribute('data-uecl') || 0);
    var europa = Number(span.getAttribute('data-europa') || 0);
    var total = liga + copa + superV + ucl + uecl + europa;
    if (span.classList.contains('ps-pen-parado')) {
      var tirados = Number(span.getAttribute('data-tirado') || 0);
      parent.lastChild && (parent.lastChild.textContent = total + '/' + tirados);
    } else if (span.classList.contains('ps-pen-gol')) {
      var tiradosGol = Number(span.getAttribute('data-tirado') || 0);
      if (parent.classList.contains('frac')) parent.lastChild && (parent.lastChild.textContent = total + '/' + tiradosGol);
      else parent.lastChild && (parent.lastChild.textContent = total);
    } else {
      parent.lastChild && (parent.lastChild.textContent = total);
    }
    parent.classList.toggle('zero', total === 0);
  }

  function setPlayerStat(row, key, amount, storeKey) {
    amount = Number(amount || 0);
    if (!amount) return;
    var span = ensureStatSpan(row, key);
    if (!span) return;
    var compAttr = 'data-' + storeKey;
    var global = Number(span.getAttribute('data-global') || 0) + amount;
    var comp = Number(span.getAttribute(compAttr) || 0) + amount;
    span.setAttribute('data-global', String(Math.max(0, global)));
    span.setAttribute(compAttr, String(Math.max(0, comp)));
    if ((key === 'pen-gol' || key === 'pen-parado') && amount > 0) {
      var tirados = Number(span.getAttribute('data-tirado') || 0);
      span.setAttribute('data-tirado', String(tirados + amount));
    }
    updateVisibleStatCell(span);
  }

  function getRosterIndex() {
    var idx = {};
    document.querySelectorAll('.screen[id]').forEach(function (screen) {
      var rows = screen.querySelectorAll('.plant-row');
      if (!rows.length) return;
      var h2 = screen.querySelector('.sec-hdr h2');
      var team = canonicalTeam(h2 ? h2.textContent.trim() : '');
      if (!team && window.SCREEN_TEAM_FALLBACK) team = window.SCREEN_TEAM_FALLBACK[screen.id] || '';
      rows.forEach(function (row) {
        var nameEl = row.querySelector('.plant-name');
        if (!nameEl || !team) return;
        idx[team + '::' + nameEl.textContent.trim().toLowerCase()] = row;
      });
    });
    return idx;
  }

  function applyPlayerEvents(teamA, teamB, evts) {
    var roster = getRosterIndex();
    (evts || []).forEach(function (ev) {
      var type = ev && ev.type;
      if (!type || type === 'lesion') return;
      var player = Array.isArray(ev.player) ? ev.player[1] : (ev.name || '');
      if (!player) return;
      var teamName = ev.realTeam || (ev.team === 'a' ? teamA : teamB);
      var row = roster[canonicalTeam(teamName) + '::' + String(player).trim().toLowerCase()];
      if (!row) return;
      if (type === 'gol') setPlayerStat(row, 'gol', 1, PLAYER_STORE_KEY);
      else if (type === 'falta-gol') setPlayerStat(row, 'falta-gol', 1, PLAYER_STORE_KEY);
      else if (type === 'pen-gol') setPlayerStat(row, 'pen-gol', 1, PLAYER_STORE_KEY);
      else if (type === 'pen-fallo' || type === 'pen-fallado') setPlayerStat(row, 'pen-fallado', 1, PLAYER_STORE_KEY);
      else if (type === 'pen-parado') setPlayerStat(row, 'pen-parado', 1, PLAYER_STORE_KEY);
      else if (type === 'pen-prov') setPlayerStat(row, 'pen-prov', 1, PLAYER_STORE_KEY);
      else if (type === 'propia') setPlayerStat(row, 'propia', 1, PLAYER_STORE_KEY);
      else if (type === 'mvp') setPlayerStat(row, 'mvp', 1, PLAYER_STORE_KEY);
      else if (type === 'amarilla') setPlayerStat(row, 'yel', 1, PLAYER_STORE_KEY);
      else if (type === 'roja') setPlayerStat(row, 'red', 1, PLAYER_STORE_KEY);
      else if (type === 'd-amarilla') {
        setPlayerStat(row, 'yel', -1, PLAYER_STORE_KEY);
        setPlayerStat(row, 'red', 1, PLAYER_STORE_KEY);
      }
    });
  }

  function ensureStoreCounters(name, teamName, partidos) {
    if (!window.BAJA_STORE) window.BAJA_STORE = {};
    var prev = window.BAJA_STORE[name];
    var obj = (prev && typeof prev === 'object') ? prev : { tipo: 'lesion', liga: 0, copa: 0, europa: 0 };
    obj.tipo = 'lesion';
    obj.copa = Math.max(Number(obj.copa || 0), Number(partidos || 0));
    window.BAJA_STORE[name] = obj;
    if (window.LESION_STORE && window.LESION_STORE[name] && teamName) window.LESION_STORE[name].equipo = teamName;
  }

  function registerCopaInjuries(lesiones) {
    (lesiones || []).forEach(function (l) {
      var name = (l.jugador && l.jugador[1]) || l.nombre || '';
      var teamName = l.teamName || l.equipo || '';
      if (name) ensureStoreCounters(name, teamName, l.partidos || 1);
    });
    if (typeof window._refreshSancionInjList === 'function') window._refreshSancionInjList();
  }

  function decrementCompetitionBajas(compKey, teamA, teamB) {
    if (!window.BAJA_STORE) return;
    var teams = [canonicalTeam(teamA), canonicalTeam(teamB)];
    Object.keys(window.BAJA_STORE).forEach(function (name) {
      var baja = window.BAJA_STORE[name];
      if (!baja || typeof baja !== 'object') return;
      var lesion = window.LESION_STORE && window.LESION_STORE[name];
      var team = canonicalTeam(lesion && lesion.equipo || '');
      if (team && teams.indexOf(team) === -1) return;
      if (typeof baja[compKey] === 'number' && baja[compKey] > 0) baja[compKey]--;
    });
    if (typeof window._refreshSancionInjList === 'function') window._refreshSancionInjList();
  }

  function saveResult(payload) {
    return fetch('/api/copa/guardar_resultado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function getTeamRating(teamName) {
    if (window.TEAM_RATINGS && typeof window.TEAM_RATINGS[teamName] === 'number') return window.TEAM_RATINGS[teamName];
    return 75;
  }

  function getFullSquad(teamName) {
    if (typeof window.sqFromRegistryFull === 'function') return window.sqFromRegistryFull(teamName) || [];
    return [];
  }

  function splitSquad(teamName) {
    var full = getFullSquad(teamName).filter(function (p) { return p && !p.h; });
    if (!full.length) return { active: [], bench: [] };
    var gks = full.filter(function (p) { return p[2] === 'P' || p[2] === '🧤'; });
    var out = full.filter(function (p) { return p[2] !== 'P' && p[2] !== '🧤'; })
      .sort(function (a, b) { return (b[3] || 70) - (a[3] || 70); });
    var active = [];
    if (gks[0]) active.push(gks[0]);
    for (var i = 0; i < out.length && active.length < 11; i++) active.push(out[i]);
    var used = active.map(function (p) { return p[1]; });
    var bench = [];
    gks.slice(1).forEach(function (p) { if (used.indexOf(p[1]) === -1) bench.push(p); });
    full.forEach(function (p) {
      if (used.indexOf(p[1]) === -1 && bench.map(function (x) { return x[1]; }).indexOf(p[1]) === -1) bench.push(p);
    });
    return { active: active.slice(), bench: bench.slice() };
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickWeightedPlayer(list, opts) {
    var pool = (list || []).filter(function (p) {
      if (!p || p[2] === 'P') return false;
      if (opts && opts.exclude && opts.exclude.indexOf(p[1]) !== -1) return false;
      return true;
    });
    if (!pool.length) pool = (list || []).filter(Boolean);
    if (!pool.length) return null;
    var total = 0;
    var weighted = pool.map(function (p) {
      var pos = p[2];
      var base = pos === 'F' ? 12 : pos === 'M' ? 8 : pos === 'D' ? 4 : 2;
      var weight = base + ((p[3] || 70) / 12);
      total += weight;
      return { player: p, upto: total };
    });
    var roll = Math.random() * total;
    for (var i = 0; i < weighted.length; i++) {
      if (roll <= weighted[i].upto) return weighted[i].player;
    }
    return weighted[weighted.length - 1].player;
  }

  function maybeCardEvents(activeA, activeB, ft90) {
    var events = [];
    ['a', 'b'].forEach(function (team) {
      var active = team === 'a' ? activeA : activeB;
      var yellowPlayer = null;
      if (Math.random() < 0.42) {
        yellowPlayer = pickWeightedPlayer(active);
        if (yellowPlayer) {
          events.push({ min: 8 + Math.floor(Math.random() * Math.max(10, ft90 - 12)), ico: '🟨', team: team, player: yellowPlayer, type: 'amarilla' });
          if (Math.random() < 0.08) {
            events.push({ min: Math.min(ft90, 15 + Math.floor(Math.random() * Math.max(12, ft90 - 15))), ico: '🟨🟥', team: team, player: yellowPlayer, type: 'd-amarilla' });
          }
        }
      }
      // Only generate a direct red for a player who has not already received any card,
      // since an expelled player cannot receive further cards (real football rules).
      if (Math.random() < 0.06) {
        var excludeFromRed = yellowPlayer ? [yellowPlayer[1]] : [];
        var redPlayer = pickWeightedPlayer(active, { exclude: excludeFromRed });
        if (redPlayer) {
          events.push({ min: 18 + Math.floor(Math.random() * Math.max(12, ft90 - 20)), ico: '🟥', team: team, player: redPlayer, type: 'roja' });
        }
      }
    });
    return events;
  }

  function simulatePenaltyShootout(local, visitante) {
    var rounds = [];
    var scoreA = 0;
    var scoreB = 0;
    for (var i = 0; i < 5; i++) {
      var aGoal = Math.random() < 0.77;
      var bGoal = Math.random() < 0.77;
      scoreA += aGoal ? 1 : 0;
      scoreB += bGoal ? 1 : 0;
      rounds.push({ a: aGoal, b: bGoal, scoreA: scoreA, scoreB: scoreB });
    }
    while (scoreA === scoreB) {
      var sa = Math.random() < 0.74;
      var sb = Math.random() < 0.74;
      scoreA += sa ? 1 : 0;
      scoreB += sb ? 1 : 0;
      rounds.push({ a: sa, b: sb, scoreA: scoreA, scoreB: scoreB });
    }
    return {
      winner: scoreA > scoreB ? local : visitante,
      scoreA: scoreA,
      scoreB: scoreB,
      rounds: rounds
    };
  }

  function pickMvp(events, scoreA, scoreB, teamA, teamB, sqA, sqB, expelledA, expelledB) {
    var expA = expelledA || {};
    var expB = expelledB || {};
    var expelled = {};
    Object.keys(expA).forEach(function (n) { expelled[n] = true; });
    Object.keys(expB).forEach(function (n) { expelled[n] = true; });
    var scores = {};
    var teams = {};
    (events || []).forEach(function (e) {
      if (!e.player) return;
      var n = e.player[1];
      if (!n) return;
      // An expelled player cannot be MVP
      if (expelled[n]) return;
      var w = 0;
      if (e.type === 'gol') w = 3;
      else if (e.type === 'falta-gol') w = 4;
      else if (e.type === 'pen-gol') w = 2;
      else if (e.type === 'pen-parado') w = 3;
      else if (e.type === 'propia') w = -1;
      else if (e.type === 'mvp') w = 1;
      if (!w) return;
      scores[n] = (scores[n] || 0) + w;
      teams[n] = e.team === 'a' ? teamA : teamB;
    });
    var best = '';
    Object.keys(scores).forEach(function (k) {
      if (!best || scores[k] > scores[best]) best = k;
    });
    if (!best) {
      var winner = scoreA > scoreB ? 'a' : (scoreB > scoreA ? 'b' : (Math.random() < 0.5 ? 'a' : 'b'));
      var sq = winner === 'a' ? sqA : sqB;
      var pool = sq.filter(function (p) { return p[2] !== 'P' && !expelled[p[1]]; });
      if (!pool.length) pool = sq.filter(function (p) { return !expelled[p[1]]; });
      if (!pool.length) pool = sq;
      best = pickRandom(pool)[1];
      teams[best] = winner === 'a' ? teamA : teamB;
    }
    return { name: best, team: teams[best] || teamA };
  }

  function renderPenaltySummary(shootout) {
    if (!shootout || !shootout.rounds) return '';
    return shootout.rounds.map(function (r, i) {
      return 'P' + (i + 1) + ' ' + (r.a ? '✓' : '✗') + '/' + (r.b ? '✓' : '✗');
    }).join(' · ');
  }

  function buildSummary(result, local, visitante) {
    var totalL = Number(result.gl || 0) + Number(result.et_gl || 0);
    var totalV = Number(result.gv || 0) + Number(result.et_gv || 0);
    var pieces = ['90\' ' + local + ' ' + result.gl + '–' + result.gv + ' ' + visitante];
    if ((result.et_gl || 0) || (result.et_gv || 0)) pieces.push('ET ' + totalL + '–' + totalV);
    if (result.pen_winner) {
      var pen = result.pen_score ? ' (' + result.pen_score + ')' : '';
      pieces.push('Penaltis: ' + result.pen_winner + pen);
    }
    if (result.mvp) pieces.push('MVP: ' + result.mvp);
    return pieces.join(' · ');
  }

  function simulateCupMatch(local, visitante, opts) {
    opts = opts || {};
    var twoLeg = !!opts.twoLeg;
    var squadA = splitSquad(local);
    var squadB = splitSquad(visitante);
    var activeA = squadA.active.slice();
    var activeB = squadB.active.slice();
    var benchA = squadA.bench.slice();
    var benchB = squadB.bench.slice();
    var ratingA = getTeamRating(local);
    var ratingB = getTeamRating(visitante);
    var ft90 = 90;
    var evts = [];

    function poisson(lambda) {
      lambda = Math.max(0.05, lambda || 0.05);
      var L = Math.exp(-lambda), k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L && k < 12);
      return k - 1;
    }

    // Generate card events FIRST so expelled players affect score calculation
    var cardEvts = maybeCardEvents(activeA, activeB, ft90);
    cardEvts.forEach(function (ev) {
      ev.realTeam = ev.team === 'a' ? local : visitante;
      evts.push(ev);
    });

    // Build expelled player maps: { playerName -> expulsionMinute }
    var expelledA = {};
    var expelledB = {};
    cardEvts.forEach(function (ev) {
      if (ev.type === 'roja' || ev.type === 'd-amarilla') {
        var expMap = ev.team === 'a' ? expelledA : expelledB;
        if (expMap[ev.player[1]] === undefined) {
          expMap[ev.player[1]] = ev.min;
        }
      }
    });

    /* ── EXPULSIÓN: penalizar 30 PUNTOS planos por cada roja ── */
    var RED_FLAT_PENALTY = 30;
    var adjRatingA = ratingA, adjRatingB = ratingB;
    var redCountA = Object.keys(expelledA).length;
    var redCountB = Object.keys(expelledB).length;
    if (redCountA > 0) {
      var earliestA = 90;
      Object.keys(expelledA).forEach(function(name) { if (expelledA[name] < earliestA) earliestA = expelledA[name]; });
      var remainingA = Math.max(0, (90 - earliestA) / 90);
      adjRatingA = Math.max(30, ratingA - (RED_FLAT_PENALTY * remainingA * redCountA));
    }
    if (redCountB > 0) {
      var earliestB = 90;
      Object.keys(expelledB).forEach(function(name) { if (expelledB[name] < earliestB) earliestB = expelledB[name]; });
      var remainingB = Math.max(0, (90 - earliestB) / 90);
      adjRatingB = Math.max(30, ratingB - (RED_FLAT_PENALTY * remainingB * redCountB));
    }

    var strengthA = adjRatingA * 1.10; // bonus local del 10%
    var strengthB = adjRatingB;
    var shareA = Math.max(0.22, Math.min(0.78, strengthA / Math.max(1, strengthA + strengthB)));
    var baseTotal = 1.75 + (((adjRatingA + adjRatingB) / 2) - 74) * 0.05;
    var expectedA = Math.max(0.15, Math.min(3.8, baseTotal * shareA + Math.max(0, adjRatingA - adjRatingB) * 0.018 + 0.10));
    var expectedB = Math.max(0.10, Math.min(3.3, baseTotal * (1 - shareA) + Math.max(0, adjRatingB - adjRatingA) * 0.018));
    var maxGoals = (adjRatingA >= 88 || adjRatingB >= 88) ? 7 : (adjRatingA >= 84 || adjRatingB >= 84) ? 6 : 5;
    var gl = Math.min(maxGoals, poisson(expectedA));
    var gv = Math.min(maxGoals, poisson(expectedB));

    var goalsOrder = [];
    for (var ga = 0; ga < gl; ga++) goalsOrder.push('a');
    for (var gb = 0; gb < gv; gb++) goalsOrder.push('b');
    goalsOrder.sort(function () { return Math.random() - 0.5; });

    goalsOrder.forEach(function (team) {
      var min = 4 + Math.floor(Math.random() * 84);
      var active = team === 'a' ? activeA : activeB;
      var expelledMap = team === 'a' ? expelledA : expelledB;
      // Exclude players who were expelled before or at this minute
      var excludeExpelled = Object.keys(expelledMap).filter(function (name) {
        return expelledMap[name] <= min;
      });
      var scorer = pickWeightedPlayer(active, { exclude: excludeExpelled });
      if (!scorer) return;
      var typeRoll = Math.random();
      var type = typeRoll < 0.08 ? 'falta-gol' : (typeRoll < 0.17 ? 'pen-gol' : 'gol');
      var ico = type === 'falta-gol' ? '⚽🎯' : type === 'pen-gol' ? '⚽🥅' : '⚽';
      evts.push({ min: min, ico: ico, team: team, player: scorer, type: type, realTeam: team === 'a' ? local : visitante });
      if (type === 'pen-gol' && Math.random() < 0.72) {
        var prov = pickWeightedPlayer(active, { exclude: excludeExpelled.concat([scorer[1]]) }) || scorer;
        evts.push({ min: min, ico: '🤦🥅', team: team, player: prov, type: 'pen-prov', realTeam: team === 'a' ? local : visitante });
      }
    });

    var lesiones = [];
    if (typeof window.generarLesionesPartido === 'function') {
      lesiones = window.generarLesionesPartido(local, visitante, activeA, activeB, benchA, benchB, ft90) || [];
      lesiones.forEach(function (les) {
        if (typeof window.aplicarLesionEnSimulacion === 'function') {
          window.aplicarLesionEnSimulacion(les, activeA, activeB);
        }
      });
      registerCopaInjuries(lesiones);
    }

    var et_gl = 0;
    var et_gv = 0;
    var penWinner = null;
    var shootout = null;
    if (!twoLeg && gl === gv) {
      var etA = Math.random() < 0.30 ? 1 : (Math.random() < 0.06 ? 2 : 0);
      var etB = Math.random() < 0.28 ? 1 : (Math.random() < 0.05 ? 2 : 0);
      et_gl = etA;
      et_gv = etB;
      for (var ea = 0; ea < etA; ea++) {
        var etMinA = 92 + Math.floor(Math.random() * 14);
        var excludeEtA = Object.keys(expelledA).filter(function (name) { return expelledA[name] <= etMinA; });
        var pA = pickWeightedPlayer(activeA, { exclude: excludeEtA });
        if (pA) evts.push({ min: etMinA, ico: '⚽', team: 'a', player: pA, type: 'gol', realTeam: local });
      }
      for (var eb = 0; eb < etB; eb++) {
        var etMinB = 92 + Math.floor(Math.random() * 14);
        var excludeEtB = Object.keys(expelledB).filter(function (name) { return expelledB[name] <= etMinB; });
        var pB = pickWeightedPlayer(activeB, { exclude: excludeEtB });
        if (pB) evts.push({ min: etMinB, ico: '⚽', team: 'b', player: pB, type: 'gol', realTeam: visitante });
      }
      if (gl + et_gl === gv + et_gv) {
        shootout = simulatePenaltyShootout(local, visitante);
        penWinner = shootout.winner;
      }
    }

    evts.sort(function (a, b) { return a.min - b.min; });
    var mvp = pickMvp(evts, gl + et_gl, gv + et_gv, local, visitante, activeA, activeB, expelledA, expelledB);
    evts.push({ min: 120, ico: '⭐', team: mvp.team === local ? 'a' : 'b', player: ['', mvp.name], type: 'mvp', realTeam: mvp.team });

    return {
      gl: gl,
      gv: gv,
      et_gl: et_gl,
      et_gv: et_gv,
      pen_winner: penWinner,
      pen_score: shootout ? (shootout.scoreA + '-' + shootout.scoreB) : '',
      shootout: shootout,
      winner: !twoLeg ? ((gl + et_gl > gv + et_gv) ? local : (gl + et_gl < gv + et_gv ? visitante : penWinner)) : null,
      mvp: mvp.name,
      mvp_team: mvp.team,
      events: evts,
      injuries: lesiones.map(function (les) {
        return {
          jugador: les.jugador,
          nombre: les.jugador && les.jugador[1],
          teamName: les.teamName,
          equipo: les.teamName,
          tipo: les.tipo,
          grado: les.tipo && les.tipo.grado,
          gradoNombre: les.tipo && les.tipo.nombre,
          gradoEmoji: les.tipo && les.tipo.emoji,
          descripcion: (window.LESION_STORE && window.LESION_STORE[les.jugador[1]] && window.LESION_STORE[les.jugador[1]].descripcion) || '',
          partidos: les.partidos
        };
      }),
      summary: '',
      jugado: true
    };
  }

  function syncRoundToCalendar(key, matches, results, esVuelta) {
    var calId = CAL_IDS[key];
    var root = calId && document.getElementById(calId);
    if (!root) return;
    if (!matches || !matches.length) {
      root.innerHTML = '<div class="mrow"><div class="mn">Por definir</div><div class="ms p">vs</div><div class="mn r">Por definir</div></div>';
      return;
    }
    root.innerHTML = matches.map(function (m, idx) {
      var local = esVuelta ? m.v : m.l;
      var visit = esVuelta ? m.l : m.v;
      var res = results && results[idx];
      var score = 'vs';
      var klass = 'ms p';
      if (res && res.jugado) {
        score = res.gl + ' – ' + res.gv;
        if ((res.et_gl || 0) || (res.et_gv || 0)) score += ' ET';
        if (res.pen_winner) score += ' PEN';
        klass = 'ms';
      }
      return '<div class="mrow"><div class="mn">' + escapeHtml(local) + '</div><div class="' + klass + '">' + score + '</div><div class="mn r">' + escapeHtml(visit) + '</div></div>';
    }).join('');
  }

  function syncCalendar(copa) {
    var sorteo = (copa && copa.sorteo) || {};
    var resultados = (copa && copa.resultados) || {};
    syncRoundToCalendar('r1', sorteo.r1 || [], resultados.r1 || [], false);
    syncRoundToCalendar('r2', sorteo.r2 || [], resultados.r2 || [], false);
    syncRoundToCalendar('r16', sorteo.r16 || [], resultados.r16 || [], false);
    syncRoundToCalendar('oct_ida', sorteo.oct || [], resultados.oct_ida || [], false);
    syncRoundToCalendar('oct_vta', sorteo.oct || [], resultados.oct_vta || [], true);
    syncRoundToCalendar('cua_ida', sorteo.cua || [], resultados.cua_ida || [], false);
    syncRoundToCalendar('cua_vta', sorteo.cua || [], resultados.cua_vta || [], true);
    syncRoundToCalendar('fin', sorteo.fin || [], resultados.fin || [], false);
    /* Trigger universal jornada completion check */
    if (typeof window._updateAllJornadaStatus === 'function') setTimeout(window._updateAllJornadaStatus, 100);
  }

  function applyStoredResultMeta(copa) {
    var resultados = (copa && copa.resultados) || {};
    Object.keys(resultados).forEach(function (key) {
      (resultados[key] || []).forEach(function (res, idx) {
        if (!res || !res.jugado || !res.events) return;
        var sig = key + '::' + idx + '::' + (res.summary || '') + '::' + (res.pen_score || '');
        if (_appliedMeta[sig]) return;
        applyPlayerEvents(res.team_a || '', res.team_b || '', res.events);
        registerCopaInjuries(res.injuries || []);
        _appliedMeta[sig] = true;
      });
    });
  }

  function renderResultExtra(res) {
    if (!res) return '';
    var meta = [];
    if (res.summary) meta.push('<div class="copa-row-note">' + escapeHtml(res.summary) + '</div>');
    if (res.injuries && res.injuries.length) {
      meta.push('<div class="copa-row-note copa-row-inj">🩹 ' + res.injuries.map(function (l) {
        return escapeHtml(l.nombre || (l.jugador && l.jugador[1]) || '');
      }).join(', ') + '</div>');
    }
    return meta.join('');
  }

  function getAggregateWinner(match, ida, vuelta) {
    if (!match || !ida || !vuelta || !ida.jugado || !vuelta.jugado) return '';
    if (vuelta.winner) return vuelta.winner;
    var totalL = Number(ida.gl || 0) + Number(vuelta.gv || 0);
    var totalV = Number(ida.gv || 0) + Number(vuelta.gl || 0);
    if (totalL > totalV) return match.l;
    if (totalV > totalL) return match.v;
    return vuelta.pen_winner || '';
  }

  function getBracketRoundData(copa, ronda) {
    var sorteo = (copa && copa.sorteo) || {};
    var resultados = (copa && copa.resultados) || {};
    var matches = sorteo[ronda] || [];
    return matches.map(function (match, idx) {
      if (TWO_LEG[ronda]) {
        var ida = (resultados[ronda + '_ida'] || [])[idx] || null;
        var vuelta = (resultados[ronda + '_vta'] || [])[idx] || null;
        var winner = getAggregateWinner(match, ida, vuelta);
        var status = !ida || !ida.jugado ? 'Ida pendiente' : (!vuelta || !vuelta.jugado ? 'Vuelta pendiente' : 'Eliminatoria cerrada');
        var detail = 'Global pendiente';
        if (ida && ida.jugado) detail = 'Ida: ' + match.l + ' ' + ida.gl + '–' + ida.gv + ' ' + match.v;
        if (ida && ida.jugado && vuelta && vuelta.jugado) {
          var aggL = Number(ida.gl || 0) + Number(vuelta.gv || 0);
          var aggV = Number(ida.gv || 0) + Number(vuelta.gl || 0);
          detail = 'Global: ' + match.l + ' ' + aggL + '–' + aggV + ' ' + match.v;
          if (vuelta.pen_winner) detail += ' · PEN ' + vuelta.pen_winner;
        }
        return {
          home: match.l,
          away: match.v,
          winner: winner,
          played: !!(ida && ida.jugado && vuelta && vuelta.jugado),
          status: status,
          detail: detail,
          mvp: (vuelta && vuelta.mvp) || (ida && ida.mvp) || '',
          neutral: false
        };
      }
      var res = (resultados[ronda] || [])[idx] || null;
      var totalL = res ? Number(res.gl || 0) + Number(res.et_gl || 0) : 0;
      var totalV = res ? Number(res.gv || 0) + Number(res.et_gv || 0) : 0;
      var detailSingle = 'Partido pendiente';
      if (res && res.jugado) {
        detailSingle = match.l + ' ' + res.gl + '–' + res.gv + ' ' + match.v;
        if ((res.et_gl || 0) || (res.et_gv || 0)) detailSingle += ' · ET ' + totalL + '–' + totalV;
        if (res.pen_winner) detailSingle += ' · PEN ' + res.pen_winner;
      }
      return {
        home: match.l,
        away: match.v,
        winner: res && res.winner || '',
        played: !!(res && res.jugado),
        status: res && res.jugado ? 'Partido jugado' : 'Pendiente',
        detail: detailSingle,
        mvp: res && res.mvp || '',
        neutral: ronda === 'fin'
      };
    });
  }

  function makePlaceholderList(label, total) {
    var out = [];
    for (var i = 0; i < total; i++) out.push(label + ' ' + (i + 1));
    return out;
  }

  function getRoundAdvancers(copa, ronda, expected) {
    var ties = getBracketRoundData(copa, ronda);
    var out = [];
    ties.forEach(function (tie, idx) {
      out.push(tie.winner || ('Ganador ' + ROUND_LABEL[ronda] + ' ' + (idx + 1)));
    });
    while (out.length < expected) out.push('Ganador ' + ROUND_LABEL[ronda] + ' ' + (out.length + 1));
    return out.slice(0, expected);
  }

  function buildPlaceholderParticipants(copa, ronda, slots) {
    if (ronda === 'r1') return makePlaceholderList('Plaza Copa', slots * 2);
    if (ronda === 'r2') return getRoundAdvancers(copa, 'r1', 2).concat(makePlaceholderList('Cabeza de serie R2', (slots * 2) - 2));
    if (ronda === 'r16') return getRoundAdvancers(copa, 'r2', 4).concat(makePlaceholderList('Cabeza de serie Dieciseisavos', (slots * 2) - 4));
    if (ronda === 'oct') return getRoundAdvancers(copa, 'r16', slots * 2);
    if (ronda === 'cua') return getRoundAdvancers(copa, 'oct', slots * 2);
    if (ronda === 'fin') return getRoundAdvancers(copa, 'cua', slots * 2);
    return makePlaceholderList('Por definir', slots * 2);
  }

  function getNextRoundSlotLabel(ronda, idx) {
    var next = NEXT_ROUND[ronda];
    if (!next) return 'Campeón';
    return ROUND_LABEL[next] + ' · cruce ' + (Math.floor(idx / 2) + 1);
  }

  function getBracketStageData(copa, meta) {
    var ties = getBracketRoundData(copa, meta.key);
    if (ties.length) return ties.slice(0, meta.slots);
    var participants = buildPlaceholderParticipants(copa, meta.key, meta.slots);
    var out = [];
    for (var i = 0; i < meta.slots; i++) {
      out.push({
        home: participants[i * 2] || 'Por definir',
        away: participants[(i * 2) + 1] || 'Por definir',
        winner: '',
        played: false,
        status: meta.key === 'r1' ? 'Cuadro inicial' : 'Pendiente de sorteo',
        detail: meta.key === 'fin'
          ? 'La final se completará cuando se definan los dos finalistas.'
          : 'El ganador avanzará a ' + getNextRoundSlotLabel(meta.key, i) + '.',
        mvp: '',
        neutral: meta.key === 'fin',
        placeholder: true
      });
    }
    return out;
  }

  function renderBracket(copa) {
    var root = document.getElementById('copa-bracket-root');
    var summary = document.getElementById('copa-bracket-summary');
    if (!root) return;
    var roundMeta = [
      { key: 'r1', label: '1ª Ronda', subtitle: 'Arranque del torneo', slots: 2, rowSpan: 4 },
      { key: 'r2', label: '2ª Ronda', subtitle: 'Se suman nuevos equipos', slots: 4, rowSpan: 2 },
      { key: 'r16', label: 'Dieciseisavos', subtitle: 'Cuadro principal', slots: 8, rowSpan: 1 },
      { key: 'oct', label: 'Octavos', subtitle: 'Ida y vuelta', slots: 4, rowSpan: 2 },
      { key: 'cua', label: 'Cuartos', subtitle: 'Ida y vuelta', slots: 2, rowSpan: 4 },
      { key: 'fin', label: 'Final', subtitle: 'Partido único · sede neutral', slots: 1, rowSpan: 8 }
    ];
    var clasificados = (copa && copa.clasificados) || {};
    if (summary) {
      var champion = clasificados.campeon;
      var completed = roundMeta.filter(function (meta) {
        return isRoundComplete(meta.key, ((copa && copa.sorteo) || {})[meta.key] || [], (copa && copa.resultados) || {});
      }).length;
      summary.innerHTML = champion
        ? '<div class="copa-bracket-banner done">🏆 Campeón actual: <b>' + escapeHtml(champion) + '</b><span> · Cuadro completado</span></div>'
        : '<div class="copa-bracket-banner">🗂️ El cuadro ya queda visible desde el inicio y se rellena automáticamente con clasificados, cruces y resultados conforme avanza la Copa.<span> · Rondas cerradas: ' + completed + '/' + roundMeta.length + '</span></div>';
    }
    root.innerHTML = '<div class="copa-bracket-board">' + roundMeta.map(function (meta, stageIdx) {
      var ties = getBracketStageData(copa, meta);
      var clasif = clasificados[meta.key] || [];
      var stageClass = 'copa-bracket-stage';
      if (stageIdx === 0) stageClass += ' first';
      if (stageIdx === roundMeta.length - 1) stageClass += ' last';
      var inner = ties.length ? ties.map(function (tie, tieIdx) {
        var homeWin = tie.winner && canonicalTeam(tie.winner) === canonicalTeam(tie.home);
        var awayWin = tie.winner && canonicalTeam(tie.winner) === canonicalTeam(tie.away);
        var stageNote = tie.played
          ? (tie.winner ? 'Clasifica: ' + tie.winner : 'Partido cerrado')
          : (tie.placeholder ? getNextRoundSlotLabel(meta.key, tieIdx) : 'Pendiente');
        var rowStart = (tieIdx * meta.rowSpan) + 1;
        return '<div class="copa-bracket-slot" style="grid-row:' + rowStart + ' / span ' + meta.rowSpan + ';">'
          + '<div class="copa-bracket-card' + (tie.played ? ' played' : '') + (tie.placeholder ? ' placeholder' : '') + '">'
          + '<div class="copa-bracket-teams">'
          + '<div class="copa-bracket-team' + (homeWin ? ' winner' : '') + (isHuman(tie.home, '') ? ' human' : '') + '"><span class="seed">●</span><span>' + escapeHtml(tie.home) + '</span></div>'
          + '<div class="copa-bracket-team' + (awayWin ? ' winner' : '') + (isHuman(tie.away, '') ? ' human' : '') + '"><span class="seed">●</span><span>' + escapeHtml(tie.away) + '</span></div>'
          + '</div>'
          + '<div class="copa-bracket-status">' + escapeHtml(tie.status + (tie.neutral ? ' · Neutral' : '')) + '</div>'
          + '<div class="copa-bracket-detail">' + escapeHtml(tie.detail) + '</div>'
          + '<div class="copa-bracket-route">' + escapeHtml(stageNote) + '</div>'
          + (tie.mvp ? '<div class="copa-bracket-mvp">⭐ MVP: ' + escapeHtml(tie.mvp) + '</div>' : '')
          + '</div>'
          + '</div>';
      }).join('') : '<div class="copa-bracket-empty">Pendiente de sorteo</div>';
      if (clasif.length) {
        inner += '<div class="copa-bracket-qualified"><b>Clasificados:</b> ' + clasif.map(function (team) {
          return '<span class="copa-bracket-pill' + (isHuman(team, '') ? ' human' : '') + '">' + escapeHtml(team) + '</span>';
        }).join('') + '</div>';
      }
      return '<div class="' + stageClass + '">'
        + '<div class="copa-bracket-round-head"><div class="copa-bracket-round-title">' + escapeHtml(meta.label) + '</div>'
        + '<div class="copa-bracket-round-sub">' + escapeHtml(meta.subtitle) + '</div></div>'
        + '<div class="copa-bracket-round-body"><div class="copa-bracket-lane">' + inner + '</div></div>'
        + '</div>';
    }).join('') + '</div>';
  }

  function renderBlock(blockId, label, matches, results, ronda, esVuelta) {
    var inner = '';
    var hasResults = results && results.some(function (r) { return r && r.jugado; });
    if (!matches || !matches.length) {
      inner = '<div class="mrow"><div class="mn" style="color:rgba(255,255,255,.28);font-style:italic">Pendiente de sorteo</div></div>';
    } else {
      matches.forEach(function (m, idx) {
        var local = esVuelta ? m.v : m.l;
        var visit = esVuelta ? m.l : m.v;
        var res = results && results[idx];
        var human = isHuman(m.l, m.v);
        if (res && res.jugado) {
          var totalL = Number(res.gl || 0) + Number(res.et_gl || 0);
          var totalV = Number(res.gv || 0) + Number(res.et_gv || 0);
          var etTxt = ((res.et_gl || 0) || (res.et_gv || 0)) ? ' <span class="copa-et">(' + totalL + '-' + totalV + ' ET)</span>' : '';
          var penTxt = res.pen_winner ? ' <span class="copa-pen">PEN</span>' : '';
          inner += '<div class="mrow copa-mrow copa-mrow-done" data-done="1">'
            + '<div class="mn">' + escapeHtml(local) + '</div>'
            + '<div class="ms copa-sc">' + res.gl + ' – ' + res.gv + etTxt + penTxt + '</div>'
            + '<div class="mn r">' + escapeHtml(visit) + '</div>'
            + '</div>'
            + renderResultExtra(res);
        } else {
          var btn = human
            ? '<button class="copa-btn-play" onclick="window.copaJugar(\'' + ronda + '\',' + idx + ',' + (esVuelta ? 1 : 0) + ')">▶ Jugar</button>'
            : '<button class="copa-btn-sim" onclick="window.copaSimIA(\'' + ronda + '\',' + idx + ',' + (esVuelta ? 1 : 0) + ')">⚡ Sim 30s</button>';
          inner += '<div class="mrow copa-mrow">'
            + '<div class="mn">' + escapeHtml(local) + '</div>'
            + '<div class="ms p copa-sc-pen" id="csc-' + blockId + '-' + idx + '">vs</div>'
            + '<div class="mn r">' + escapeHtml(visit) + '</div>'
            + '<div class="copa-act">' + btn + '</div>'
            + '</div>';
        }
      });
    }
    var openClass = !hasResults ? ' open' : '';
    return '<div class="jblock copa-jblock">'
      + '<button class="jbtn c-copa copa-gold-btn" onclick="tog(\'' + blockId + '\')">'
      + '<div class="pdot">▶</div>🏆 <b>Copa del Rey</b> — ' + label
      + '</button>'
      + '<div class="jmatches' + openClass + '" id="' + blockId + '">' + inner + '</div>'
      + '</div>';
  }

  function ensureHumanPanelEnhancements() {
    var box = document.querySelector('#copa-human-panel .copa-panel-box');
    if (!box || document.getElementById('chp-extra-tools')) return;
    var wrap = document.createElement('div');
    wrap.id = 'chp-extra-tools';
    wrap.innerHTML = ''
      + '<div class="chp-section-label">📋 Eventos para fichas del jugador</div>'
      + '<div class="chp-event-row">'
      + '  <select id="chp-evt-type" class="chp-mini-select">'
      + '    <option value="gol">⚽ Gol</option>'
      + '    <option value="falta-gol">⚽🎯 Gol de falta</option>'
      + '    <option value="pen-gol">⚽🥅 Penalti gol</option>'
      + '    <option value="pen-fallo">❌🥅 Penalti fallado</option>'
      + '    <option value="pen-prov">🤦🥅 Penalti provocado</option>'
      + '    <option value="pen-parado">🖐🥅 Penalti parado</option>'
      + '    <option value="propia">⚽🚫 Autogol</option>'
      + '    <option value="amarilla">🟨 Amarilla</option>'
      + '    <option value="d-amarilla">🟨🟥 Doble amarilla</option>'
      + '    <option value="roja">🟥 Roja</option>'
      + '  </select>'
      + '  <select id="chp-evt-team" class="chp-mini-select"><option value="a">Local</option><option value="b">Visitante</option></select>'
      + '  <select id="chp-evt-player" class="chp-mini-select"></select>'
      + '  <button class="copa-btn-sim" type="button" onclick="window.chpAddEvent()">+ Evento</button>'
      + '</div>'
      + '<div class="chp-event-row">'
      + '  <button class="copa-btn-play" type="button" onclick="window.chpAddRandomInjury()">🩹 Lesión partido</button>'
      + '  <span class="chp-helper">Si el lesionado pertenece a un equipo humano, se guarda en la baja de Copa.</span>'
      + '</div>'
      + '<div class="chp-acta" id="chp-event-list"><div class="chp-event-empty">Sin eventos añadidos</div></div>';
    var saveBtn = box.querySelector('.chp-btn-guardar');
    box.insertBefore(wrap, saveBtn);
  }

  function refreshHumanPlayerSelect() {
    var panel = document.getElementById('copa-human-panel');
    if (!panel || !panel.classList.contains('show')) return;
    var teamSide = document.getElementById('chp-evt-team').value;
    var local = document.getElementById('chp-local').textContent.trim();
    var visitante = document.getElementById('chp-visit').textContent.trim();
    var teamName = teamSide === 'a' ? local : visitante;
    var select = document.getElementById('chp-evt-player');
    if (!select) return;
    var squad = getFullSquad(teamName).filter(function (p) { return p && !p.h; });
    select.innerHTML = squad.map(function (p) {
      var disabled = p[5] ? ' disabled' : '';
      return '<option value="' + escapeHtml(p[0]) + '|' + escapeHtml(p[1]) + '"' + disabled + '>' + escapeHtml(p[0] + '. ' + p[1]) + (p[5] ? ' 🚫' : '') + '</option>';
    }).join('');
  }

  function renderHumanEventList() {
    var list = document.getElementById('chp-event-list');
    var panel = document.getElementById('copa-human-panel');
    if (!list || !panel) return;
    var evts = panel._manualEvents || [];
    if (!evts.length) {
      list.innerHTML = '<div class="chp-event-empty">Sin eventos añadidos</div>';
      return;
    }
    list.innerHTML = evts.map(function (ev, idx) {
      var name = Array.isArray(ev.player) ? ev.player[1] : (ev.nombre || '');
      var team = ev.realTeam || (ev.team === 'a' ? document.getElementById('chp-local').textContent.trim() : document.getElementById('chp-visit').textContent.trim());
      var txt = (ev.ico || '•') + ' ' + escapeHtml(name) + ' · ' + escapeHtml(team);
      if (ev.type === 'lesion') txt += ' · ' + escapeHtml((ev.gradoEmoji || '🩹') + ' ' + (ev.gradoNombre || 'Lesión') + ' · ' + (ev.partidos || 1) + 'P');
      return '<div class="chp-event-item">' + txt + '<button type="button" class="chp-del" onclick="window.chpRemoveEvent(' + idx + ')">✕</button></div>';
    }).join('');
  }

  function buildPenaltyTeamOptions(local, visitante) {
    var select = document.getElementById('chp-pen-winner');
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona ganador</option>'
      + '<option value="' + escapeHtml(local) + '">' + escapeHtml(local) + '</option>'
      + '<option value="' + escapeHtml(visitante) + '">' + escapeHtml(visitante) + '</option>';
  }

  function applyHumanResultMeta(payload, local, visitante) {
    applyPlayerEvents(local, visitante, payload.events || []);
    registerCopaInjuries(payload.injuries || []);
    decrementCompetitionBajas('copa', local, visitante);
  }

  function stopSimTimer(key) {
    var state = _simTimers[key];
    if (!state) return;
    clearInterval(state.interval);
    delete _simTimers[key];
  }

  function runSimCountdown(domId, totalSeconds, onEnd) {
    stopSimTimer(domId);
    var el = document.getElementById(domId);
    var remaining = totalSeconds;
    if (el) el.textContent = '⏱ ' + remaining + 's';
    _simTimers[domId] = {
      interval: setInterval(function () {
        remaining--;
        if (el) {
          if (remaining > 10) el.textContent = '⏱ ' + remaining + 's';
          else if (remaining > 0) el.textContent = '🔥 ' + remaining + 's';
        }
        if (remaining <= 0) {
          stopSimTimer(domId);
          onEnd();
        }
      }, 1000)
    };
  }

  function saveSimulatedMatch(ronda, idx, esVuelta, match, result) {
    var payload = {
      ronda: ronda,
      idx: idx,
      es_vuelta: !!esVuelta,
      gl: result.gl,
      gv: result.gv,
      et_gl: result.et_gl || 0,
      et_gv: result.et_gv || 0,
      pen_winner: result.pen_winner || null,
      mvp: result.mvp || '',
      events: result.events || [],
      injuries: result.injuries || [],
      summary: buildSummary(result, match.local, match.visitante),
      pen_score: result.pen_score || '',
      team_a: match.local,
      team_b: match.visitante,
      jugado: true
    };
    return saveResult(payload).then(function (d) {
      if (d.ok) {
        applyHumanResultMeta(payload, match.local, match.visitante);
        copaRender(d.copa);
      }
      return d;
    });
  }

  function init() {
    injectStyles();
    ensureHumanPanelEnhancements();
    fetch('/api/copa/state')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _copa = d.copa || {};
        applyStoredResultMeta(_copa);
        copaRender(_copa);
      })
      .catch(function (e) { console.error('[Copa] state error', e); });
  }

  function injectStyles() {
    if (document.getElementById('copa-engine-styles')) return;
    var style = document.createElement('style');
    style.id = 'copa-engine-styles';
    style.textContent = ''
      + '.copa-gold-btn{background:linear-gradient(135deg,#7b5a00,#c89b2c,#f8e3a0,#c89b2c,#7b5a00)!important;color:#fff!important;border:1px solid rgba(255,215,120,.35)!important;box-shadow:0 8px 18px rgba(0,0,0,.2)}'
      + '.copa-jblock .jmatches{border-color:rgba(240,192,64,.18)}'
      + '.copa-row-note{font-size:11px;color:rgba(255,255,255,.64);padding:2px 10px 8px 10px;line-height:1.4}'
      + '.copa-row-inj{color:#f4c970}'
      + '.copa-mrow-done{margin-bottom:0}'
      + '.copa-sim-all{margin-left:8px}'
      + '.chp-event-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}'
      + '.chp-mini-select{flex:1;min-width:120px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:8px;padding:10px}'
      + '.chp-helper{font-size:11px;color:rgba(255,255,255,.55)}'
      + '.chp-acta{max-height:180px;overflow:auto;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;margin-bottom:12px}'
      + '.chp-event-item{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:12px;color:#fff}'
      + '.chp-event-item:last-child{border-bottom:none}'
      + '.chp-event-empty{font-size:12px;color:rgba(255,255,255,.45)}'
      + '.chp-del{background:transparent;border:none;color:#ff8d8d;cursor:pointer;font-size:12px}'
      + '.copa-live-mini{font-size:12px;color:#f0c040;margin-top:4px}'
      + '.copa-btn-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}'
      + '.copa-summary-banner{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:rgba(240,192,64,.08);border:1px solid rgba(240,192,64,.18);font-size:12px;color:#f6e0a0}'
      + '.copa-clasificados{margin:6px 0 12px;padding:8px 12px;border-radius:10px;background:rgba(255,215,120,.06);border:1px solid rgba(255,215,120,.12)}'
      + '.copa-bracket-wrap{padding:6px 18px 36px}'
      + '.copa-bracket-banner{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:12px;background:rgba(255,215,120,.08);border:1px solid rgba(255,215,120,.18);color:#f6e0a0;font-size:12px;line-height:1.5;margin-bottom:14px}'
      + '.copa-bracket-banner span{color:rgba(255,255,255,.62)}'
      + '.copa-bracket-banner.done{background:rgba(255,215,120,.14);box-shadow:0 10px 24px rgba(0,0,0,.18)}'
      + '.copa-bracket-grid{overflow-x:auto;padding-bottom:10px}'
      + '.copa-bracket-board{display:flex;gap:18px;align-items:stretch;min-width:max-content;padding-right:8px}'
      + '.copa-bracket-stage{width:248px;flex:0 0 248px;background:linear-gradient(180deg,rgba(24,15,2,.98),rgba(11,11,14,.96));border:1px solid rgba(255,215,120,.14);border-radius:16px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.22)}'
      + '.copa-bracket-round-head{padding:12px 14px;border-bottom:1px solid rgba(255,215,120,.1);background:linear-gradient(135deg,rgba(123,90,0,.55),rgba(15,15,18,.25))}'
      + '.copa-bracket-round-title{font-family:Oswald,sans-serif;font-size:15px;letter-spacing:1.6px;color:#f6d16f;text-transform:uppercase}'
      + '.copa-bracket-round-sub{font-size:11px;color:rgba(255,255,255,.52);margin-top:2px}'
      + '.copa-bracket-round-body{padding:12px}'
      + '.copa-bracket-lane{display:grid;grid-template-rows:repeat(8,minmax(74px,1fr));gap:10px;min-height:684px;position:relative}'
      + '.copa-bracket-slot{display:flex;align-items:center;position:relative}'
      + '.copa-bracket-stage:not(.first) .copa-bracket-slot::before{content:"";position:absolute;left:-19px;top:0;bottom:0;border-left:2px solid rgba(255,215,120,.14)}'
      + '.copa-bracket-stage:not(.first) .copa-bracket-slot::after{content:"";position:absolute;left:-19px;top:50%;width:19px;border-top:2px solid rgba(255,215,120,.14)}'
      + '.copa-bracket-stage:not(.last) .copa-bracket-card::after{content:"";position:absolute;right:-19px;top:50%;width:19px;border-top:2px solid rgba(255,215,120,.14)}'
      + '.copa-bracket-card{position:relative;width:100%;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);border-radius:12px;padding:10px 10px 9px}'
      + '.copa-bracket-card.played{border-color:rgba(255,215,120,.22);background:rgba(255,215,120,.05)}'
      + '.copa-bracket-card.placeholder{border-style:dashed;background:rgba(255,255,255,.02)}'
      + '.copa-bracket-teams{display:grid;gap:6px}'
      + '.copa-bracket-team{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.78);font-weight:700}'
      + '.copa-bracket-team .seed{font-size:9px;color:rgba(255,255,255,.24)}'
      + '.copa-bracket-team.winner{color:#ffd76a}'
      + '.copa-bracket-team.human{color:#91d0ff}'
      + '.copa-bracket-team.winner .seed{color:#ffd76a}'
      + '.copa-bracket-status{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,.44);margin-top:10px}'
      + '.copa-bracket-detail{font-size:12px;color:rgba(255,255,255,.86);margin-top:4px;line-height:1.45}'
      + '.copa-bracket-route{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:rgba(255,215,120,.82);line-height:1.35}'
      + '.copa-bracket-mvp{font-size:11px;color:#f2cd66;margin-top:6px}'
      + '.copa-bracket-empty{border:1px dashed rgba(255,255,255,.12);border-radius:12px;padding:16px 12px;font-size:12px;text-align:center;color:rgba(255,255,255,.38);align-self:start}'
      + '.copa-bracket-qualified{grid-column:1/-1;align-self:end;margin-top:2px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.74);line-height:1.7}'
      + '.copa-bracket-pill{display:inline-flex;align-items:center;padding:2px 8px;margin:4px 6px 0 0;border-radius:999px;background:rgba(255,215,120,.12);border:1px solid rgba(255,215,120,.18);color:#f6d16f}'
      + '.copa-bracket-pill.human{background:rgba(90,180,255,.12);border-color:rgba(90,180,255,.18);color:#9ad6ff}'
      + '@media (max-width:760px){.copa-bracket-wrap{padding-left:10px;padding-right:10px}.copa-bracket-stage{width:220px;flex-basis:220px}.copa-bracket-board{gap:14px}.copa-bracket-lane{min-height:620px;grid-template-rows:repeat(8,minmax(66px,1fr))}}';
    document.head.appendChild(style);
  }

  function copaRender(copa) {
    var container = document.getElementById('copa-jlist');
    if (!container) return;
    _copa = copa || {};
    applyStoredResultMeta(_copa);
    var sorteo = _copa.sorteo || {};
    var resultados = _copa.resultados || {};
    var clasificados = _copa.clasificados || {};
    var html = '';

    if (!sorteo.r1 || !sorteo.r1.length) {
      html = '<div class="copa-start-wrap">'
        + '<p class="copa-info">🏆 Copa del Rey — Temporada 2025/26</p>'
        + '<button class="copa-btn-sortear" onclick="window.copaSortear(\'r1\')">🎯 Iniciar Copa — Sortear 1ª Ronda</button>'
        + '</div>';
      container.innerHTML = html;
      syncCalendar(_copa);
      renderBracket(_copa);
      return;
    }

    ROUNDS.forEach(function (ronda) {
      var matches = sorteo[ronda] || [];
      var label = ROUND_LABEL[ronda] || ronda;
      var clasif = clasificados[ronda] || [];
      if (TWO_LEG[ronda]) {
        html += renderBlock(ronda + '_ida', label + ' — Ida', matches, resultados[ronda + '_ida'], ronda, false);
        html += renderBlock(ronda + '_vta', label + ' — Vuelta', matches, resultados[ronda + '_vta'], ronda, true);
        html += '<div class="copa-btn-row">'
          + '<button class="copa-btn-sim copa-sim-all" onclick="window.copaSimTodosIA(\'' + ronda + '\',0)">⚡ Simular IA Ida</button>'
          + '<button class="copa-btn-sim copa-sim-all" onclick="window.copaSimTodosIA(\'' + ronda + '\',1)">⚡ Simular IA Vuelta</button>'
          + '</div>';
      } else {
        html += renderBlock(ronda, label, matches, resultados[ronda], ronda, false);
        html += '<div class="copa-btn-row"><button class="copa-btn-sim copa-sim-all" onclick="window.copaSimTodosIA(\'' + ronda + '\',0)">⚡ Simular IA ' + label + '</button></div>';
      }
      if (matches.length && isRoundComplete(ronda, matches, resultados) && !clasif.length) {
        html += '<div class="copa-round-action"><button class="copa-btn-avanzar" onclick="window.copaClasificar(\'' + ronda + '\')">✅ Confirmar clasificados — ' + label + '</button></div>';
      }
      if (clasif.length) {
        html += '<div class="copa-clasificados"><span class="copa-clas-title">Clasificados ' + label + ':</span> '
          + clasif.map(function (t) {
            return '<span class="copa-clas-team' + (isHuman(t, '') ? ' human' : '') + '">' + escapeHtml(t) + '</span>';
          }).join('')
          + '</div>';
      }
      var nextRound = NEXT_ROUND[ronda];
      if (nextRound && clasif.length && !(sorteo[nextRound] && sorteo[nextRound].length)) {
        html += '<div class="copa-round-action"><button class="copa-btn-sortear" onclick="window.copaSortear(\'' + nextRound + '\')">🎯 Sortear ' + ROUND_LABEL[nextRound] + '</button></div>';
      }
    });

    if (clasificados.campeon) {
      html += '<div class="copa-champion"><div class="copa-champion-trophy">🏆</div><div class="copa-champion-name">'
        + escapeHtml(clasificados.campeon) + '</div><div class="copa-champion-label">CAMPEÓN DE LA COPA DEL REY</div></div>';
    }

    html += '<div class="copa-round-action" style="margin-top:18px;opacity:.6"><button class="copa-btn-reset" onclick="window.copaReiniciar()">🔄 Reiniciar Copa</button></div>';
    container.innerHTML = html;
    syncCalendar(_copa);
    renderBracket(_copa);
  }

  window.copaSortear = function (ronda) {
    fetch('/api/copa/sorteo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ronda: ronda })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) copaRender(d.copa);
        else alert('❌ Error sorteo: ' + (d.error || ''));
      });
  };

  window.copaSimIA = function (ronda, idx, esVuelta) {
    var matches = (_copa.sorteo || {})[ronda] || [];
    if (idx >= matches.length) return;
    var m = matches[idx];
    var local = esVuelta ? m.v : m.l;
    var visitante = esVuelta ? m.l : m.v;
    var domId = 'csc-' + getResultKey(ronda, !!esVuelta) + '-' + idx;
    var result = simulateCupMatch(local, visitante, { twoLeg: !!TWO_LEG[ronda] });
    var totalSeconds = 30 + (((result.et_gl || 0) || (result.et_gv || 0)) ? 10 : 0) + (result.pen_winner ? 4 : 0);
    runSimCountdown(domId, totalSeconds, function () {
      saveSimulatedMatch(ronda, idx, !!esVuelta, { local: local, visitante: visitante }, result)
        .then(function (d) {
          if (!d.ok) alert('❌ ' + (d.error || 'Error guardando simulación')); 
        });
    });
  };

  window.copaSimTodosIA = function (ronda, esVuelta) {
    var matches = (_copa.sorteo || {})[ronda] || [];
    var resList = getResultList(ronda, !!esVuelta);
    var pending = [];
    matches.forEach(function (m, idx) {
      if (isHuman(m.l, m.v)) return;
      if (resList[idx] && resList[idx].jugado) return;
      pending.push(idx);
    });
    if (!pending.length) {
      alert('No hay partidos IA pendientes en esta fase.');
      return;
    }
    var i = 0;
    function next() {
      if (i >= pending.length) return;
      var idx = pending[i++];
      window.copaSimIA(ronda, idx, !!esVuelta);
      var domId = 'csc-' + getResultKey(ronda, !!esVuelta) + '-' + idx;
      var timer = _simTimers[domId];
      var wait = timer ? 1000 : 31000;
      setTimeout(next, wait + 500);
    }
    next();
  };

  window.copaClasificar = function (ronda) {
    fetch('/api/copa/clasificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ronda: ronda })
    }).then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) copaRender(d.copa); });
  };

  window.copaReiniciar = function () {
    if (!confirm('¿Reiniciar Copa del Rey? Se perderán todos los resultados y bajas de Copa seguirán en ficha hasta agotarse.')) return;
    fetch('/api/copa/reiniciar', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) copaRender({}); });
  };

  window.copaJugar = function (ronda, idx, esVuelta) {
    ensureHumanPanelEnhancements();
    var matches = (_copa.sorteo || {})[ronda] || [];
    if (idx >= matches.length) return;
    var m = matches[idx];
    var local = esVuelta ? m.v : m.l;
    var visitante = esVuelta ? m.l : m.v;
    var twoLeg = !!TWO_LEG[ronda];
    var panel = document.getElementById('copa-human-panel');
    if (!panel) return;
    panel.dataset.ronda = ronda;
    panel.dataset.idx = idx;
    panel.dataset.vuelta = esVuelta ? '1' : '0';
    panel.dataset.twoleg = twoLeg ? '1' : '0';
    panel._manualEvents = [];
    panel._manualInjuries = [];

    document.getElementById('chp-local').textContent = local;
    document.getElementById('chp-visit').textContent = visitante;
    document.getElementById('chp-gl').value = '0';
    document.getElementById('chp-gv').value = '0';
    document.getElementById('chp-et-gl').value = '0';
    document.getElementById('chp-et-gv').value = '0';
    document.getElementById('chp-mvp').value = '';
    document.getElementById('chp-et-section').style.display = 'none';
    document.getElementById('chp-pen-section').style.display = 'none';
    buildPenaltyTeamOptions(local, visitante);
    renderHumanEventList();
    refreshHumanPlayerSelect();

    var aggEl = document.getElementById('chp-agg-info');
    if (esVuelta && aggEl) {
      var ida = (((_copa.resultados || {})[ronda + '_ida'] || [])[idx]) || null;
      if (ida) {
        aggEl.textContent = 'Ida: ' + m.l + ' ' + ida.gl + ' – ' + ida.gv + ' ' + m.v;
        aggEl.style.display = 'block';
      } else {
        aggEl.textContent = 'Ida pendiente: primero debes cerrar la ida.';
        aggEl.style.display = 'block';
      }
    } else if (aggEl) {
      aggEl.style.display = 'none';
    }

    panel.classList.add('show');
  };

  window.chpCheckEmpate = function () {
    var gl = parseInt(document.getElementById('chp-gl').value, 10) || 0;
    var gv = parseInt(document.getElementById('chp-gv').value, 10) || 0;
    var panel = document.getElementById('copa-human-panel');
    var twoLeg = panel && panel.dataset.twoleg === '1';
    var esVuelta = panel && panel.dataset.vuelta === '1';
    if (!twoLeg && gl === gv) document.getElementById('chp-et-section').style.display = 'block';
    else if (!twoLeg) document.getElementById('chp-et-section').style.display = 'none';
    if (twoLeg && esVuelta) _chpCheckAggregate();
  };

  function _chpCheckAggregate() {
    var panel = document.getElementById('copa-human-panel');
    var ronda = panel.dataset.ronda;
    var idx = parseInt(panel.dataset.idx, 10);
    var ida = (((_copa.resultados || {})[ronda + '_ida'] || [])[idx]) || {};
    var glVta = parseInt(document.getElementById('chp-gl').value, 10) || 0;
    var gvVta = parseInt(document.getElementById('chp-gv').value, 10) || 0;
    var totalL = Number(ida.gl || 0) + gvVta;
    var totalV = Number(ida.gv || 0) + glVta;
    document.getElementById('chp-pen-section').style.display = totalL === totalV ? 'block' : 'none';
  }

  window.chpCheckET = function () {
    var gl = parseInt(document.getElementById('chp-gl').value, 10) || 0;
    var gv = parseInt(document.getElementById('chp-gv').value, 10) || 0;
    var etGl = parseInt(document.getElementById('chp-et-gl').value, 10) || 0;
    var etGv = parseInt(document.getElementById('chp-et-gv').value, 10) || 0;
    document.getElementById('chp-pen-section').style.display = (gl + etGl === gv + etGv) ? 'block' : 'none';
  };

  window.chpAddEvent = function () {
    var panel = document.getElementById('copa-human-panel');
    var evType = document.getElementById('chp-evt-type').value;
    var side = document.getElementById('chp-evt-team').value;
    var playerVal = document.getElementById('chp-evt-player').value;
    if (!playerVal) return;
    var parts = playerVal.split('|');
    var local = document.getElementById('chp-local').textContent.trim();
    var visitante = document.getElementById('chp-visit').textContent.trim();
    var teamName = side === 'a' ? local : visitante;
    var icoMap = {
      gol: '⚽', 'falta-gol': '⚽🎯', 'pen-gol': '⚽🥅', 'pen-fallo': '❌🥅', 'pen-prov': '🤦🥅', 'pen-parado': '🖐🥅', propia: '⚽🚫', amarilla: '🟨', 'd-amarilla': '🟨🟥', roja: '🟥'
    };
    panel._manualEvents.push({
      min: 90,
      team: side,
      realTeam: teamName,
      player: [parts[0], parts[1]],
      ico: icoMap[evType] || '•',
      type: evType
    });
    renderHumanEventList();
  };

  window.chpRemoveEvent = function (idx) {
    var panel = document.getElementById('copa-human-panel');
    if (!panel || !panel._manualEvents) return;
    panel._manualEvents.splice(idx, 1);
    renderHumanEventList();
  };

  window.chpAddRandomInjury = function () {
    var panel = document.getElementById('copa-human-panel');
    if (!panel) return;
    var local = document.getElementById('chp-local').textContent.trim();
    var visitante = document.getElementById('chp-visit').textContent.trim();
    var pickTeam = Math.random() < 0.5 ? local : visitante;
    var split = splitSquad(pickTeam);
    var active = split.active;
    var bench = split.bench;
    if (!active.length) return;
    var lesiones = typeof window.generarLesionesPartido === 'function'
      ? window.generarLesionesPartido(pickTeam, pickTeam, active, [], bench, [], 90)
      : [];
    var raw = lesiones && lesiones[0];
    if (!raw) {
      var p = pickWeightedPlayer(active);
      if (!p) return;
      var tipo = window.LESION_STORE_UTILS && window.LESION_STORE_UTILS.sortearGrado ? window.LESION_STORE_UTILS.sortearGrado() : { grado: 1, nombre: 'Leve', emoji: '🟡' };
      var partidos = window.LESION_STORE_UTILS && window.LESION_STORE_UTILS.sortearPartidos ? window.LESION_STORE_UTILS.sortearPartidos(tipo) : 1;
      if (window.LESION_STORE_UTILS && window.LESION_STORE_UTILS.registrar) window.LESION_STORE_UTILS.registrar(p[1], pickTeam, partidos, tipo);
      var injury = { jugador: p, nombre: p[1], teamName: pickTeam, equipo: pickTeam, tipo: tipo, grado: tipo.grado, gradoNombre: tipo.nombre, gradoEmoji: tipo.emoji, descripcion: '', partidos: partidos };
      panel._manualInjuries.push(injury);
      ensureStoreCounters(p[1], pickTeam, partidos);
      renderHumanEventList();
      alert('🩹 ' + p[1] + ' (' + pickTeam + ') queda lesionado. La baja de Copa ya se ha registrado.');
      return;
    }
    if (typeof window.aplicarLesionEnSimulacion === 'function') window.aplicarLesionEnSimulacion(raw, active, []);
    var injuryData = {
      jugador: raw.jugador,
      nombre: raw.jugador && raw.jugador[1],
      teamName: raw.teamName,
      equipo: raw.teamName,
      tipo: raw.tipo,
      grado: raw.tipo && raw.tipo.grado,
      gradoNombre: raw.tipo && raw.tipo.nombre,
      gradoEmoji: raw.tipo && raw.tipo.emoji,
      descripcion: (window.LESION_STORE && raw.jugador && window.LESION_STORE[raw.jugador[1]] && window.LESION_STORE[raw.jugador[1]].descripcion) || '',
      partidos: raw.partidos
    };
    panel._manualInjuries.push(injuryData);
    ensureStoreCounters(injuryData.nombre, injuryData.teamName, injuryData.partidos);
    renderHumanEventList();
    alert('🩹 ' + injuryData.nombre + ' (' + injuryData.teamName + ') queda lesionado. La baja de Copa ya se ha registrado.');
  };

  window.chpGuardar = function () {
    var panel = document.getElementById('copa-human-panel');
    var ronda = panel.dataset.ronda;
    var idx = parseInt(panel.dataset.idx, 10);
    var esVuelta = panel.dataset.vuelta === '1';
    var twoLeg = panel.dataset.twoleg === '1';
    var local = document.getElementById('chp-local').textContent.trim();
    var visitante = document.getElementById('chp-visit').textContent.trim();
    var gl = parseInt(document.getElementById('chp-gl').value, 10) || 0;
    var gv = parseInt(document.getElementById('chp-gv').value, 10) || 0;
    var etGl = document.getElementById('chp-et-section').style.display !== 'none' ? (parseInt(document.getElementById('chp-et-gl').value, 10) || 0) : 0;
    var etGv = document.getElementById('chp-et-section').style.display !== 'none' ? (parseInt(document.getElementById('chp-et-gv').value, 10) || 0) : 0;
    var penWinner = document.getElementById('chp-pen-section').style.display !== 'none' ? document.getElementById('chp-pen-winner').value : '';
    if (!twoLeg) {
      if (gl + etGl === gv + etGv && !penWinner) {
        alert('⚠️ Empate — indica el ganador en penaltis.');
        return;
      }
    } else if (esVuelta) {
      var ida = (((_copa.resultados || {})[ronda + '_ida'] || [])[idx]) || {};
      var aggL = Number(ida.gl || 0) + gv;
      var aggV = Number(ida.gv || 0) + gl;
      if (aggL === aggV && !penWinner) {
        alert('⚠️ Empate global — indica el ganador en penaltis.');
        return;
      }
    }
    var mvp = document.getElementById('chp-mvp').value.trim();
    var events = (panel._manualEvents || []).slice();
    if (mvp) {
      events.push({ min: 120, ico: '⭐', team: local === (mvp && local) ? 'a' : 'a', player: ['', mvp], type: 'mvp', realTeam: local });
    }
    var injuries = (panel._manualInjuries || []).slice();
    var payload = {
      ronda: ronda,
      idx: idx,
      es_vuelta: esVuelta,
      gl: gl,
      gv: gv,
      et_gl: etGl,
      et_gv: etGv,
      pen_winner: penWinner || null,
      mvp: mvp,
      events: events,
      injuries: injuries,
      summary: buildSummary({ gl: gl, gv: gv, et_gl: etGl, et_gv: etGv, pen_winner: penWinner, pen_score: '', mvp: mvp }, local, visitante),
      pen_score: '',
      team_a: local,
      team_b: visitante,
      jugado: true
    };
    saveResult(payload).then(function (d) {
      if (!d.ok) {
        alert('❌ ' + (d.error || 'No se pudo guardar el partido'));
        return;
      }
      applyHumanResultMeta(payload, local, visitante);
      panel.classList.remove('show');
      copaRender(d.copa);
      if (injuries.length && typeof window.showLesionPostOverlay === 'function') window.showLesionPostOverlay(injuries, null);
    });
  };

  window.chpCerrar = function () {
    var panel = document.getElementById('copa-human-panel');
    if (panel) panel.classList.remove('show');
  };

  document.addEventListener('change', function (ev) {
    if (ev.target && ev.target.id === 'chp-evt-team') refreshHumanPlayerSelect();
  });

  document.addEventListener('DOMContentLoaded', function () {
    ensureHumanPanelEnhancements();
    var origGo = window.go;
    window.go = function (screenId) {
      if (typeof origGo === 'function') origGo.apply(this, arguments);
      if (screenId === 's-copa' || screenId === 's-calendario' || screenId === 's-copa-cuadro') init();
    };
    init();
  });

  window.copaInit = init;
  window.copaRender = copaRender;
})();
