const CONFIG_EQUIPOS = {
    "FC Barcelona": { media: 85, color: "#004d98" },
    "Real Madrid": { media: 85, color: "#ffffff" },
    "Atletico Madrid": { media: 83, color: "#cb3524" },
    "Athletic Club": { media: 79, color: "#ff0000" },
    "Villarreal": { media: 80, color: "#ffe200" },
    "Betis": { media: 79, color: "#0bb363" },
    "Osasuna": { media: 77, color: "#9e0b1c" },
    "Real Sociedad": { media: 79, color: "#0067b1" },
    "Girona": { media: 77, color: "#e2001a" },
    "Rayo Vallecano": { media: 77, color: "#ffffff" },
    "Espanyol": { media: 76, color: "#0088ce" },
    "Celta": { media: 76, color: "#87adcf" },
    "Mallorca": { media: 76, color: "#e30613" },
    "Valencia": { media: 76, color: "#ffffff" },
    "Sevilla": { media: 75, color: "#ffffff" },
    "Getafe": { media: 75, color: "#00539b" },
    "Deportivo Alavés": { media: 74, color: "#005ca9" },
    "Elche": { media: 74, color: "#ffffff" },
    "Real Oviedo": { media: 73, color: "#004a99" },
    "Levante": { media: 72, color: "#004d98" }
};

// Exportar para que otros archivos JS lo usen
if (typeof module !== 'undefined') {
    module.exports = CONFIG_EQUIPOS;
}
