/* ================================================================
   MATCH ENGINE: BARAJAS DE PODER (REGLAMENTO COMPLETO)
   Versión: 1.2 - Final Blindada
   ================================================================
*/

(function() {
    // 1. PROBABILIDADES BASE POR POSICIÓN (REGLAMENTO)
    const BASE_PROB = {
        'P': 0.001, // Porteros (El Muro)
        'D': 7.5,   // Defensas (Cabezazo Letal)
        'M': 17.5,  // Medios (Llegada)
        'F': 70.0   // Delanteros (Instinto Asesino)
    };

    // 2. CARTA DE LOS MILAGROS (Factores de reducción para Multigol)
    const MIRACLE_FACTORS = {
        2: 0.37, // Doblete (37%)
        3: 0.22, // Hat-Trick (22%)
        4: 0.12, // Póker (12%)
        5: 0.06  // Manita (6%)
    };

    /**
     * CALCULA LA PROBABILIDAD DE GOL (MATEMÁTICA EXACTA)
     */
    window.calculateGoalProbability = function(pos, power, isLocal, goalsAlreadyScored) {
        // PASO 1: Elección de Probabilidad Base según posición
        let probBase = BASE_PROB[pos] || 17.5;

        // PASO 2: Cálculo Base (Probabilidad Base + Poder Individual)
        // Convertimos a número por si acaso llega como texto
        let pwr = parseFloat(power) || 0;
        let calculationBase = probBase + (pwr / 100);

        // PASO 3: Factor Localía (Carta de la Fortaleza)
        let finalFirstGoalProb = calculationBase;
        if (isLocal) {
            finalFirstGoalProb = calculationBase * 1.08;
        }

        // PASO 4: Efecto Multigol (Carta de los Milagros)
        let result = finalFirstGoalProb;
        let nextGoalNumber = (parseInt(goalsAlreadyScored) || 0) + 1;

        if (nextGoalNumber > 1) {
            // Si es más de 5 goles, aplicamos un factor mínimo del 2%
            let miracleFactor = MIRACLE_FACTORS[nextGoalNumber] || 0.02; 
            result = finalFirstGoalProb * miracleFactor;
        }

        return parseFloat(result.toFixed(2));
    };

    /**
     * TIRADA DE DADOS
     */
    window.checkIfItIsGoal = function(probability) {
        let roll = Math.random() * 100; 
        return roll <= probability;
    };

    /**
     * INICIALIZADOR DE SELECTORES (Válido para cualquier país/liga)
     */
    window.initMatchSelectors = function(teamAName, teamBName) {
        const getOptions = (name) => {
            let squad = window.SQUAD_REGISTRY[name] || [];
            if (squad.length === 0) return '<option value="">Equipo no encontrado</option>';
            
            return squad
                .filter(p => !p.h) 
                .map(p => {
                    // p
