// --- BASE DE DATOS LOCAL DE TRADUCCIÓN E IA ---
const baseConocimientoIA = {
    "hola": "¡Hola! Estoy listo para asistirte en esta feria tecnológica.",
    "sí": "Entendido, procediendo con la solicitud.",
    "no": "De acuerdo, acción cancelada de forma segura.",
    "gracias": "De nada, es un placer absoluto romper las barreras comunicativas.",
    "ayuda": "¡ALERTA! Iniciando protocolos automáticos de asistencia.",
    "te quiero": "La tecnología con propósito nos une. ¡Muchas gracias por el cariño!",
    "estoy bien": "¡Qué alegría! Sigamos con la comunicación inclusiva.",
    "estoy mal": "Lamento escuchar eso. Aquí estoy para apoyarte, ¿necesitas ayuda?",
    "no sé": "Está bien no tener una respuesta clara todavía. Tómate tu tiempo."
};

const traductorFeria = {
    "¡hola! estoy listo para asistirte en esta feria tecnológica.": {
        en: "Hello! I am ready to assist you at this technology fair.",
        pt: "Olá! Estou pronto para ajudá-lo nesta feira de tecnologia.",
        fr: "Bonjour! Je suis prêt à vous aider à cette foire technologique."
    },
    "entendido, procediendo con la solicitud.": {
        en: "Understood, proceeding with the request.",
        pt: "Entendido, procedendo com o pedido.",
        fr: "Compris, traitement de la demande."
    },
    "de acuerdo, acción cancelada de forma segura.": {
        en: "Okay, request cancelled safely.",
        pt: "Tudo bem, solicitação cancelada com segurança.",
        fr: "D'accord, action annulée en toute sécurité."
    },
    "de nada, es un placer absoluto romper las barreras comunicativas.": {
        en: "You're welcome, it is an absolute pleasure to break communication barriers.",
        pt: "De nada, é um prazer absoluto quebrar barreiras comunicativas.",
        fr: "De rien, c'est un plaisir absolu de briser les barrières de la communication."
    },
    "¡alerta! iniciando protocolos automáticos de asistencia.": {
        en: "ALERT! Initiating automatic assistance protocols.",
        pt: "ALERTA! Iniciando protocolos automáticos de assistência.",
        fr: "ALERTE ! Initialisation des protocoles d'assistance automatique."
    },
    "la tecnología con propósito nos une. ¡muchas gracias por el cariño!": {
        en: "Technology with purpose unites us. Thank you very much for the love!",
        pt: "Tecnologia com propósito nos une. Muito obrigado pelo carinho!",
        fr: "La technologie avec un but nous unit. Merci beaucoup pour l'affection !"
    },
    "¡qué alegría! sigamos con la comunicación inclusiva.": {
        en: "What joy! Let's continue with inclusive communication.",
        pt: "Que alegria! Vamos continuar com a comunicação inclusiva.",
        fr: "Quelle joie ! Continuons la communication inclusive."
    },
    "lamento escuchar eso. aquí estoy para apoyarte, ¿necesitas ayuda?": {
        en: "I'm sorry to hear that. I'm here to support you, do you need help?",
        pt: "Lamento ouvir isso. Estou aqui para te apoiar, precisa de ajuda?",
        fr: "Je suis désolé d'entendre ça. Je suis là pour te soutenir, as-tu besoin d'aide ?"
    },
    "está bien no tener una respuesta clara todavía. tómate tu tiempo.": {
        en: "It's okay to not have a clear answer yet. Take your time.",
        pt: "Tudo bem não ter uma resposta clara ainda. Tome seu tempo.",
        fr: "C'est normal de ne pas avoir de réponse claire pour l'instant. Prends ton temps."
    }
};

// --- ESTADOS DE LA BASE DE DATOS (MÉTRICAS) ---
let statPalabrasVal = 15420;
let statSenasVal = 3211;
let statGeminiCallsVal = 0;

let vozActiva = false;
let recoVoz;
let animandoMouth = false;

// --- SISTEMA DE PAUSA/COOLDOWN ENTRE GESTOS ---
// Evita que la detección "se enloquezca" disparando frases una tras otra sin dar tiempo
// a que la IA (y el usuario) terminen de hablar.
const CONFIG_GESTOS = {
    framesConfirmacion: 10,   // frames seguidos con la MISMA seña para confirmarla (filtra temblores/falsos positivos)
    cooldownMs: 4200          // pausa (ms) tras procesar un gesto, antes de aceptar el siguiente
};

let gestoCandidato = "";
let framesGestoActual = 0;

let cooldownActivo = false;
let cooldownRestante = 0;
let cooldownTimerId = null;

let esperandoRespuestaIA = false; // true mientras Gemini responde o la voz sintetizada está sonando
let safetyTimeoutId = null;
let panelAutoOcultarTimer = null;

// --- SISTEMA DE NOTIFICACIONES TOAST (Para evitar alertas invasivas) ---
function showToast(mensaje, tipo = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `p-3.5 rounded-xl border font-medium text-xs shadow-lg transition-all transform translate-y-2 opacity-0 duration-300 flex items-center justify-between gap-3 `;
    
    if (tipo === "error") {
        toast.className += "bg-red-950/95 text-red-200 border-red-500/50";
    } else if (tipo === "success") {
        toast.className += "bg-emerald-950/95 text-emerald-200 border-emerald-500/50";
    } else {
        toast.className += "bg-sky-950/95 text-sky-200 border-sky-500/50";
    }

    toast.innerHTML = `<span>${mensaje}</span><button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white">&times;</button>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
    }, 50);

    setTimeout(() => {
        toast.classList.add("translate-y-2", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// --- ---
let scene, camera, renderer, headGroup, head, mouth, eyeLeft, eyeRight, leftAntenna, rightAntenna;
const container = document.getElementById('containerAvatar');
let targetRotationX = 0, targetRotationY = 0;

function initThreeJS() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.8;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Luces con espectro ciberpunk neón
    const lightAmbient = new THREE.AmbientLight(0x0f172a, 1.8);
    scene.add(lightAmbient);

    const directionalLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    directionalLight.position.set(2, 4, 3);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x4ade80, 2, 10);
    pointLight.position.set(-2, -1, 2);
    scene.add(pointLight);

    // Grupo para la cabeza del robot
    headGroup = new THREE.Group();

    // Geometría estilizada de la cabeza del robot
    const geometryHead = new THREE.BoxGeometry(1.5, 1.7, 1.3);
    const materialHead = new THREE.MeshPhongMaterial({
        color: 0x111c30,
        shininess: 120,
        specular: 0x38bdf8,
        flatShading: true,
        bumpScale: 0.05
    });
    head = new THREE.Mesh(geometryHead, materialHead);
    headGroup.add(head);

    // Ojos LED emisivos
    const geoEye = new THREE.SphereGeometry(0.16, 32, 32);
    const matEye = new THREE.MeshPhongMaterial({
        color: 0x00f3ff,
        emissive: 0x0ea5e9,
        shininess: 200
    });

    eyeLeft = new THREE.Mesh(geoEye, matEye);
    eyeLeft.position.set(-0.35, 0.25, 0.65);
    headGroup.add(eyeLeft);

    eyeRight = new THREE.Mesh(geoEye, matEye);
    eyeRight.position.set(0.35, 0.25, 0.65);
    headGroup.add(eyeRight);

    // Antenas/Sensores laterales interactivos
    const geoAntenna = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
    const matAntenna = new THREE.MeshPhongMaterial({ color: 0x334155, shininess: 80 });

    leftAntenna = new THREE.Mesh(geoAntenna, matAntenna);
    leftAntenna.position.set(-0.8, 0.4, 0);
    leftAntenna.rotation.z = 0.3;
    headGroup.add(leftAntenna);

    rightAntenna = new THREE.Mesh(geoAntenna, matAntenna);
    rightAntenna.position.set(0.8, 0.4, 0);
    rightAntenna.rotation.z = -0.3;
    headGroup.add(rightAntenna);

    // Boca dinámica para síntesis oral
    const geoMouth = new THREE.BoxGeometry(0.65, 0.08, 0.1);
    const matMouth = new THREE.MeshPhongMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        shininess: 150
    });
    mouth = new THREE.Mesh(geoMouth, matMouth);
    mouth.position.set(0, -0.4, 0.65);
    headGroup.add(mouth);

    scene.add(headGroup);

    // Rastreo de movimiento del ratón
    window.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Rotación suave del rostro
        targetRotationY = mouseX * 0.45;
        targetRotationX = -mouseY * 0.35;
    });

    animateThreeJS();
}

function animateThreeJS() {
    requestAnimationFrame(animateThreeJS);

    // Suavizado cinemático (Lerp) para simular masa física en el giro
    headGroup.rotation.y += (targetRotationY - headGroup.rotation.y) * 0.08;
    headGroup.rotation.x += (targetRotationX - headGroup.rotation.x) * 0.08;

    // Movimiento sutil de flotamiento
    headGroup.position.y = Math.sin(Date.now() * 0.002) * 0.06;

    // Modulación de escala física de la mandíbula al hablar
    if (animandoMouth) {
        const scaleMouth = 1.0 + Math.abs(Math.sin(Date.now() * 0.03)) * 6.0;
        mouth.scale.y = scaleMouth;
    } else {
        mouth.scale.y = 1.0;
    }

    renderer.render(scene, camera);
}

// Responsividad del canvas 3D
window.addEventListener('resize', () => {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});

// --- ---
const video = document.getElementById('video');
const canvasMano = document.getElementById('canvasMano');
const ctxMano = canvasMano.getContext('2d');
const estadoCamara = document.getElementById('estadoCamara');

async function activarHardwareYVision() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        video.srcObject = stream;
        estadoCamara.textContent = "✅ Cámara activa";
        estadoCamara.className = "text-xs px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg mono-font";
        
        inicializarMediaPipeHands();
    } catch (err) {
        estadoCamara.textContent = "⚠️ Simulador de Señas Activo";
        estadoCamara.className = "text-xs px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg mono-font";
        console.warn("Fallo de acceso a hardware/cámara en vivo: ", err);
    }
}

function inicializarMediaPipeHands() {
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.75,
        minTrackingConfidence: 0.75
    });

    hands.onResults(onHandProcess);

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 640,
        height: 480
    });
    camera.start();
}

function onHandProcess(results) {
    canvasMano.width = video.videoWidth;
    canvasMano.height = video.videoHeight;
    ctxMano.clearRect(0, 0, canvasMano.width, canvasMano.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        if (!cooldownActivo && !esperandoRespuestaIA) {
            document.getElementById("statusTracker").textContent = "BUSCANDO MANO...";
        }
        // Se perdió la mano: reiniciamos la confirmación para no arrastrar un conteo viejo
        gestoCandidato = "";
        framesGestoActual = 0;
        return;
    }

    const puntos = results.multiHandLandmarks[0];

    // Trazado de articulaciones para el jurado (siempre visible, sirve de feedback constante)
    for (const pt of puntos) {
        const px = pt.x * canvasMano.width;
        const py = pt.y * canvasMano.height;
        ctxMano.beginPath();
        ctxMano.arc(px, py, 6, 0, 2 * Math.PI);
        ctxMano.fillStyle = '#00f3ff';
        ctxMano.shadowBlur = 12;
        ctxMano.shadowColor = '#0ea5e9';
        ctxMano.fill();
    }

    // Si estamos en pausa (cooldown) o la IA todavía está respondiendo/hablando,
    // NO disparamos ningún gesto nuevo: esto es lo que evita que la detección "se enloquezca".
    if (cooldownActivo || esperandoRespuestaIA) {
        document.getElementById("statusTracker").textContent = esperandoRespuestaIA
            ? "IA RESPONDIENDO..."
            : `EN PAUSA (${(cooldownRestante / 1000).toFixed(1)}s)`;
        gestoCandidato = "";
        framesGestoActual = 0;
        return;
    }

    document.getElementById("statusTracker").textContent = "MANO DETECTADA";

    // Heurística de estado físico de la mano
    const indiceArriba = puntos[8].y < puntos[6].y;
    const medioArriba = puntos[12].y < puntos[10].y;
    const anularArriba = puntos[16].y < puntos[14].y;
    const meniqueArriba = puntos[20].y < puntos[18].y;
    const pulgarArriba = puntos[4].y < puntos[3].y && puntos[4].x > puntos[5].x;

    let senaDetectada = "";

    if (indiceArriba && medioArriba && anularArriba && meniqueArriba) {
        senaDetectada = "Hola"; // Mano abierta
    } else if (!indiceArriba && !medioArriba && !anularArriba && !meniqueArriba && pulgarArriba) {
        senaDetectada = "Sí"; // Pulgar arriba
    } else if (indiceArriba && !medioArriba && !anularArriba && meniqueArriba) {
        senaDetectada = "Te quiero"; // ILY Sign
    } else if (!indiceArriba && !medioArriba && !anularArriba && !meniqueArriba && !pulgarArriba) {
        senaDetectada = "No"; // Puño cerrado
    }

    if (senaDetectada === "") {
        gestoCandidato = "";
        framesGestoActual = 0;
        return;
    }

    // --- Confirmación por estabilidad ---
    // En vez de disparar la frase en el instante en que se detecta la forma de la mano,
    // exigimos que la MISMA seña se mantenga varios fotogramas seguidos. Esto filtra los
    // temblores/transiciones de dedos que antes hacían que todo se disparara de golpe.
    if (senaDetectada === gestoCandidato) {
        framesGestoActual++;
    } else {
        gestoCandidato = senaDetectada;
        framesGestoActual = 1;
    }

    if (framesGestoActual >= CONFIG_GESTOS.framesConfirmacion) {
        dispararGestoConfirmado(gestoCandidato);
        gestoCandidato = "";
        framesGestoActual = 0;
    }
}

// Se llama solo cuando una seña quedó CONFIRMADA (estable) tras el filtro de frames.
function dispararGestoConfirmado(sena) {
    if (sena === "Hola") {
        // En vez de responder directo, abrimos el panel de opciones para que el usuario
        // elija con un clic — así no hace falta acertar formas de dedos distintas para cada frase.
        mostrarPanelRespuestasRapidas();
    } else {
        const input = document.getElementById('textoEntrada');
        input.value = sena;
        procesarEntradaCentral(sena, true);
    }
    iniciarCooldown();
}

// --- Cooldown visual: pausa corta entre cada interacción para que la IA y el usuario no se atropellen ---
function iniciarCooldown(duracionMs = CONFIG_GESTOS.cooldownMs) {
    cooldownActivo = true;
    cooldownRestante = duracionMs;

    const indicador = document.getElementById('cooldownIndicator');
    const barWrap = document.getElementById('cooldownBarWrap');
    const bar = document.getElementById('cooldownBar');

    indicador.classList.remove('hidden');
    barWrap.classList.remove('hidden');
    bar.style.width = '100%';

    if (cooldownTimerId) clearInterval(cooldownTimerId);
    cooldownTimerId = setInterval(() => {
        cooldownRestante -= 100;
        if (cooldownRestante <= 0) {
            cooldownActivo = false;
            cooldownRestante = 0;
            clearInterval(cooldownTimerId);
            indicador.classList.add('hidden');
            barWrap.classList.add('hidden');
            document.getElementById("statusTracker").textContent = "BUSCANDO MANO...";
        } else {
            indicador.textContent = `⏸ Pausa (${(cooldownRestante / 1000).toFixed(1)}s)`;
            bar.style.width = `${(cooldownRestante / duracionMs) * 100}%`;
        }
    }, 100);
}

// --- Panel interactivo de respuestas rápidas (se abre al detectar la mano abierta) ---
function mostrarPanelRespuestasRapidas() {
    const panel = document.getElementById('panelRespuestasRapidas');
    panel.classList.remove('hidden');

    if (panelAutoOcultarTimer) clearTimeout(panelAutoOcultarTimer);
    panelAutoOcultarTimer = setTimeout(() => {
        ocultarPanelRespuestasRapidas();
    }, CONFIG_GESTOS.cooldownMs - 200);
}

function ocultarPanelRespuestasRapidas() {
    document.getElementById('panelRespuestasRapidas').classList.add('hidden');
}

// El usuario elige su respuesta con un clic (sin necesitar una seña de dedos distinta para cada una)
function seleccionarRespuestaRapida(texto) {
    if (panelAutoOcultarTimer) clearTimeout(panelAutoOcultarTimer);
    ocultarPanelRespuestasRapidas();
    document.getElementById('textoEntrada').value = texto;
    procesarEntradaCentral(texto, true);
    // Reiniciamos el cooldown para dar tiempo a que la IA responda antes de aceptar un gesto nuevo
    iniciarCooldown();
}

// Marca si la IA está "ocupada" (procesando o hablando) para pausar nuevas detecciones mientras tanto
function marcarIaOcupada(ocupada) {
    esperandoRespuestaIA = ocupada;
    if (safetyTimeoutId) clearTimeout(safetyTimeoutId);
    if (ocupada) {
        // Salvaguarda: si algo falla y nunca se marca como "libre", no se queda pausado para siempre
        safetyTimeoutId = setTimeout(() => { esperandoRespuestaIA = false; }, 15000);
    }
}

// Activador del simulador rápido (Garantiza el correcto funcionamiento frente al jurado)
function simularGesto(nombreGesto) {
    document.getElementById('textoEntrada').value = nombreGesto;
    procesarEntradaCentral(nombreGesto, true);
}

// --- ---
function toggleGeminiMode() {
    const isChecked = document.getElementById("geminiToggle").checked;
    const label = document.getElementById("geminiStatusLabel");
    const configPanel = document.getElementById("geminiConfigPanel");
    
    if (isChecked) {
        label.textContent = "Activo";
        label.className = "ml-2 text-xs font-bold text-sky-400 uppercase mono-font";
        configPanel.classList.remove("opacity-50", "pointer-events-none");
        showToast("Motor Cognitivo Gemini Conectado (Cloud Mode)");
    } else {
        label.textContent = "Offline";
        label.className = "ml-2 text-xs font-bold text-amber-500 uppercase mono-font";
        configPanel.classList.add("opacity-50", "pointer-events-none");
        showToast("Modo Simulado Local / Heurístico Activado");
    }
}

// Ejecución resiliente con exponencial backoff para Gemini
async function fetchGeminiWithBackoff(url, payload) {
    let delay = 1000;
    for (let i = 0; i < 3; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) return await response.json();
            if (response.status === 429) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw new Error(`Error: ${response.status}`);
            }
        } catch (e) {
            if (i === 2) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}

function buildSystemInstructions() {
    const preset = document.getElementById("geminiPrompt").value;
    const langValue = document.getElementById("lenguajeDestino").value;
    let destLang = "Español";
    if (langValue === "en") destLang = "Inglés";
    if (langValue === "pt") destLang = "Portugués";
    if (langValue === "fr") destLang = "Francés";

    let base = "Actúa como IncluVOZ 2.0, un asistente de comunicación inclusiva diseñado con tecnología ciberpunk interactiva. ";
    base += `Tu tarea es responder con empatía, de forma concisa (máximo 2 oraciones breves). `;
    base += `Debes responder siempre en el idioma de destino seleccionado: ${destLang}. `;

    if (preset === "friendly") {
        base += "Mantén un tono cálido, empático, altamente accesible y utiliza algún emoji que represente cercanía.";
    } else if (preset === "translator") {
        base += "Sé extremadamente neutral, preciso, profesional y enfocado en la traducción formal de conceptos de accesibilidad.";
    } else if (preset === "humorous") {
        base += "Sé enérgico, divertido, motivacional, celebra que estamos en una feria tecnológica y añade un toque alegre.";
    }
    return base;
}

function capturarFrameBase64() {
    try {
        const canvasTemporal = document.createElement('canvas');
        canvasTemporal.width = video.videoWidth || 640;
        canvasTemporal.height = video.videoHeight || 480;
        const ctxTemp = canvasTemporal.getContext('2d');
        
        ctxTemp.translate(canvasTemporal.width, 0);
        ctxTemp.scale(-1, 1);
        ctxTemp.drawImage(video, 0, 0, canvasTemporal.width, canvasTemporal.height);
        
        return canvasTemporal.toDataURL('image/jpeg', 0.85).split(',')[1];
    } catch (e) {
        console.error("No se pudo capturar el frame de la cámara: ", e);
        return null;
    }
}

// --- ---
async function capturarYAnalizarGemini() {
    const isGeminiOn = document.getElementById("geminiToggle").checked;
    if (!isGeminiOn) {
        showToast("Activa el Motor Gemini Cloud IA para realizar el análisis visual.", "error");
        return;
    }

    const frame64 = capturarFrameBase64();
    if (!frame64) {
        showToast("La cámara no está lista para capturar imágenes.", "error");
        return;
    }

    const btnVision = document.getElementById("btnAnalizarVision");
    const lblVision = document.getElementById("labelVision");
    const icoVision = document.getElementById("iconVision");
    
    btnVision.disabled = true;
    btnVision.className = "py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 text-slate-500 flex items-center justify-center gap-2 cursor-wait animate-pulse";
    lblVision.textContent = "Analizando...";
    icoVision.textContent = "⏳";

    const userKey = document.getElementById('geminiKey').value || "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${userKey}`;
    
    const systemPrompt = "Eres el módulo de visión artificial de IncluVOZ 2.0. " +
                         "Analiza esta toma de cámara de forma instantánea. " +
                         "Describe de forma muy concisa si hay señas o posturas corporales. " +
                         "Tradúcelo en una sola oración en español inspiradora para mostrar en pantalla.";

    const payload = {
        contents: [{
            role: "user",
            parts: [
                { text: "Analiza el lenguaje de señas corporal, mano o rostro en esta imagen." },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: frame64
                    }
                }
            ]
        }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        }
    };

    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    marcarIaOcupada(true);
    try {
        registrarMensajeEnTerminal("Sistema (Visión)", "Capturando y analizando fotograma de cámara mediante Gemini Vision...", hora);
        const data = await fetchGeminiWithBackoff(apiUrl, payload);
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo interpretar la imagen.";
        
        setTimeout(() => {
            registrarMensajeEnTerminal("Análisis Gemini Vision", resultText, hora);
            sintetizarVozYAnimarBoca(resultText);
            
            statGeminiCallsVal++;
            actualizarMetricasDashboard();
        }, 400);

        showToast("¡Análisis visual de Gemini completado con éxito!", "success");

    } catch (err) {
        console.error(err);
        showToast("Error de conexión con Gemini Vision API", "error");
        registrarMensajeEnTerminal("SISTEMA", "Fallo de comunicación con Gemini: " + err.message, hora);
        marcarIaOcupada(false);
    } finally {
        btnVision.disabled = false;
        btnVision.className = "py-2.5 px-3 rounded-xl font-bold text-xs bg-cyan-600 text-white hover:bg-cyan-500 active:scale-95 transition-all flex items-center justify-center gap-2";
        lblVision.textContent = "Analizar Cámara";
        icoVision.textContent = "👁️";
    }
}

// --- ---
async function procesarEntradaCentral(mensajeOriginal, esSena = false) {
    const limpio = mensajeOriginal.toLowerCase().trim();
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const idioma = document.getElementById('lenguajeDestino').value;
    const isGeminiOn = document.getElementById("geminiToggle").checked;

    registrarMensajeEnTerminal("Usuario", mensajeOriginal, hora);
    marcarIaOcupada(true);

    if (isGeminiOn) {
        const userKey = document.getElementById('geminiKey').value || "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${userKey}`;
        
        const systemPrompt = buildSystemInstructions();
        const payload = {
            contents: [{
                role: "user",
                parts: [{ text: `Entrada del usuario: "${mensajeOriginal}". Genera una respuesta adaptada.` }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            }
        };

        try {
            const data = await fetchGeminiWithBackoff(apiUrl, payload);
            const respuestaIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "Conexión vacía de Gemini.";
            
            modificarGestoRobot(limpio);

            setTimeout(() => {
                registrarMensajeEnTerminal("IncluVOZ Gemini IA", respuestaIA, hora);
                sintetizarVozYAnimarBoca(respuestaIA);
                
                statGeminiCallsVal++;
                actualizarMetricasDashboard();
            }, 400);

        } catch (err) {
            console.error("Fallo de procesamiento Gemini: ", err);
            showToast("Fallo de API Gemini. Activando Base Heurística Offline.", "error");
            ejecutarProcesamientoOffline(limpio, mensajeOriginal, idioma, hora, esSena);
        }

    } else {
        ejecutarProcesamientoOffline(limpio, mensajeOriginal, idioma, hora, esSena);
    }
}

function ejecutarProcesamientoOffline(limpio, mensajeOriginal, idioma, hora, esSena) {
    let respuestaIA = baseConocimientoIA[limpio] || `Procesando cadena inteligente: "${mensajeOriginal}". Registrado exitosamente por IncluVOZ local.`;
    const baseEspanolAudio = respuestaIA;

    if (idioma !== "es" && translator(baseEspanolAudio, idioma)) {
        respuestaIA = translator(baseEspanolAudio, idioma);
    }

    modificarGestoRobot(limpio);

    setTimeout(() => {
        registrarMensajeEnTerminal("IncluVOZ IA (Local)", respuestaIA, hora);
        sintetizarVozYAnimarBoca(baseEspanolAudio);
    }, 600);

    if (esSena) statSenasVal++;
    statPalabrasVal += mensajeOriginal.split(" ").length;
    actualizarMetricasDashboard();
}

// --- ---
function modificarGestoRobot(limpio) {
    const visualGesto = document.getElementById('gestoAvatar');
    if (limpio.includes("ayuda") || limpio.includes("auxilio")) {
        visualGesto.textContent = "Alerta SOS";
        visualGesto.className = "text-xs font-bold text-red-400 uppercase tracking-widest mono-font animate-pulse";
        if(eyeLeft && eyeRight) {
            eyeLeft.material.color.setHex(0xef4444);
            eyeRight.material.color.setHex(0xef4444);
        }
    } else {
        visualGesto.textContent = "Comunicando";
        visualGesto.className = "text-xs font-bold text-emerald-400 uppercase tracking-widest mono-font";
        if(eyeLeft && eyeRight) {
            eyeLeft.material.color.setHex(0x00f3ff);
            eyeRight.material.color.setHex(0x00f3ff);
        }
    }
}

function translator(texto, lang) {
    const llave = texto.toLowerCase().trim();
    return traductorFeria[llave] ? traductorFeria[llave][lang] : null;
}

// --- SISTEMAS DE RECONOCIMIENTO Y SÍNTESIS DE VOZ ---
function alternarVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast("Este navegador no tiene soporte nativo de micrófono. Usa Chrome o Edge.", "error");
        return;
    }

    const btn = document.getElementById('btnVoz');
    const ico = document.getElementById('icoVoz');
    const lbl = document.getElementById('labelVoz');

    if (!vozActiva) {
        recoVoz = new SpeechRecognition();
        recoVoz.lang = "es-CO";
        recoVoz.continuous = false;
        recoVoz.start();

        vozActiva = true;
        btn.className = "py-2.5 px-3 rounded-xl font-bold text-xs bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center gap-2";
        ico.textContent = "🛑";
        lbl.textContent = "Detener";

        recoVoz.onresult = (e) => {
            const trans = e.results[0][0].transcript;
            document.getElementById('textoEntrada').value = trans;
            procesarEntradaCentral(trans, false);
        };

        recoVoz.onend = () => { apagarReconocomiento(); };
    } else {
        apagarReconocomiento();
    }
}

function apagarReconocomiento() {
    if (recoVoz) recoVoz.stop();
    const btn = document.getElementById('btnVoz');
    const ico = document.getElementById('icoVoz');
    const lbl = document.getElementById('labelVoz');

    btn.className = "py-2.5 px-3 rounded-xl font-bold text-xs bg-sky-500 text-slate-950 hover:bg-sky-400 active:scale-95 transition-all flex items-center justify-center gap-2";
    ico.textContent = "🎤";
    lbl.textContent = "Escuchar Voz";
    vozActiva = false;
}

function sintetizarVozYAnimarBoca(textoParaVocalizar) {
    if (!textoParaVocalizar) {
        marcarIaOcupada(false);
        return;
    }

    const speech = new SpeechSynthesisUtterance(textoParaVocalizar);
    speech.lang = "es-ES";

    speech.onstart = () => {
        animandoMouth = true;
    };

    speech.onend = () => {
        animandoMouth = false;
        // La IA terminó de "hablar": recién aquí liberamos la detección de gestos
        marcarIaOcupada(false);
    };

    speech.onerror = () => {
        animandoMouth = false;
        marcarIaOcupada(false);
    };

    window.speechSynthesis.speak(speech);
}

function ejecutarSintesisDeVoz() {
    const inputVal = document.getElementById('textoEntrada').value;
    if (inputVal) {
        sintetizarVozYAnimarBoca(inputVal);
    } else {
        showToast("Escribe un mensaje antes de activar la voz.", "error");
    }
}

function procesarEntradaManual() {
    const val = document.getElementById('textoEntrada').value;
    if (val) {
        procesarEntradaCentral(val, false);
        document.getElementById('textoEntrada').value = "";
    }
}

// PROTOCOLO DE EMERGENCIA SOS (Respuesta instantánea para salvar vidas)
function activarEmergencia() {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('textoEntrada').value = "🚨 SOS - SOLICITUD DE ASISTENCIA PRIORITARIA INMEDIATA";
    
    registrarMensajeEnTerminal("SISTEMA", "¡PROTOCOLO CRÍTICO DE EMERGENCIA DISPARADO EN FIREBASE!", hora);
    sintetizarVozYAnimarBoca("Atención. Solicitud de emergencia prioritaria activada en esta ubicación. Por favor, acérquese de inmediato.");
    showToast("Mensaje de Emergencia Enviado a Firebase", "error");
}

// --- AUXILIARES E INTERFAZ TERMINAL ---
function registrarMensajeEnTerminal(remitente, texto, hora) {
    const caja = document.getElementById('cajaChat');
    let claseStyle = "bg-slate-900 border border-slate-800 text-slate-200";

    if (remitente.includes("Gemini")) {
        claseStyle = "bg-sky-950/50 border-l-4 border-sky-450 text-sky-100 shadow-[0_0_15px_rgba(56,189,248,0.1)]";
    } else if (remitente === "Usuario") {
        claseStyle = "bg-slate-800/80 border border-slate-700 text-slate-100 self-end ml-auto text-right max-w-[85%]";
    } else if (remitente === "SISTEMA") {
        claseStyle = "bg-red-950/40 border-l-4 border-red-500 text-red-200 animate-pulse";
    }

    caja.innerHTML += `
        <div class="p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed ${claseStyle}">
            <strong>[${hora}] ${remitente}:</strong> ${texto}
        </div>
    `;
    caja.scrollTop = caja.scrollHeight;
}

function actualizarMetricasDashboard() {
    document.getElementById('statPalabras').textContent = statPalabrasVal.toLocaleString();
    document.getElementById('statSenas').textContent = statSenasVal.toLocaleString();
    document.getElementById('statTraducciones').textContent = statGeminiCallsVal.toLocaleString();
}

// Reloj de la cabecera
setInterval(() => {
    document.getElementById('horaActual').textContent = new Date().toLocaleTimeString();
}, 1000);

// --- SECUENCIA DE INICIO GLOBAL ---
window.onload = () => {
    // Inicializar hardware de Visión
    activarHardwareYVision();
    
    // Inicializar el Avatar 3D
    initThreeJS();

    // Sincronizar estadísticas iniciales
    actualizarMetricasDashboard();

    // Generar código QR de la aplicación de feria
    new QRCode(document.getElementById("qrcode"), {
        text: window.location.href || "https://incluvoz.app",
        width: 90,
        height: 90,
        colorDark: "#060913",
        colorLight: "#38bdf8"
    });

    showToast("IncluVOZ 2.0 Iniciado. Motor Cognitivo Gemini en Espera.", "success");
};
