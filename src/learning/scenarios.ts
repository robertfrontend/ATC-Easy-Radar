import { ModuleId } from './content';

export interface PracticeStep {
  phase: string;
  prompt: string;
  choices: string[];
  answer: string;
  feedback: string;
  hint?: string;
  select?: boolean;
  ident?: boolean;
  heading?: number;
  assigned?: number;
  seconds?: number;
  command?: string;
}

export const target = 'N731KB';
export const other = 'N713KB';
export const scenarios: Partial<Record<ModuleId, PracticeStep[]>> = {
  position: [
    {
      phase: 'Observar', prompt: 'Ambas llegadas están a 6.000 ft y sus trayectorias convergen. ¿Qué atiendes primero?',
      choices: ['Dar un atajo para llegar antes', 'Examinar el riesgo entre ambas llegadas'], answer: 'Examinar el riesgo entre ambas llegadas',
      feedback: 'Prioriza la seguridad y construye la imagen del tráfico antes de optimizar el orden de llegada.',
    },
    {
      phase: 'Anticipar', prompt: 'Si esperas mientras comunicas, ¿qué puede ocurrir con este tráfico convergente?',
      choices: ['La distancia puede seguir disminuyendo', 'El radar detiene a los aviones al seleccionarlos'], answer: 'La distancia puede seguir disminuyendo',
      feedback: 'La selección no pausa un vuelo real. Debes prever el tiempo de comunicación y de respuesta de la aeronave.',
    },
    {
      phase: 'Planificar', prompt: '¿Cuál es un plan razonado antes de transmitir?',
      choices: ['Ordenar sin comprobar identidad', 'Verificar identidad, evaluar opciones y prever cómo comprobar el resultado'],
      answer: 'Verificar identidad, evaluar opciones y prever cómo comprobar el resultado',
      feedback: 'Has observado, anticipado y planificado. Los siguientes módulos practican identidad, comunicación y comprobación; aquí no resolvemos separación operativa.',
    },
  ],
  identify: [
    {
      phase: 'Observar', prompt: 'La radio llama con el indicativo N731KB. Selecciona su etiqueta completa en el radar.',
      choices: [], answer: target, select: true,
      feedback: 'Seleccionaste N731KB, no N713KB. Todavía no has establecido su identificación radar.',
    },
    {
      phase: 'Leer', prompt: 'En la etiqueta seleccionada, altitud actual 060 y asignada 050 significan…',
      choices: ['Actual 6.000 ft, asignada 5.000 ft', 'Ya está a 5.000 ft'], answer: 'Actual 6.000 ft, asignada 5.000 ft',
      feedback: 'La altitud asignada es una instrucción; la actual muestra el estado observado. El cumplimiento no es instantáneo.',
    },
    {
      phase: 'Identificar', prompt: '¿Basta ver la etiqueta N731KB para declarar radar contact?',
      choices: ['Sí, la etiqueta basta siempre', 'No; necesito un método de identificación y correlación'], answer: 'No; necesito un método de identificación y correlación',
      feedback: 'La visualización y la identificación establecida son cosas diferentes; no extrapoles las etiquetas automáticas del juego.',
    },
    {
      phase: 'Comunicar', prompt: 'Para este ejercicio, solicita IDENT a N731KB y después observa la respuesta.',
      choices: ['N731KB, IDENT', 'Identificar por selección'], answer: 'N731KB, IDENT',
      feedback: 'Solicitud transmitida. Solicitar IDENT no demuestra todavía qué blanco ha respondido.',
    },
    {
      phase: 'Comprobar', prompt: 'Se observa una única respuesta IDENT, rotulada en el radar. Selecciona el blanco que responde.',
      choices: [], answer: target, select: true, ident: true,
      feedback: 'Correlacionaste la respuesta observada de N731KB con la solicitud. Este ejercicio supone radio establecida y respuesta única; no simula identificación dudosa.',
    },
    {
      phase: 'Concluir', prompt: 'Con la correlación establecida en este supuesto, ¿qué comunicas?',
      choices: ['N731KB, radar contact, over NORDO', 'N713KB, radar contact, over NORDO'], answer: 'N731KB, radar contact, over NORDO', ident: true,
      feedback: 'Indicativo correcto, asociación comprobada e información de posición: sobre NORDO, punto ficticio. Si hay duda real, debe resolverse; no sirve adivinar.',
    },
  ],
  readback: [
    {
      phase: 'Observar', prompt: 'Supuesto: N731KB ya identificado, jurisdicción y altitud segura comprobadas. Selecciónalo para un vector de entrenamiento.',
      choices: [], answer: target, select: true, command: 'Sin preparar',
      feedback: 'Aeronave correcta. El vector se practica sin obstáculos, viento ni reglas avanzadas; no constituye una autorización operacional.',
    },
    {
      phase: 'Planificar', prompt: 'Quieres un giro a la derecha desde 060 a 090. Prepara la instrucción para N731KB.',
      choices: ['Preparar: N731KB, turn right heading zero niner zero', 'Preparar: N713KB, turn left heading two seven zero'],
      answer: 'Preparar: N731KB, turn right heading zero niner zero', command: 'Sin preparar',
      feedback: 'Instrucción preparada para N731KB. Aún no ha sido transmitida: el rumbo asignado sigue siendo 060.',
    },
    {
      phase: 'Comunicar', prompt: 'Revisa indicativo, dirección y rumbo. La instrucción está preparada, no transmitida.',
      choices: ['Transmitir a N731KB: turn right heading zero niner zero', 'Suponer que ya la recibió'],
      answer: 'Transmitir a N731KB: turn right heading zero niner zero', command: 'Preparada: derecha 090',
      feedback: 'Transmitida. Debes escuchar y comprobar el acuse antes de dar por confirmada la recepción correcta.',
    },
    {
      phase: 'Comprobar', prompt: 'Piloto: “Right heading one niner zero, November seven three one kilo bravo.” ¿Coincide con 090?',
      choices: ['Aceptar 190', 'Detectar error: repitió 190 en lugar de 090'], answer: 'Detectar error: repitió 190 en lugar de 090',
      command: 'Transmitida: 090 · readback: 190 · sin confirmar', assigned: 90,
      hint: 'Compara zero niner zero (090) con one niner zero (190). Una respuesta recibida no garantiza que sea correcta.',
      feedback: 'Has detectado cien grados de diferencia. No confirmes un readback incorrecto ni asumas que el rumbo preparado fue entendido.',
    },
    {
      phase: 'Comunicar', prompt: 'Corrige la instrucción para el mismo indicativo y solicita el readback del rumbo.',
      choices: ['N731KB, correction, heading zero niner zero. Read back heading.', 'Cambiar el plan a 190 sin comprobar'],
      answer: 'N731KB, correction, heading zero niner zero. Read back heading.', command: 'Corrección pendiente', assigned: 90,
      feedback: 'Corrección transmitida. Ahora comprueba tanto el rumbo como el indicativo de la respuesta.',
    },
    {
      phase: 'Comprobar', prompt: 'Piloto: “Right heading zero niner zero, November seven three one kilo bravo.”',
      choices: ['Confirmar indicativo y rumbo correctos', 'Confirmar solo porque hubo una respuesta'], answer: 'Confirmar indicativo y rumbo correctos',
      command: 'Corrección transmitida · esperando comprobación', assigned: 90,
      feedback: 'Recepción correcta comprobada. La aeronave todavía debe maniobrar: confirmado no significa ejecutado.',
    },
    {
      phase: 'Anticipar', prompt: 'Avanza 15 segundos simulados para observar la respuesta, sin emitir otra orden.',
      choices: ['Observar después de 15 segundos'], answer: 'Observar después de 15 segundos', assigned: 90, command: 'Confirmada: derecha 090',
      feedback: 'El rumbo actual alcanza 075, con 090 asignado. La maniobra sigue en curso; evita confundir demora con incumplimiento.',
    },
    {
      phase: 'Comprobar', prompt: 'Actual 075, asignado 090. ¿Qué haces con la maniobra en curso?',
      choices: ['Emitir otra orden solo por la demora', 'Seguir observando otros 15 segundos'], answer: 'Seguir observando otros 15 segundos',
      assigned: 90, heading: 75, seconds: 15, command: 'Confirmada: giro en curso',
      feedback: 'Tras 30 segundos simulados, rumbo actual 090. Has completado el ciclo y verificado la ejecución en este modelo simplificado.',
    },
  ],
};

export interface Attempt { step: number; accepted: boolean; mistakes: number; feedback: string }
export const newAttempt = (): Attempt => ({ step: 0, accepted: false, mistakes: 0, feedback: '' });

export function answerStep(attempt: Attempt, steps: PracticeStep[], answer: string): Attempt {
  const step = steps[attempt.step];
  if (!step || attempt.accepted) return attempt;
  const correct = answer === step.answer;
  return { ...attempt, accepted: correct, mistakes: attempt.mistakes + Number(!correct),
    feedback: correct ? step.feedback : step.select
      ? `Ese es ${other}. Comprueba el indicativo completo: se solicita ${target}. Seleccionar no identifica.`
      : step.hint ?? 'Paso sin validar. Revisa el indicativo completo, los datos actuales y la instrucción. Observa y anticipa antes de dar por comprobado el resultado.' };
}

export function continueAttempt(attempt: Attempt, steps: PracticeStep[]): Attempt {
  return attempt.accepted && attempt.step < steps.length
    ? { ...attempt, step: attempt.step + 1, accepted: false, feedback: '' } : attempt;
}
