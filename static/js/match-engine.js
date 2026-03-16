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

    // Calcula la probabilidad de gol en cada minuto
    simularMinuto() {
        if (this.minuto >= 90) {
            this.terminado = true;
            return null;
        }

        this.minuto++;
        let eventoM = null;

        // Factor de ventaja local (1.1)
        const probGolL = (this.mediaLocal * 1.1) / (this.mediaLocal + this.mediaVisitante) / 25;
        const probGolV = (this.mediaVisitante) / (this.mediaLocal + this.mediaVisitante) / 25;

        // Simular gol Local
        if (Math.random() < probGolL) {
            this.golesL++;
            eventoM = {
                minuto: this.minuto,
                tipo: 'gol',
                equipo: this.local,
                jugador: this.obtenerJugador(this.local)
            };
            this.eventos.push(eventoM);
        } 
        // Simular gol Visitante
        else if (Math.random() < probGolV) {
            this.golesV++;
            eventoM = {
                minuto: this.minuto,
                tipo: 'gol',
                equipo: this.visitante,
                jugador: this.obtenerJugador(this.visitante)
            };
            this.eventos.push(eventoM);
        }
        
        // Simular tarjetas aleatorias (5% de probabilidad por minuto)
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

    obtenerJugador(equipo) {
        // Esta función asume que los jugadores están disponibles globalmente o se pasan
        // Si no, devuelve un genérico para evitar errores
        const jugadores = window.JUGADORES_DATA ? window.JUGADORES_DATA[equipo] : ["Jugador"];
        return jugadores[Math.floor(Math.random() * jugadores.length)];
    }

    calcularMVP() {
        if (this.eventos.length === 0) return this.obtenerJugador(this.local);
        
        const goleadores = this.eventos.filter(e => e.tipo === 'gol');
        if (goleadores.length > 0) {
            // El último en meter gol tiene más papeletas de ser MVP en esta lógica simple
            return goleadores[goleadores.length - 1].jugador;
        }
        return this.obtenerJugador(this.local);
    }
}

// Hacerlo accesible para index.bundle.js
window.MatchEngine = MatchEngine;
