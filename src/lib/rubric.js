'use strict';

/**
 * Rúbrica oficial de jurados — hoja "Rubrica SENA" de Rubrica para ADSO.xlsx,
 * con un criterio añadido dentro de ACTITUDINAL para la decoración del stand
 * (marcado `added: true`). 19 criterios en 6 bloques, escala 1–5.
 */
const JURY_RUBRIC = [
  {
    key: 'actitudinal',
    label: 'Actitudinal',
    criteria: [
      { key: 'act_interes', label: 'Interés para lograr que el tema sea entendible' },
      { key: 'act_postura', label: 'Postura, interés y contacto visual con el auditorio' },
      {
        key: 'act_expresion',
        label:
          'Manejo del espacio, la pronunciación, la expresión corporal, el tono de voz y la vocalización',
      },
      {
        key: 'act_decoracion',
        label: 'Presentación y decoración del stand',
        added: true,
      },
    ],
  },
  {
    key: 'dominio_tema',
    label: 'Dominio del tema',
    criteria: [
      {
        key: 'dom_dominio',
        label: 'Dominio del tema (no se limita a leer la presentación)',
      },
      { key: 'dom_ejemplos', label: 'Utiliza ejemplos, gráficos y tablas para explicar los temas' },
      { key: 'dom_preguntas', label: 'Contesta con facilidad las preguntas sobre el contenido' },
      {
        key: 'dom_organizacion',
        label: 'Presenta la información de manera organizada y en secuencia lógica y coherente',
      },
    ],
  },
  {
    key: 'tecnico',
    label: 'Técnico',
    criteria: [
      { key: 'tec_competencias', label: 'Las competencias se ven reflejadas en el trabajo presentado' },
      { key: 'tec_objetivos', label: 'La propuesta cumple con los objetivos del proyecto' },
      {
        key: 'tec_habilidades',
        label: 'Se evidencia el desarrollo de habilidades, destrezas y conocimientos técnicos',
      },
      {
        key: 'tec_conclusiones',
        label: 'Las conclusiones y recomendaciones están acordes con la problemática presentada',
      },
    ],
  },
  {
    key: 'innovacion',
    label: 'Innovación',
    criteria: [
      {
        key: 'inn_nivel',
        label:
          'Nivel de innovación de la propuesta (mejora de procesos, nuevos materiales, mejora o creación de productos)',
      },
      { key: 'inn_satisfaccion', label: 'Nivel de satisfacción que puede tener la empresa con el proyecto' },
    ],
  },
  {
    key: 'tiempo',
    label: 'Manejo del tiempo',
    criteria: [
      { key: 'tie_uso', label: 'El uso del tiempo asignado para la presentación fue adecuado' },
    ],
  },
  {
    key: 'trabajo_escrito',
    label: 'Calidad del trabajo escrito',
    criteria: [
      { key: 'esc_normas', label: 'Aplicación de las normas APA, ortográficas y de redacción' },
      { key: 'esc_objetivos', label: 'La construcción de los objetivos es correcta' },
      { key: 'esc_procesos', label: 'La redacción de los procesos corresponde a la realidad de los mismos' },
      { key: 'esc_bibliografia', label: 'Presentación de la bibliografía' },
    ],
  },
];

const JURY_CRITERIA_FLAT = JURY_RUBRIC.flatMap((block) => block.criteria);
const JURY_CRITERIA_KEYS = JURY_CRITERIA_FLAT.map((c) => c.key);
const JURY_CRITERIA_COUNT = JURY_CRITERIA_KEYS.length; // 19

/**
 * Rúbrica corta del aprendiz visitante: 4 criterios, estrellas 1–5.
 */
const APPRENTICE_RUBRIC = [
  { key: 'score_stand', label: 'Decoración y montaje del stand' },
  { key: 'score_clarity', label: 'Claridad de la explicación' },
  { key: 'score_innovation', label: 'Innovación y utilidad del proyecto' },
  { key: 'score_mastery', label: 'Dominio del equipo sobre su proyecto' },
];

/** Niveles de calificación final, según la hoja original de la rúbrica SENA. */
function juryLevel(average) {
  if (average == null) return null;
  if (average < 3) return 'Bajo';
  if (average < 4) return 'Medio';
  if (average < 5) return 'Alto';
  return 'Superior';
}

module.exports = {
  JURY_RUBRIC,
  JURY_CRITERIA_FLAT,
  JURY_CRITERIA_KEYS,
  JURY_CRITERIA_COUNT,
  APPRENTICE_RUBRIC,
  juryLevel,
};
