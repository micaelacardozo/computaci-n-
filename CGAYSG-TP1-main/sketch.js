let trazosVerticales = [];
let trazosHorizontales = [];
let trazosDiagonales = [];

let fondos = [];
let fondoActual = 0;
let fondoAnterior = 0;
let transicionFondo = 1;

let dibujos = [];
let maxTrazosHorizontal = 120;
let maxTrazosVertical = 90;
let maxTrazosDiagonal = 100;
let maxTrazosDiagonalInversa = 95;

let mic;
let fft;
let audioActivo = false;
let audioIniciado = false;

let amplitud = 0;
let amplitudSuavizada = 0;
let amplitudAnterior = 0;
let incrementoAmplitud = 0;
let graves = 0;
let medios = 0;
let agudos = 0;
let sibilantes = 0;
let diferenciaBandas = 0;
let duracionSonido = 0;
let estadoSonoro = "silencio";
let duracionSostenido = 2200;
let estadoCandidato = "";
let tiempoEstadoCandidato = 0;
let tiempoParaDefinirFamilia = 700;
let aplausoDetectado = false;
let tiempoUltimoAplauso = -1000;
let intervaloAplauso = 900;
let debugAplausoPico = false;
let debugAplausoPredominio = false;
let debugAplausoBreve = false;
let debugAplausoCooldown = false;
let debugAplausoRuido = false;

let aplausoCandidato = false;
let aplausoCandidatoPico = 0;
let aplausoCandidatoInicio = 0;
let tiempoConfirmacionAplauso = 200;
let umbralCaidaAplauso = 0.4;

let umbralSonido = 0.005;
let umbralAlto = 0.014;
let ultimoAgregar = 0;
let ultimoBorrar = 0;
let ultimoFondo = 0;
let intervaloAgregar = 260;
let intervaloBorrar = 520;
let intervaloFondo = 1800;

let centroideEspectral = 0;
let planitudEspectral = 1;
let centroideSuavizado = 0;
let planitudSuavizada = 1;
let desviacionCentroide = 0;

let TAM_BUFFER_ANALISIS = 20;
let bufferCentroide = new Array(TAM_BUFFER_ANALISIS).fill(0);
let bufferPlanitud = new Array(TAM_BUFFER_ANALISIS).fill(1);
let bufferProporcionGrave = new Array(TAM_BUFFER_ANALISIS).fill(0);
let bufferProporcionAguda = new Array(TAM_BUFFER_ANALISIS).fill(0);
let indiceBufferAnalisis = 0;
let estabaEnSilencioAnterior = true;
let sonidoActivoConHisteresis = false;
let umbralSalidaSonido = 0.003;

let tiempoMinimoSostenido = 850;

let margenHisteresis = 0.10;
let umbralMinimoConfianza = 0.30;
let ultimosScores = {};

let estadoCandidatoFondo = "";
let contadorConfirmacionFondo = 0;
let tiempoConfirmacionFondo = 400;

let mostrarPanelDebug = true;
let mostrarLogsTrazos = true;
let ultimoLogTrazos = 0;

let nucleoX;
let nucleoY;
let nucleoBaseX;
let nucleoBaseY;

let desviacionX;
let desviacionY;
let desviacionBaseX;
let desviacionBaseY;

let familiaDefinida = false;
let modoCompositivo = "";
let anguloRector = 0;
let variacionAngular = 15;
let probabilidadFueraDeRegla = 0.03;

function preload() {
  for (let i = 1; i <= 13; i++) {
    let nombre = "trazos/trazo v " + i + ".png";
    let imagen = loadImage(nombre);
    imagen.nombreArchivo = nombre;
    trazosVerticales.push(imagen);
  }

  let indicesHorizontales = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];
  for (let i = 0; i < indicesHorizontales.length; i++) {
    let nombre = "trazos/trazo h " + indicesHorizontales[i] + ".png";
    let imagen = loadImage(nombre);
    imagen.nombreArchivo = nombre;
    trazosHorizontales.push(imagen);
  }

  for (let i = 1; i <= 20; i++) {
    let nombre = "trazos/trazo d " + i + ".png";
    let imagen = loadImage(nombre);
    imagen.nombreArchivo = nombre;
    trazosDiagonales.push(imagen);
  }

  for (let i = 0; i <= 5; i++) {
    fondos[i] = loadImage("fondos/fondo" + i + ".png");
  }

  console.log("preload()", {
    trazosVerticales: trazosVerticales.length,
    trazosHorizontales: trazosHorizontales.length,
    trazosDiagonales: trazosDiagonales.length,
    fondos: fondos.length
  });
}

function setup() {
  createCanvas(720, 1080);
  imageMode(CORNER);
  textFont("monospace");

  inicializarComposicion();

  mic = new p5.AudioIn();
  fft = new p5.FFT(0.85, 1024);
  fft.setInput(mic);
}

function draw() {
  analizarAudio();
  actualizarEstadoSonoro();
  actualizarObra();

  dibujarFondo();
  dibujarTrazos();

  if (mostrarPanelDebug) {
    mostrarDebug();
  }
}

function mousePressed() {
  activarAudio();
}

function keyPressed() {
  if (key === "a" || key === "A") {
    activarAudio();
  }

  if (key === "r" || key === "R") {
    borrarTrazo();
  }

  if (key === "f" || key === "F" || key === " ") {
    cambiarFondo();
  }

  if (key === "x" || key === "X") {
    reiniciarObra();
  }

  if (key === "d" || key === "D") {
    mostrarPanelDebug = !mostrarPanelDebug;
  }

  if (key === "t" || key === "T") {
    if (!familiaDefinida) {
      definirFamiliaCompositiva();
    }

    agregarGrupoDeTrazos("fino");
  }
}

function activarAudio() {
  if (audioIniciado) {
    return;
  }

  userStartAudio().then(function () {
    mic.start(
      function () {
        fft.setInput(mic);
        audioActivo = true;
        audioIniciado = true;
      },
      function () {
        audioActivo = false;
        audioIniciado = false;
      }
    );
  });
}

function calcularFeaturesEspectrales(spectrum) {
  let nyquist = sampleRate() / 2;
  let anchoBin = nyquist / spectrum.length;

  let indiceMin = floor(60 / anchoBin);
  let indiceMax = min(spectrum.length - 1, ceil(8000 / anchoBin));

  let sumaPonderada = 0;
  let sumaMagnitudes = 0;
  let sumaLogMagnitudes = 0;
  let cantidadBins = 0;

  for (let i = indiceMin; i <= indiceMax; i++) {
    let magnitud = spectrum[i];
    let magnitudSegura = magnitud + 1;
    let frecuencia = i * anchoBin;

    sumaPonderada += frecuencia * magnitud;
    sumaMagnitudes += magnitud;
    sumaLogMagnitudes += log(magnitudSegura);
    cantidadBins++;
  }

  let centroide = sumaMagnitudes > 0 ? sumaPonderada / sumaMagnitudes : 0;
  let mediaAritmetica = sumaMagnitudes / cantidadBins + 1;
  let mediaGeometrica = exp(sumaLogMagnitudes / cantidadBins);
  let planitud = mediaAritmetica > 0 ? mediaGeometrica / mediaAritmetica : 0;

  return {
    centroide: centroide,
    planitud: constrain(planitud, 0, 1)
  };
}

function empujarBuffer(centroide, planitud, grave, media, aguda) {
  let energiaTotal = grave + media + aguda + 1;

  bufferCentroide[indiceBufferAnalisis] = centroide;
  bufferPlanitud[indiceBufferAnalisis] = planitud;
  bufferProporcionGrave[indiceBufferAnalisis] = grave / energiaTotal;
  bufferProporcionAguda[indiceBufferAnalisis] = aguda / energiaTotal;

  indiceBufferAnalisis = (indiceBufferAnalisis + 1) % TAM_BUFFER_ANALISIS;
}

function reiniciarBufferAnalisis(centroide, planitud, grave, media, aguda) {
  let energiaTotal = grave + media + aguda + 1;

  bufferCentroide.fill(centroide);
  bufferPlanitud.fill(planitud);
  bufferProporcionGrave.fill(grave / energiaTotal);
  bufferProporcionAguda.fill(aguda / energiaTotal);

  indiceBufferAnalisis = 0;
}

function promedioBuffer(buffer) {
  let suma = 0;

  for (let i = 0; i < buffer.length; i++) {
    suma += buffer[i];
  }

  return suma / buffer.length;
}

function desviacionEstandarBuffer(buffer, media) {
  let sumaCuadrados = 0;

  for (let i = 0; i < buffer.length; i++) {
    let diferencia = buffer[i] - media;
    sumaCuadrados += diferencia * diferencia;
  }

  return sqrt(sumaCuadrados / buffer.length);
}

function analizarAudio() {
  if (!audioActivo) {
    amplitud = 0;
    amplitudSuavizada = 0;
    amplitudAnterior = 0;
    incrementoAmplitud = 0;
    graves = 0;
    medios = 0;
    agudos = 0;
    sibilantes = 0;
    diferenciaBandas = 0;
    duracionSonido = 0;
    aplausoDetectado = false;
    aplausoCandidato = false;
    aplausoCandidatoPico = 0;
    centroideEspectral = 0;
    planitudEspectral = 1;
    centroideSuavizado = 0;
    planitudSuavizada = 1;
    desviacionCentroide = 0;
    sonidoActivoConHisteresis = false;
    estabaEnSilencioAnterior = true;
    return;
  }

  amplitudAnterior = amplitud;
  amplitud = mic.getLevel();
  incrementoAmplitud = max(0, amplitud - amplitudAnterior);
  amplitudSuavizada = lerp(amplitudSuavizada, amplitud, 0.18);

  let spectrum = fft.analyze();
  graves = fft.getEnergy(50, 300);
  medios = fft.getEnergy(300, 1800);
  agudos = fft.getEnergy(1800, 5000);
  sibilantes = fft.getEnergy(3000, 9000);
  diferenciaBandas = max(graves, medios, agudos) - min(graves, medios, agudos);

  let featuresEspectrales = calcularFeaturesEspectrales(spectrum);
  centroideEspectral = featuresEspectrales.centroide;
  planitudEspectral = featuresEspectrales.planitud;

  if (sonidoActivoConHisteresis) {
    if (amplitudSuavizada <= umbralSalidaSonido) {
      sonidoActivoConHisteresis = false;
    }
  } else {
    if (amplitudSuavizada > umbralSonido) {
      sonidoActivoConHisteresis = true;
    }
  }

  let hayNota = sonidoActivoConHisteresis;
  let entrandoDesdeSilencio = estabaEnSilencioAnterior && hayNota;
  estabaEnSilencioAnterior = !hayNota;

  if (hayNota) {
    if (entrandoDesdeSilencio) {
      reiniciarBufferAnalisis(centroideEspectral, planitudEspectral, graves, medios, agudos);
    } else {
      empujarBuffer(centroideEspectral, planitudEspectral, graves, medios, agudos);
    }
  }

  centroideSuavizado = promedioBuffer(bufferCentroide);
  planitudSuavizada = promedioBuffer(bufferPlanitud);
  desviacionCentroide = desviacionEstandarBuffer(bufferCentroide, centroideSuavizado);

  detectarAplauso();

  if (hayNota) {
    duracionSonido += deltaTime;
  } else {
    duracionSonido = 0;
  }
}

function calcularScores() {
  let centroideMin = 150;
  let centroideMax = 1900;
  let centroideNorm = constrain(map(centroideSuavizado, centroideMin, centroideMax, 0, 1), 0, 1);

  let tonalidad = 1 - planitudSuavizada;

  let proporcionGrave = promedioBuffer(bufferProporcionGrave);
  let proporcionAguda = promedioBuffer(bufferProporcionAguda);

  let scoreAgudo = 0.55 * centroideNorm + 0.15 * tonalidad + 0.30 * proporcionAguda;

  let scoreGrave = 0.30 * (1 - centroideNorm) + 0.15 * tonalidad + 0.55 * proporcionGrave;

  let scoreNoTonal = 1 - tonalidad;

  let estabilidadCentroide = constrain(map(desviacionCentroide, 0, 700, 1, 0), 0, 1);
  let factorDuracion = constrain(map(duracionSonido, tiempoMinimoSostenido, duracionSostenido, 0, 1), 0, 1);
  let neutralidadPitch = constrain(1 - abs(centroideNorm - 0.5) * 2, 0, 1);
  let extremidadBanda = max(proporcionGrave, proporcionAguda);
  let scoreSostenido =
    0.40 * estabilidadCentroide +
    0.20 * factorDuracion +
    0.15 * tonalidad +
    0.25 * neutralidadPitch -
    0.35 * extremidadBanda;
  scoreSostenido = constrain(scoreSostenido, 0, 1);

  return {
    "agudo": scoreAgudo,
    "grave bajo/medio": scoreGrave,
    "sostenido": scoreSostenido,
    "no tonal": scoreNoTonal
  };
}

function actualizarEstadoSonoro() {
  if (!audioActivo) {
    estadoSonoro = "mic inactivo";
    return;
  }

  if (!sonidoActivoConHisteresis) {
    estadoSonoro = "silencio";
    return;
  }

  let scores = calcularScores();

  let mejorEstado = "sonido medio";
  let mejorScore = umbralMinimoConfianza;

  for (let nombre in scores) {
    if (scores[nombre] > mejorScore) {
      mejorScore = scores[nombre];
      mejorEstado = nombre;
    }
  }

  let scoreEstadoActual = scores[estadoSonoro];

  if (
    scoreEstadoActual !== undefined &&
    scoreEstadoActual >= umbralMinimoConfianza &&
    scoreEstadoActual >= mejorScore - margenHisteresis
  ) {
    ultimosScores = scores;
    return;
  }

  estadoSonoro = mejorEstado;
  ultimosScores = scores;
}

function detectarAplauso() {
  aplausoDetectado = false;

  let ahora = millis();
  let energiaGolpe = medios + agudos + sibilantes;
  let predominioMedioAgudo = energiaGolpe > graves * 1.35;
  let picoRepentino = amplitud > 0.05 && incrementoAmplitud > 0.03;
  let sinCooldown = ahora - tiempoUltimoAplauso > intervaloAplauso;

  debugAplausoPico = picoRepentino;
  debugAplausoPredominio = predominioMedioAgudo;
  debugAplausoCooldown = sinCooldown;
  debugAplausoRuido = true;

  if (!aplausoCandidato) {
    if (picoRepentino && predominioMedioAgudo && sinCooldown) {
      aplausoCandidato = true;
      aplausoCandidatoPico = amplitud;
      aplausoCandidatoInicio = ahora;
      debugAplausoBreve = false;
    }

    return;
  }

  if (amplitud > aplausoCandidatoPico) {
    aplausoCandidatoPico = amplitud;
  }

  let tiempoTranscurrido = ahora - aplausoCandidatoInicio;

  if (tiempoTranscurrido < tiempoConfirmacionAplauso) {
    return;
  }

  let cayoRelativoAlPico = amplitud < aplausoCandidatoPico * umbralCaidaAplauso;
  let cayoCercaDelSilencio = amplitud < umbralSonido * 2.5;
  let cayoLoSuficiente = cayoRelativoAlPico && cayoCercaDelSilencio;
  debugAplausoBreve = cayoLoSuficiente;

  if (cayoLoSuficiente) {
    aplausoDetectado = true;
    tiempoUltimoAplauso = ahora;
  }

  aplausoCandidato = false;
}

function actualizarCandidatoFamilia(nuevoEstado) {
  let estadoValido =
    nuevoEstado === "agudo" ||
    nuevoEstado === "grave bajo/medio" ||
    nuevoEstado === "sostenido" ||
    nuevoEstado === "sonido medio" ||
    nuevoEstado === "no tonal";

  if (!estadoValido) {
    estadoCandidato = "";
    tiempoEstadoCandidato = 0;
    return;
  }

  if (nuevoEstado !== estadoCandidato) {
    if (tiempoEstadoCandidato > 150) {
      tiempoEstadoCandidato -= 150;
    } else {
      estadoCandidato = nuevoEstado;
      tiempoEstadoCandidato = 0;
    }
    return;
  }

  tiempoEstadoCandidato += deltaTime;

  if (tiempoEstadoCandidato >= tiempoParaDefinirFamilia) {
    definirFamiliaCompositiva();
    estadoCandidato = "";
    tiempoEstadoCandidato = 0;
  }
}

function actualizarObra() {
  let ahora = millis();

  if (aplausoDetectado) {
    reiniciarObraPorAplauso();
    return;
  }

  actualizarComposicionSonora();

  if (estadoSonoro === "silencio" || estadoSonoro === "mic inactivo") {
    actualizarCandidatoFamilia("");
    estadoCandidatoFondo = "";
    contadorConfirmacionFondo = 0;
    respirarObra();
    return;
  }

  if (!familiaDefinida) {
    actualizarCandidatoFamilia(estadoSonoro);
    return;
  }

  if (estadoSonoro === "agudo" && ahora - ultimoAgregar > intervaloAgregar) {
    agregarGrupoDeTrazos("fino");
    ultimoAgregar = ahora;
  }

  if (estadoSonoro === "grave bajo/medio") {
    if (estadoCandidatoFondo !== "grave bajo/medio") {
      estadoCandidatoFondo = "grave bajo/medio";
      contadorConfirmacionFondo = 0;
    } else {
      contadorConfirmacionFondo += deltaTime;
    }

    let graveConfirmado = contadorConfirmacionFondo >= tiempoConfirmacionFondo;

    if (graveConfirmado && ahora - ultimoFondo > intervaloFondo) {
      cambiarFondo();
      ultimoFondo = ahora;
    }
  } else {
    estadoCandidatoFondo = "";
    contadorConfirmacionFondo = 0;
  }

  if (estadoSonoro === "no tonal" && ahora - ultimoBorrar > intervaloBorrar) {
    borrarTrazo();
    ultimoBorrar = ahora;
  }

  if (estadoSonoro === "sostenido" && ahora - ultimoAgregar > intervaloAgregar * 1.4) {
    agregarGrupoDeTrazos("largo");
    ultimoAgregar = ahora;
  }

  if (transicionFondo < 1) {
    transicionFondo += 0.025;
  } else {
    transicionFondo = 1;
  }
}

function respirarObra() {
  if (transicionFondo < 1) {
    transicionFondo += 0.01;
  }
}

function inicializarComposicion() {
  nucleoBaseX = width * 0.5;
  nucleoBaseY = height * 0.52;
  nucleoX = nucleoBaseX;
  nucleoY = nucleoBaseY;

  desviacionBaseX = width * 0.075;
  desviacionBaseY = height * 0.095;
  desviacionX = desviacionBaseX;
  desviacionY = desviacionBaseY;

  familiaDefinida = false;
  modoCompositivo = "";
  anguloRector = 0;
  estadoCandidato = "";
  tiempoEstadoCandidato = 0;
  aplausoDetectado = false;
  estadoCandidatoFondo = "";
  contadorConfirmacionFondo = 0;
}

function actualizarComposicionSonora() {
  let objetivoX = nucleoBaseX;
  let objetivoY = nucleoBaseY;
  let objetivoDesviacionX = desviacionBaseX;
  let objetivoDesviacionY = desviacionBaseY;

  if (estadoSonoro === "agudo") {
    objetivoY = height * 0.45;
  } else if (estadoSonoro === "grave bajo/medio") {
    objetivoY = height * 0.60;
  } else if (estadoSonoro === "sostenido") {
    objetivoDesviacionX = width * 0.10;
    objetivoDesviacionY = height * 0.12;
  } else if (estadoSonoro === "no tonal") {
    objetivoX = nucleoBaseX + sin(frameCount * 0.025) * width * 0.025;
  }

  nucleoX = lerp(nucleoX, objetivoX, 0.025);
  nucleoY = lerp(nucleoY, objetivoY, 0.025);
  desviacionX = lerp(desviacionX, objetivoDesviacionX, 0.02);
  desviacionY = lerp(desviacionY, objetivoDesviacionY, 0.02);
}

function definirFamiliaCompositiva() {
  if (familiaDefinida) {
    return;
  }

  let modosPosibles = ["vertical", "horizontal", "diagonal", "diagonal_inversa"];
  modoCompositivo = random(modosPosibles);

  if (modoCompositivo === "diagonal") {
    anguloRector = 45;
  } else if (modoCompositivo === "diagonal_inversa") {
    anguloRector = -45;
  } else {
    anguloRector = 0;
  }

  familiaDefinida = true;

  if (mostrarLogsTrazos) {
    console.log("familia compositiva definida (random)", {
      modoCompositivo: modoCompositivo,
      anguloRector: anguloRector
    });
  }
}

function agregarGrupoDeTrazos(tipo) {
  if (!familiaDefinida) {
    definirFamiliaCompositiva();
  }

  let cantidad;

  if (tipo === "fino") {
    cantidad = int(random(4, 7));
  } else {
    cantidad = int(random(3, 7));
  }

  for (let i = 0; i < cantidad; i++) {
    agregarTrazo(tipo);
  }
}

function obtenerMaxTrazosActual() {
  if (modoCompositivo === "horizontal") {
    return maxTrazosHorizontal;
  }

  if (modoCompositivo === "vertical") {
    return maxTrazosVertical;
  }

  if (modoCompositivo === "diagonal") {
    return maxTrazosDiagonal;
  }

  if (modoCompositivo === "diagonal_inversa") {
    return maxTrazosDiagonalInversa;
  }

  return maxTrazosHorizontal;
}

function marcarTrazoMasViejoParaDesvanecer() {
  for (let i = 0; i < dibujos.length; i++) {
    if (!dibujos[i].desvaneciendo) {
      dibujos[i].desvaneciendo = true;
      return;
    }
  }
}

function agregarTrazo(tipo) {
  if (dibujos.length >= obtenerMaxTrazosActual()) {
    marcarTrazoMasViejoParaDesvanecer();
  }

  let fueraDeRegla = random() < probabilidadFueraDeRegla;
  let imagen = elegirImagenTrazo(fueraDeRegla);
  let direccion = modoCompositivo;
  let posicion = calcularPosicionGaussiana();
  let anguloTrazo = calcularRotacionTrazo(fueraDeRegla);
  let opacidad = elegirOpacidad(tipo);

  dibujos.push({
    imagen: imagen,
    x: posicion.x,
    y: posicion.y,
    altoVisible: 0,
    escala: tipo === "fino" ? random(0.28, 0.58) : random(0.45, 0.9),
    opacidad: opacidad,
    velocidad: tipo === "largo" ? random(16, 34) : random(8, 22),
    direccion: direccion,
    angulo: anguloTrazo,
    fueraDeRegla: fueraDeRegla,
    curva: random(-28, 28),
    desvaneciendo: false
  });

  if (mostrarLogsTrazos) {
    let dibujoNuevo = dibujos[dibujos.length - 1];

    console.log("agregarTrazo()", {
      cantidadDibujos: dibujos.length,
      modoCompositivo: modoCompositivo,
      imagenElegida: imagen ? imagen.nombreArchivo : "imagen no cargada",
      anchoOriginal: imagen ? imagen.width : "imagen no cargada",
      altoOriginal: imagen ? imagen.height : "imagen no cargada",
      x: dibujoNuevo.x,
      y: dibujoNuevo.y,
      opacidad: dibujoNuevo.opacidad,
      escala: dibujoNuevo.escala,
      direccion: dibujoNuevo.direccion,
      fueraDeRegla: dibujoNuevo.fueraDeRegla,
      nucleoX: nucleoX,
      nucleoY: nucleoY,
      desviacionX: desviacionX,
      desviacionY: desviacionY,
      angulo: dibujoNuevo.angulo
    });
  }
}

function elegirImagenTrazo(fueraDeRegla) {
  if (!fueraDeRegla) {
    if (modoCompositivo === "vertical") {
      return random(trazosVerticales);
    }

    if (modoCompositivo === "horizontal") {
      return random(trazosHorizontales);
    }

    return random(trazosDiagonales);
  }

  let familiasAlternativas = [];

  if (modoCompositivo !== "vertical") {
    familiasAlternativas.push(trazosVerticales);
  }

  if (modoCompositivo !== "horizontal") {
    familiasAlternativas.push(trazosHorizontales);
  }

  if (modoCompositivo !== "diagonal" && modoCompositivo !== "diagonal_inversa") {
    familiasAlternativas.push(trazosDiagonales);
  }

  return random(random(familiasAlternativas));
}

function calcularRotacionTrazo(fueraDeRegla) {
  if (!fueraDeRegla) {
    return anguloRector + random(-variacionAngular, variacionAngular);
  }

  let desvio = random([random(65, 115), random(-115, -65)]);
  return anguloRector + desvio;
}

function calcularPosicionGaussiana() {
  let x = randomGaussian(nucleoX, desviacionX);
  let y = randomGaussian(nucleoY, desviacionY);

  let limiteXMin;
  let limiteXMax;
  let limiteYMin;
  let limiteYMax;

  if (modoCompositivo === "horizontal") {
    limiteXMin = width * 0.28;
    limiteXMax = width * 0.72;
    limiteYMin = height * 0.05;
    limiteYMax = height * 0.95;
  } else {
    limiteXMin = width * 0.36;
    limiteXMax = width * 0.64;
    limiteYMin = height * 0.10;
    limiteYMax = height * 0.72;
  }

  x = constrain(x, limiteXMin, limiteXMax);
  y = constrain(y, limiteYMin, limiteYMax);

  return {
    x: x,
    y: y
  };
}

function elegirOpacidad(tipo) {
return 255;
}

function borrarTrazo() {
  let cantidad = min(int(random(2, 4)), dibujos.length);

  for (let i = 0; i < cantidad; i++) {
    let indice = dibujos.length - 1 - i;

    if (indice >= 0) {
      dibujos[indice].desvaneciendo = true;
    }
  }
}

function cambiarFondo() {
  fondoAnterior = fondoActual;
  fondoActual++;

  if (fondoActual >= fondos.length) {
    fondoActual = 0;
  }

  transicionFondo = 0;
}

function dibujarFondo() {
  background(255);

  tint(255, 255);
  image(fondos[fondoAnterior], 0, 0, width, height);

  tint(255, transicionFondo * 255);
  image(fondos[fondoActual], 0, 0, width, height);
  noTint();
}

function dibujarTrazos() {
  if (mostrarLogsTrazos && millis() - ultimoLogTrazos > 1200) {
    console.log("dibujarTrazos()", {
      cantidadDibujos: dibujos.length,
      estadoSonoro: estadoSonoro,
      amplitud: amplitud,
      amplitudSuavizada: amplitudSuavizada,
      graves: graves,
      medios: medios,
      agudos: agudos,
      sibilantes: sibilantes,
      diferenciaBandas: diferenciaBandas,
      centroideSuavizado: centroideSuavizado,
      planitudSuavizada: planitudSuavizada,
      umbralSonido: umbralSonido,
      umbralAlto: umbralAlto
    });

    ultimoLogTrazos = millis();
  }

  imageMode(CENTER);

  for (let i = dibujos.length - 1; i >= 0; i--) {
    let dibujo = dibujos[i];
    let imagenTrazo = dibujo.imagen;

    if (!imagenTrazo) {
      continue;
    }

    let anchoTrazo = imagenTrazo.width * dibujo.escala;
    let altoTrazo = imagenTrazo.height * dibujo.escala;

    if (dibujo.altoVisible < altoTrazo) {
      dibujo.altoVisible += dibujo.velocidad;
    }

    let alturaActual = min(dibujo.altoVisible, altoTrazo);
    let proporcionVisible = alturaActual / altoTrazo;
    let altoFuente = imagenTrazo.height * proporcionVisible;

    push();
    translate(dibujo.x, dibujo.y);
    rotate(radians(dibujo.angulo));

    if (dibujo.direccion === "curva") {
      shearX(radians(dibujo.curva * 0.15));
    }

    tint(255, dibujo.opacidad);
    image(
      imagenTrazo,
      0,
      -altoTrazo / 2 + alturaActual / 2,
      anchoTrazo,
      alturaActual,
      0,
      0,
      imagenTrazo.width,
      altoFuente
    );
    noTint();
    pop();

    if (dibujo.desvaneciendo) {
      dibujo.opacidad -= 8;

      if (dibujo.opacidad <= 0) {
        noTint();
        imageMode(CORNER);
        dibujos.splice(i, 1);
        imageMode(CENTER);
      }
    }
  }

  noTint();
  imageMode(CORNER);
}

function mostrarDebug() {
  push();
  imageMode(CORNER);
  noStroke();
  noTint();
  fill(0, 175);
  rect(16, 16, 450, 854, 6);

  fill(255);
  textSize(14);
  text("A/click: activar audio | T: test trazos | D: debug", 28, 40);
  text("R: desvanecer | F/espacio: fondo | X: reiniciar", 28, 64);
  text("audioActivo: " + audioActivo + "  sonido (histeresis): " + sonidoActivoConHisteresis, 28, 94);
  text("amplitud: " + nf(amplitud, 1, 4), 28, 118);
  text("amp suavizada: " + nf(amplitudSuavizada, 1, 4), 28, 142);
  text("graves: " + int(graves) + "  medios: " + int(medios) + "  agudos: " + int(agudos), 28, 166);
  text("sibilantes: " + int(sibilantes) + "  dif bandas: " + int(diferenciaBandas), 28, 190);
  text("duracion: " + int(duracionSonido) + " ms", 28, 214);

  text("--- features espectrales ---", 28, 244);
  text("centroide (inst): " + int(centroideEspectral) + " Hz", 28, 266);
  text("centroide (suavizado): " + int(centroideSuavizado) + " Hz", 28, 288);
  text("desviacion centroide: " + int(desviacionCentroide), 28, 310);
  text("planitud (inst): " + nf(planitudEspectral, 1, 3), 28, 332);
  text("planitud (suavizada): " + nf(planitudSuavizada, 1, 3), 28, 354);

  text("--- scores (0 a 1) ---", 28, 384);
  let y = 406;
  for (let nombre in ultimosScores) {
    text(nombre + ": " + nf(ultimosScores[nombre], 1, 3), 28, y);
    y += 22;
  }

  text("--- estado ---", 28, y + 12);
  y += 34;
  text("estadoSonoro: " + estadoSonoro, 28, y);
  y += 24;
  text("estado candidato (familia): " + estadoCandidato, 28, y);
  y += 24;
  text("tiempo candidato: " + int(tiempoEstadoCandidato) + " / " + tiempoParaDefinirFamilia + " ms", 28, y);
  y += 24;
  text("confirmacion fondo: " + int(contadorConfirmacionFondo) + " / " + tiempoConfirmacionFondo + " ms", 28, y);
  y += 24;
  text("aplauso detectado: " + aplausoDetectado, 28, y);
  y += 24;
  text(
    "  pico:" + debugAplausoPico +
    " predom:" + debugAplausoPredominio +
    " cayo:" + debugAplausoBreve +
    " cd:" + debugAplausoCooldown +
    " ruido:" + debugAplausoRuido,
    28,
    y
  );
  y += 24;
  text("subida amp: " + nf(incrementoAmplitud, 1, 4), 28, y);
  y += 24;
  text("dibujos: " + dibujos.length + " / " + obtenerMaxTrazosActual(), 28, y);
  y += 24;
  text("familiaDefinida: " + familiaDefinida, 28, y);
  y += 24;
  text("modoCompositivo: " + modoCompositivo, 28, y);
  y += 24;
  text("anguloRector: " + int(anguloRector), 28, y);
  y += 24;
  text("nucleo: " + int(nucleoX) + ", " + int(nucleoY), 28, y);
  y += 24;
  text("desviacion: " + int(desviacionX) + ", " + int(desviacionY), 28, y);
  y += 24;
  text("fondo/transicion: " + fondoActual + " / " + nf(transicionFondo, 1, 2), 28, y);

  let barra = map(amplitudSuavizada, 0, 0.12, 0, 360, true);
  fill(120, 220, 255);
  rect(28, y + 16, barra, 10);
  pop();
}

function reiniciarObra() {
  dibujos = [];
  fondoActual = 0;
  fondoAnterior = 0;
  transicionFondo = 1;
  duracionSonido = 0;
  estadoSonoro = audioActivo ? "silencio" : "mic inactivo";
  inicializarComposicion();
}

function reiniciarObraPorAplauso() {
  dibujos = [];
  fondoActual = 0;
  fondoAnterior = 0;
  transicionFondo = 1;
  duracionSonido = 0;
  estadoSonoro = "silencio";
  inicializarComposicion();
  aplausoDetectado = true;

  if (mostrarLogsTrazos) {
    console.log("aplauso detectado: reinicio total de obra");
  }
}
