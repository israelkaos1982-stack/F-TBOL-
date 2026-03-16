/**
 * LIGA EFOOTBALL - MOTOR DE PARTIDO DEFINITIVO
 * Conectado con SQUAD_REGISTRY de index.bundle.js
 */

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

    // Simula lo que ocurre en cada minuto de juego
    simularMinuto() {
        if (this.minuto >= 90) {
            this.terminado = true;
            return null;
        }

        this.minuto++;
        let eventoM = null;

        // Probabilidades equilibradas (Factor 1.1 para ventaja de campo)
        const probGolL = (this.mediaLocal * 1.1) / (this.mediaLocal + this.mediaVisitante) / 28;
        const probGolV = (this.mediaVisitante) / (this.mediaLocal + this.mediaVisitante) / 28;

        const azar = Math.random();

        // 1. ¿Gol del equipo Local?
        if (azar < probGolL) {
            this.golesL++;
            eventoM = {
                minuto: this.minuto,
                tipo: 'gol',
                equipo: this.local,
                jugador: this.obtenerJugador(this.local, true) // Buscamos goleador (delanteros/medios)
            };
            this.eventos.push(eventoM);
        } 
        // 2. ¿Gol del equipo Visitante?
        else if (azar < probGolL + probGolV) {
            this.golesV++;
            eventoM = {
                minuto: this.minuto,
                tipo: 'gol',
                equipo: this.visitante,
                jugador: this.obtenerJugador(this.visitante, true)
            };
            this.eventos.push(eventoM);
        }
        // 3. ¿Tarjeta amarilla? (Probabilidad de 4% por minuto)
        else if (Math.random() < 0.04) {
            const equipoCard = Math.random() > 0.5 ? this.local : this.visitante;
            eventoM = {
                minuto: this.minuto,
                tipo: 'tarjeta_amarilla',
                equipo: equipoCard,
                jugador: this.obtenerJugador(equipoCard, false) // Cualquier jugador puede recibir tarjeta
            };
            this.eventos.push(eventoM);
        }

        return eventoM;
    }

    /**
     * EXTRAE JUGADORES DE LA BASE DE DATOS DEL BUNDLE (SQUAD_REGISTRY)
     * @param {string} equipo - Nombre del equipo
     * @param {boolean} soloAtacantes - Si es true, prioriza goleadores
     */
    obtenerJugador(equipo, soloAtacantes = false) {
        // Resolvemos el alias por si el nombre viene simplificado
        const aliases = window.TEAM_ALIASES || {};
        const nombreReal = aliases[equipo.toLowerCase()] || equipo;
        
        // Accedemos a la base de datos del Bundle
        const registro = window.SQUAD_REGISTRY ? window.SQUAD_REGISTRY[nombreReal] : null;

        if (registro) {
            // Filtramos solo los datos de jugadores (los que son un Array [dorsal, nombre, media])
            let lista = registro.filter(p => Array.isArray(p));
            
            // Si buscamos un goleador, intentamos que no sea el portero (posición 0-3 del registro aprox)
            if (soloAtacantes && lista.length > 5) {
                // Quitamos a los porteros para que no marquen gol cada dos por tres
                lista = lista.slice(3); 
            }

            const elegido = lista[Math.floor(Math.random() * lista.length)];
            return elegido[1]; // Retornamos el NOMBRE (Ej: "Mbappé")
        }

        // Plan B: Si no encuentra el registro, usa la lista corta antigua
        if (window.JUGADORES_DATA && window.JUGADORES_DATA[equipo]) {
            const plantilla = window.JUGADORES_DATA[equipo];
            return plantilla[Math.floor(Math.random() * plantilla.length)];
        }

        return "Jugador";
    }

    // Calcula el MVP basado en el rendimiento (goles)
    calcularMVP() {
        const goles = this.eventos.filter(e => e.tipo === 'gol');
        if (goles.length > 0) {
            // El último en marcar suele llevarse los focos
            return goles[goles.length - 1].jugador;
        }
        // Si hay empate a cero, el portero o defensa del equipo local es MVP
        return this.obtenerJugador(this.local, false);
    }
}

// Exportación global para que index.bundle.js lo vea
window.MatchEngine = MatchEngine;
