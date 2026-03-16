class MatchEngine {
    constructor(local, visitante, mediaLocal, mediaVisitante) {
        this.local = local;
        this.visitante = visitante;
        this.mediaLocal = mediaLocal;
        this.mediaVisitante = mediaVisitante;
        
        this.golesL = 0;
        this.golesV = 0;
        this.minuto = 0;
        this.eventos = [];
        this.terminado = false;
    }

    // Lógica principal: simula lo que ocurre en 1 minuto de partido
    simularMinuto() {
        if (this.minuto >= 90) {
            this.terminado = true;
            return null;
        }

        this.minuto++;
        let eventoM = null;

        // Probabilidades basadas en la media (ajustadas para un marcador realista)
        // El factor 1.1 da una ligera ventaja al equipo de casa
        const probGolL = (this.mediaLocal * 1.1) / (this.mediaLocal + this.mediaVisitante) / 28;
        const probGolV = (this.mediaVisitante) / (this.mediaLocal + this.mediaVisitante) / 28;

        const azar = Math.random();

        // 1. ¿Gol del Local?
        if (azar < probGolL) {
            this.golesL++;
            eventoM = {
                minuto: this.minuto,
                tipo: 'gol',
                equipo: this.local,
                jugador: this.obtenerJugador(this.local)
            };
            this.eventos.push(eventoM);
        } 
        // 2. ¿Gol del Visitante?
        else if (azar < probGolL + probGolV) {
            this.golesV++;
            eventoM = {
                minuto: this.minuto,
                tipo: 'gol',
                equipo: this.visitante,
                jugador: this.obtenerJugador(this.visitante)
            };
            this.eventos.push(eventoM);
        }
        // 3. ¿Tarjeta amarilla? (5% de probabilidad por minuto)
        else if (Math.random() < 0.05) {
            const equipoCard = Math.random() > 0.5 ? this.local : this.visitante;
            eventoM = {
                minuto: this.minuto,
                tipo: 'tarjeta_amarilla',
                equipo: equipoCard,
                jugador: this.obtenerJugador(equipoCard)
            };
            this.eventos.push(eventoM);
        }

        return eventoM;
    }

    // Busca un jugador aleatorio de la lista global definida en index.html
    obtenerJugador(equipo) {
        if (window.JUGADORES_DATA && window.JUGADORES_DATA[equipo]) {
            const plantilla = window.JUGADORES_DATA[equipo];
            return plantilla[Math.floor(Math.random() * plantilla.length)];
        }
        return "Jugador desconocido"; // Fallback por si el nombre del equipo no coincide
    }

    // Calcula quién ha sido el mejor del partido
    calcularMVP() {
        const goles = this.eventos.filter(e => e.tipo === 'gol');
        if (goles.length > 0) {
            // Elige al autor de uno de los goles al azar
            return goles[Math.floor(Math.random() * goles.length)].jugador;
        }
        // Si quedan 0-0, el MVP es un jugador aleatorio del equipo local
        return this.obtenerJugador(this.local);
    }
}

// Hacer la clase accesible para index.bundle.js
window.MatchEngine = MatchEngine;
