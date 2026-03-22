/* ================================================================
   COPA DEL REY ENGINE v1.0
   Sorteo, simulación IA, partidos humanos, prórroga y penaltis
   ================================================================ */
(function () {

  var HUMAN_TEAMS = ['Real Madrid', 'FC Barcelona', 'Bayern Munich', 'Arsenal', 'Sporting CP'];

  var ROUND_LABEL = {
    r1:  '1ª Ronda',
    r2:  '2ª Ronda',
    r16: 'Dieciseisavos',
    oct: 'Octavos',
    cua: 'Cuartos',
    fin: 'FINAL'
  };

  /* Two-leg rounds */
  var TWO_LEG = { oct: true, cua: true };

  /* Order of rounds */
  var ROUNDS = ['r1', 'r2', 'r16', 'oct', 'cua', 'fin'];

  var _copa = {};

  /* ── Helpers ──────────────────────────────────────── */
  function isHuman(local, visitante) {
    return HUMAN_TEAMS.indexOf(local) !== -1 || HUMAN_TEAMS.indexOf(visitante) !== -1;
  }

  function allPlayed(res_list, n) {
    if (!res_list || res_list.length < n) return false;
    for (var i = 0; i < n; i++) {
      if (!res_list[i] || !res_list[i].jugado) return false;
    }
    return true;
  }

  function isRoundComplete(ronda, matches, resultados) {
    if (!matches || !matches.length) return false;
    if (TWO_LEG[ronda]) {
      var vta = resultados[ronda + '_vta'] || [];
      return allPlayed(vta, matches.length) &&
        vta.slice(0, matches.length).every(function (r) { return r && r.winner; });
    }
    return allPlayed(resultados[ronda], matches.length);
  }

  /* ── Init & Load ──────────────────────────────────── */
  function copaInit() {
    fetch('/api/copa/state')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _copa = d.copa || {};
        copaRender(_copa);
      })
      .catch(function (e) { console.error('[Copa] state error', e); });
  }

  /* ── Render all rounds ────────────────────────────── */
  function copaRender(copa) {
    var container = document.getElementById('copa-jlist');
    if (!container) return;
    _copa = copa || {};

    var sorteo = _copa.sorteo || {};
    var resultados = _copa.resultados || {};
    var clasificados = _copa.clasificados || {};
    var html = '';

    /* If Copa not started */
    if (!sorteo.r1 || !sorteo.r1.length) {
      html = '<div class="copa-start-wrap">'
        + '<p class="copa-info">🏆 Copa del Rey — Temporada 2025/26</p>'
        + '<button class="copa-btn-sortear" onclick="window.copaSortear(\'r1\')">'
        + '🎯 Iniciar Copa — Sortear 1ª Ronda</button>'
        + '</div>';
      container.innerHTML = html;
      return;
    }

    ROUNDS.forEach(function (ronda) {
      var matches = sorteo[ronda] || [];
      var label = ROUND_LABEL[ronda] || ronda;
      var clasif = clasificados[ronda] || [];

      if (TWO_LEG[ronda]) {
        html += renderBlock(ronda + '_ida', label + ' — Ida', matches,
          resultados[ronda + '_ida'], ronda, false);
        html += renderBlock(ronda + '_vta', label + ' — Vuelta', matches,
          resultados[ronda + '_vta'], ronda, true);
      } else {
        html += renderBlock(ronda, label, matches, resultados[ronda], ronda, false);
      }

      /* "Clasificar" button when round is complete */
      if (matches.length && isRoundComplete(ronda, matches, resultados) && !clasif.length) {
        html += '<div class="copa-round-action">'
          + '<button class="copa-btn-avanzar" onclick="window.copaClasificar(\'' + ronda + '\')">'
          + '✅ Confirmar clasificados — ' + label + '</button></div>';
      }

      /* Show classified teams */
      if (clasif.length) {
        html += '<div class="copa-clasificados">'
          + '<span class="copa-clas-title">Clasificados ' + label + ':</span> '
          + clasif.map(function (t) {
            return '<span class="copa-clas-team' + (isHuman(t, '') ? ' human' : '') + '">' + t + '</span>';
          }).join('')
          + '</div>';
      }

      /* "Sortear siguiente ronda" button */
      var nextRound = { r1: 'r2', r2: 'r16', r16: 'oct', oct: 'cua', cua: 'fin' }[ronda];
      if (nextRound && clasif.length && !(sorteo[nextRound] && sorteo[nextRound].length)) {
        html += '<div class="copa-round-action">'
          + '<button class="copa-btn-sortear" onclick="window.copaSortear(\'' + nextRound + '\')">'
          + '🎯 Sortear ' + ROUND_LABEL[nextRound] + '</button></div>';
      }
    });

    /* Champion display */
    if (clasificados.campeon) {
      html += '<div class="copa-champion">'
        + '<div class="copa-champion-trophy">🏆</div>'
        + '<div class="copa-champion-name">' + clasificados.campeon + '</div>'
        + '<div class="copa-champion-label">CAMPEÓN DE LA COPA DEL REY</div>'
        + '</div>';
    }

    html += '<div class="copa-round-action" style="margin-top:18px;opacity:.5">'
      + '<button class="copa-btn-reset" onclick="window.copaReiniciar()">🔄 Reiniciar Copa</button>'
      + '</div>';

    container.innerHTML = html;
  }

  /* ── Render one jblock ────────────────────────────── */
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
          /* Show result */
          var gl = res.gl, gv = res.gv;
          var etTxt = '';
          if (res.et_gl !== undefined && (res.et_gl > 0 || res.et_gv > 0)) {
            etTxt = ' <span class="copa-et">(' + (gl + res.et_gl) + '-' + (gv + res.et_gv) + ' ET)</span>';
          }
          var penTxt = res.pen_winner ? ' <span class="copa-pen">✓Pen</span>' : '';
          var wl = (res.winner === m.l) ? ' winner' : ((res.winner === m.v) ? ' loser' : '');
          var wv = (res.winner === m.v) ? ' winner' : ((res.winner === m.l) ? ' loser' : '');
          inner += '<div class="mrow copa-mrow" data-done="1">'
            + '<div class="mn' + (esVuelta ? wv : wl) + '">' + local + '</div>'
            + '<div class="ms copa-sc">' + gl + ' – ' + gv + etTxt + penTxt + '</div>'
            + '<div class="mn r' + (esVuelta ? wl : wv) + '">' + visit + '</div>'
            + '</div>';
        } else {
          /* Pending match */
          var btn = human
            ? '<button class="copa-btn-play" onclick="window.copaJugar(\'' + ronda + '\',' + idx + ',' + (esVuelta ? 1 : 0) + ')">▶ Jugar</button>'
            : '<button class="copa-btn-sim" onclick="window.copaSimIA(\'' + ronda + '\',' + idx + ',' + (esVuelta ? 1 : 0) + ')">⚡ Sim</button>';
          inner += '<div class="mrow copa-mrow">'
            + '<div class="mn">' + local + '</div>'
            + '<div class="ms p copa-sc-pen" id="csc-' + blockId + '-' + idx + '">vs</div>'
            + '<div class="mn r">' + visit + '</div>'
            + '<div class="copa-act">' + btn + '</div>'
            + '</div>';
        }
      });
    }

    var openClass = !hasResults ? ' open' : '';
    return '<div class="jblock">'
      + '<button class="jbtn c-copa" onclick="tog(\'' + blockId + '\')">'
      + '<div class="pdot">▶</div>🏆 <b>Copa</b> — ' + label
      + '</button>'
      + '<div class="jmatches' + openClass + '" id="' + blockId + '">' + inner + '</div>'
      + '</div>';
  }

  /* ── Sorteo ───────────────────────────────────────── */
  window.copaSortear = function (ronda) {
    fetch('/api/copa/sorteo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ronda: ronda })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { copaRender(d.copa); }
        else { alert('❌ Error sorteo: ' + (d.error || '')); }
      });
  };

  /* ── Simular IA ───────────────────────────────────── */
  window.copaSimIA = function (ronda, idx, esVuelta) {
    var bid = 'csc-' + (TWO_LEG[ronda] ? ronda + (esVuelta ? '_vta' : '_ida') : ronda) + '-' + idx;
    var el = document.getElementById(bid);
    if (el) { el.textContent = '…'; el.style.color = 'rgba(240,192,64,.7)'; }

    fetch('/api/copa/simular_ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ronda: ronda, idx: idx, es_vuelta: esVuelta === 1 || esVuelta === true })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { copaRender(d.copa); }
        else { alert('❌ ' + (d.error || 'Error')); }
      });
  };

  /* ── Simular TODOS los partidos IA de una ronda ───── */
  window.copaSimTodosIA = function (ronda, esVuelta) {
    var matches = (_copa.sorteo || {})[ronda] || [];
    var resultados = (_copa.resultados || {});
    var key = TWO_LEG[ronda] ? ronda + (esVuelta ? '_vta' : '_ida') : ronda;
    var res_list = resultados[key] || [];
    var pending = [];
    matches.forEach(function (m, idx) {
      if (isHuman(m.l, m.v)) return;
      if (res_list[idx] && res_list[idx].jugado) return;
      pending.push(idx);
    });
    if (!pending.length) { alert('No hay partidos IA pendientes.'); return; }
    var i = 0;
    function next() {
      if (i >= pending.length) { copaInit(); return; }
      var idx = pending[i++];
      fetch('/api/copa/simular_ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ronda: ronda, idx: idx, es_vuelta: esVuelta === 1 })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) { _copa = d.copa; }
          next();
        });
    }
    next();
  };

  /* ── Clasificar ronda ─────────────────────────────── */
  window.copaClasificar = function (ronda) {
    fetch('/api/copa/clasificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ronda: ronda })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { copaRender(d.copa); }
      });
  };

  /* ── Reiniciar Copa ───────────────────────────────── */
  window.copaReiniciar = function () {
    if (!confirm('¿Reiniciar Copa del Rey? Se perderán todos los resultados.')) return;
    fetch('/api/copa/reiniciar', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) copaRender({}); });
  };

  /* ── Panel de partido humano ──────────────────────── */
  window.copaJugar = function (ronda, idx, esVuelta) {
    var copa_sorteo = (_copa.sorteo || {})[ronda] || [];
    if (idx >= copa_sorteo.length) return;
    var m = copa_sorteo[idx];
    var local = esVuelta ? m.v : m.l;
    var visitante = esVuelta ? m.l : m.v;
    var two_leg = !!TWO_LEG[ronda];

    var panel = document.getElementById('copa-human-panel');
    if (!panel) return;
    panel.dataset.ronda = ronda;
    panel.dataset.idx = idx;
    panel.dataset.vuelta = esVuelta ? '1' : '0';
    panel.dataset.twoleg = two_leg ? '1' : '0';

    document.getElementById('chp-local').textContent = local;
    document.getElementById('chp-visit').textContent = visitante;
    document.getElementById('chp-gl').value = '0';
    document.getElementById('chp-gv').value = '0';
    document.getElementById('chp-mvp').value = '';
    document.getElementById('chp-et-section').style.display = 'none';
    document.getElementById('chp-pen-section').style.display = 'none';
    document.getElementById('chp-et-gl').value = '0';
    document.getElementById('chp-et-gv').value = '0';
    document.getElementById('chp-pen-winner').innerHTML =
      '<option value="' + local + '">' + local + '</option>'
      + '<option value="' + visitante + '">' + visitante + '</option>';

    /* For vuelta: show aggregate info */
    var aggEl = document.getElementById('chp-agg-info');
    if (esVuelta && aggEl) {
      var idaKey = ronda + '_ida';
      var idaList = (_copa.resultados || {})[idaKey] || [];
      var ida = idaList[idx];
      if (ida) {
        aggEl.textContent = 'Ida: ' + m.l + ' ' + ida.gl + ' – ' + ida.gv + ' ' + m.v;
        aggEl.style.display = 'block';
      } else {
        aggEl.style.display = 'none';
      }
    } else if (aggEl) {
      aggEl.style.display = 'none';
    }

    panel.classList.add('show');
  };

  /* Check if ET is needed after FT */
  window.chpCheckEmpate = function () {
    var gl = parseInt(document.getElementById('chp-gl').value) || 0;
    var gv = parseInt(document.getElementById('chp-gv').value) || 0;
    var panel = document.getElementById('copa-human-panel');
    var two_leg = panel && panel.dataset.twoleg === '1';
    var esVuelta = panel && panel.dataset.vuelta === '1';

    if (!two_leg && gl === gv) {
      /* Single-leg: need ET */
      document.getElementById('chp-et-section').style.display = 'block';
    } else if (two_leg && esVuelta) {
      /* Two-leg vuelta: check aggregate */
      _chpCheckAggregate();
    }
  };

  function _chpCheckAggregate() {
    var panel = document.getElementById('copa-human-panel');
    var ronda = panel.dataset.ronda;
    var idx = parseInt(panel.dataset.idx);
    var m = (_copa.sorteo || {})[ronda][idx];
    var ida = ((_copa.resultados || {})[ronda + '_ida'] || [])[idx] || {};
    var gl_vta = parseInt(document.getElementById('chp-gl').value) || 0;
    var gv_vta = parseInt(document.getElementById('chp-gv').value) || 0;
    /* visitante in vuelta = m.l (original local), local in vuelta = m.v */
    var total_l = (ida.gl || 0) + gv_vta;
    var total_v = (ida.gv || 0) + gl_vta;
    if (total_l === total_v) {
      document.getElementById('chp-pen-section').style.display = 'block';
    } else {
      document.getElementById('chp-pen-section').style.display = 'none';
    }
  }

  window.chpCheckET = function () {
    var et_gl = parseInt(document.getElementById('chp-et-gl').value) || 0;
    var et_gv = parseInt(document.getElementById('chp-et-gv').value) || 0;
    var gl = parseInt(document.getElementById('chp-gl').value) || 0;
    var gv = parseInt(document.getElementById('chp-gv').value) || 0;
    if (gl + et_gl === gv + et_gv) {
      document.getElementById('chp-pen-section').style.display = 'block';
    } else {
      document.getElementById('chp-pen-section').style.display = 'none';
    }
  };

  window.chpGuardar = function () {
    var panel = document.getElementById('copa-human-panel');
    var ronda = panel.dataset.ronda;
    var idx = parseInt(panel.dataset.idx);
    var esVuelta = panel.dataset.vuelta === '1';
    var two_leg = panel.dataset.twoleg === '1';

    var gl = parseInt(document.getElementById('chp-gl').value) || 0;
    var gv = parseInt(document.getElementById('chp-gv').value) || 0;
    var et_gl = 0, et_gv = 0, pen_winner = null;

    var etSection = document.getElementById('chp-et-section');
    if (etSection && etSection.style.display !== 'none') {
      et_gl = parseInt(document.getElementById('chp-et-gl').value) || 0;
      et_gv = parseInt(document.getElementById('chp-et-gv').value) || 0;
    }

    var penSection = document.getElementById('chp-pen-section');
    if (penSection && penSection.style.display !== 'none') {
      pen_winner = document.getElementById('chp-pen-winner').value;
    }

    /* Validation */
    if (!two_leg) {
      var total_l = gl + et_gl, total_v = gv + et_gv;
      if (total_l === total_v && !pen_winner) {
        alert('⚠️ Empate — indica el ganador en penaltis.');
        return;
      }
    } else if (esVuelta) {
      /* Check aggregate */
      var m2 = (_copa.sorteo || {})[ronda][idx];
      var ida2 = ((_copa.resultados || {})[ronda + '_ida'] || [])[idx] || {};
      var agg_l = (ida2.gl || 0) + gv;  /* original local team goals */
      var agg_v = (ida2.gv || 0) + gl;
      if (agg_l === agg_v && !pen_winner) {
        alert('⚠️ Empate en el global — indica el ganador en penaltis.');
        return;
      }
    }

    var mvp = document.getElementById('chp-mvp').value || '';

    fetch('/api/copa/guardar_resultado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ronda: ronda, idx: idx, es_vuelta: esVuelta,
        gl: gl, gv: gv, et_gl: et_gl, et_gv: et_gv,
        pen_winner: pen_winner, mvp: mvp
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          panel.classList.remove('show');
          copaRender(d.copa);
        }
      });
  };

  window.chpCerrar = function () {
    var panel = document.getElementById('copa-human-panel');
    if (panel) panel.classList.remove('show');
  };

  /* ── Hook into navigation ─────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var _origGo = window.go;
    window.go = function (screenId) {
      if (typeof _origGo === 'function') _origGo.apply(this, arguments);
      if (screenId === 's-copa') copaInit();
    };
  });

  window.copaInit = copaInit;
  window.copaRender = copaRender;

})();
