export const sections = ['Get Started', 'Fundamentos', 'Control radar', 'Operaciones', 'Comunicaciones', 'Práctica', 'Referencia'] as const;
export type Section = typeof sections[number];
export type ModuleId = 'position' | 'identify' | 'readback' | 'separate' | 'vectors' | 'sequence' | 'approach' | 'coordinate';
export interface Lesson {
  id: ModuleId;
  title: string;
  section: Section;
  explanation: string;
  example: string;
  takeaway: string;
  source: string;
  paragraphs: string;
  practice: boolean;
}

const atc = 'https://www.faa.gov/air_traffic/publications/atpubs/atc_html/';
export const lessons: Lesson[] = [
  {
    id: 'position', title: 'Comprender el puesto radar y sus prioridades', section: 'Get Started', practice: true,
    explanation: 'Controlas un sector, no una torre. El radar te ayuda a construir una imagen del tráfico: quién está dónde, qué hace ahora y qué puede pasar después. La seguridad exige separar aeronaves y emitir alertas de seguridad; una secuencia eficiente no justifica ignorar un riesgo. Las emergencias cambian las prioridades.',
    example: 'Dos llegadas convergen y una tercera pide un atajo. Primero observa el riesgo y anticipa la evolución; el atajo puede esperar. No des órdenes por el mero hecho de tener un avión seleccionado.',
    takeaway: 'Observar → anticipar → planificar → comunicar → comprobar. Antes de actuar, explica qué problema intentas resolver.',
    source: `${atc}chap2_section_1.html`, paragraphs: '2-1-1, 2-1-2, 2-1-6',
  },
  {
    id: 'identify', title: 'Interpretar e identificar tráfico', section: 'Control radar', practice: true,
    explanation: 'Un símbolo es una detección; una etiqueta visible no establece por sí sola la identificación radar. Debes correlacionar la aeronave y el blanco usando un método autorizado y mantener esa asociación. En la práctica observarás una respuesta IDENT previamente solicitada. Un clic sobre la etiqueta solo selecciona: no identifica.',
    example: 'N731KB y N713KB se parecen. Comprueba el indicativo completo y observa qué blanco responde a IDENT. Si dos blancos responden o la asociación resulta dudosa, no adivines: hace falta resolver la duda y restablecer la identificación.',
    takeaway: 'Lee posición, tendencia y datos; verifica identidad antes de ordenar. “Radar contact” comunica identificación establecida. Tras identificar mediante IDENT, informa de la posición según 5-3-6; aquí el blanco está sobre el punto ficticio NORDO.',
    source: `${atc}chap5_section_3.html`, paragraphs: '5-3-1, 5-3-3, 5-3-4, 5-3-5, 5-3-6, 5-3-7, 5-3-9',
  },
  {
    id: 'readback', title: 'Comunicar y comprobar readback', section: 'Comunicaciones', practice: true,
    explanation: 'Prepara una instrucción dirigida a un indicativo concreto, transmítela y comprueba la respuesta. Preparada no significa transmitida, y transmitida no significa confirmada. Cuando el piloto repite una instrucción, verifica que los elementos repetidos sean correctos y que incluya su identificación. Sin acuse no sabes si cumplirá.',
    example: 'Para el blanco ya identificado N731KB: “November seven three one kilo bravo, turn right heading zero niner zero.” Si responde heading one niner zero, corrige el rumbo y solicita comprobación; no confirmes 190 cuando preparaste 090.',
    takeaway: 'En este ejercicio se exige repetir indicativo y rumbo para practicar. No significa que toda instrucción FAA requiera repetir cada palabra. Roger indica recepción, no una comprobación de números.',
    source: `${atc}chap2_section_4.html`, paragraphs: '2-4-2, 2-4-3, 2-4-8',
  },
  {
    id: 'separate', title: 'Separar y anticipar conflictos', section: 'Control radar', practice: false,
    explanation: 'Compara trayectorias y altitudes futuras, no solo la distancia actual. Una separación que ahora parece cómoda puede reducirse por convergencia o velocidad relativa. El objetivo conceptual es reconocer el problema con tiempo para planificar y comprobar el resultado.',
    example: 'Dos tráficos al mismo nivel se acercan a un cruce. Pregunta dónde estarán después de la demora de comunicación y de maniobra. Cambiar una altitud asignada no cambia instantáneamente la altitud actual.',
    takeaway: 'Los mínimos dependen del contexto, equipo y procedimiento. Los halos y umbrales del juego son simplificaciones; no son mínimos FAA universales. Práctica operativa pendiente de desarrollo y validación.',
    source: `${atc}chap5_section_5.html`, paragraphs: '5-5-1, 5-5-4, 5-5-5; también 4-5-1',
  },
  {
    id: 'vectors', title: 'Organizar trayectorias con vectores', section: 'Control radar', practice: false,
    explanation: 'Un vector asigna un rumbo magnético. Incluye dirección de giro cuando corresponda y un propósito claro. El viento puede hacer que la trayectoria sobre el suelo difiera del rumbo. Dar vectores requiere considerar jurisdicción, cobertura y altitudes mínimas aplicables.',
    example: 'Un vector para espaciar modifica la trayectoria antes de que la llegada alcance la final. “Turn right heading zero niner zero” indica rumbo, no autorización para seguir cualquier ruta ni descender.',
    takeaway: 'Aquí solo introducimos la idea; no hay carta de altitudes mínimas ni reglas operativas de vectorización implementadas. Práctica avanzada pendiente.',
    source: `${atc}chap5_section_6.html`, paragraphs: '5-6-1, 5-6-2; también 4-5-7',
  },
  {
    id: 'sequence', title: 'Secuenciar llegadas', section: 'Operaciones', practice: false,
    explanation: 'Secuenciar significa construir un orden de llegada sostenible. Observa velocidades relativas, distancias por recorrer y espacio para maniobrar antes de decidir quién precede a quién. La velocidad asignada no produce un cambio instantáneo.',
    example: 'Una llegada más rápida detrás de otra puede comprimir el espacio aunque las etiquetas parezcan ordenadas. Anticipa la compresión antes de pedir un ajuste y comprueba la respuesta.',
    takeaway: 'No enseñamos mínimos de estela ni tablas de velocidad. La práctica de compresión de llegadas, variantes y debrief/replay está pendiente. Salidas queda para una entrega futura.',
    source: `${atc}chap5_section_7.html`, paragraphs: '5-7-1, 5-7-2',
  },
  {
    id: 'approach', title: 'Preparar y autorizar aproximación', section: 'Operaciones', practice: false,
    explanation: 'Preparar una intercepción, autorizar una aproximación y autorizar un aterrizaje son acciones diferentes. La captura de localizador o senda es un estado de navegación; no es por sí misma una autorización de aproximación ni de aterrizaje.',
    example: 'Una aeronave alineada con el ILS todavía necesita la autorización de aproximación que corresponda. En el juego libre la automatización captura y aterriza: ese atajo lúdico no representa el procedimiento real.',
    takeaway: 'No uses el mapa ficticio como carta publicada. No hay procedimientos instrumentales validados en Learning. Práctica de aproximación pendiente.',
    source: `${atc}chap4_section_8.html`, paragraphs: '4-8-1; también 5-9-1 a 5-9-5',
  },
  {
    id: 'coordinate', title: 'Coordinar la operación integrada', section: 'Operaciones', practice: false,
    explanation: 'Handoff transfiere identificación radar en el contexto definido por FAA. Cambiar la frecuencia de radio transfiere comunicaciones. La transferencia de control depende de condiciones y coordinación aplicables. No trates esas tres acciones como un único clic equivalente.',
    example: 'Pedir al piloto que contacte otra frecuencia no demuestra que el siguiente sector haya aceptado el handoff ni que puedas cambiar su trayectoria fuera de tu jurisdicción.',
    takeaway: 'Comprueba aceptación, restricciones y responsabilidades. El escenario de transferencia con coordinación pendiente y la operación integrada aún no están implementados.',
    source: `${atc}chap5_section_4.html`, paragraphs: '5-4-2 a 5-4-6; también 2-1-14, 2-1-15, 2-1-17',
  },
];

export const glossary = [
  ['Radar / sector', 'Vigilancia y área de responsabilidad; Learning se centra en radar terminal, no torre.'],
  ['Call sign / indicativo', 'Identifica a quién diriges el mensaje. Lee todos los caracteres; una selección no establece identificación radar.'],
  ['Heading / rumbo', 'Dirección hacia la que apunta el eje longitudinal del avión. Aquí se representa en grados magnéticos.'],
  ['Track / trayectoria', 'Dirección de desplazamiento sobre el suelo; puede diferir del heading por el viento.'],
  ['Current / assigned altitude', 'Altitud actual frente a altitud asignada. En este radar 060 equivale a 6.000 ft; no significa FL060.'],
  ['IAS / groundspeed', 'IAS es velocidad indicada respecto al aire; groundspeed es velocidad sobre el suelo. No son intercambiables.'],
  ['ft / NM / kt', 'Pies, millas náuticas y nudos. Un nudo es una milla náutica por hora.'],
  ['Readback / acuse', 'Repetición del mensaje recibido frente a confirmación de recepción. Comprueba números e indicativo.'],
  ['IFR / ILS', 'Reglas de vuelo instrumental / sistema de aterrizaje instrumental. Captura no equivale a autorización.'],
  ['IDENT', 'Función de identificación del transpondedor/ADS-B. Debes observar y correlacionar la respuesta, no solo solicitarla.'],
] as const;

export const glossarySource = 'https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/index.html';
export const sourceDate = '20 de octubre de 2026';
