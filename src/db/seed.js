'use strict';

require('dotenv').config();
const { init, getDb } = require('./index');
const { hashPin } = require('../lib/auth');

/** Siembra datos de demostración: 8 proyectos, 3 jurados, 2 fichas visitantes. */
function seed() {
  init();
  const db = getDb();

  const projectCount = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
  if (projectCount > 0) {
    console.log('La base de datos ya tiene proyectos. No se vuelve a sembrar.');
    console.log('Para reiniciar: borra el archivo data/showroom.db y vuelve a correr `npm run seed:demo`.');
    return;
  }

  const projects = [
    { stand: 1, name: 'RutaSegura', ficha: '2612345', program: 'ADSO', team: 'María Gómez\nCarlos Ruiz\nSofía Ortiz', summary: 'Plataforma de reporte ciudadano de vías en mal estado, con mapa colaborativo.' },
    { stand: 2, name: 'AgroConecta', ficha: '2612345', program: 'ADSO', team: 'Daniel Martínez\nValentina León', summary: 'App para conectar pequeños productores agrícolas con compradores locales.' },
    { stand: 3, name: 'SaludCerca', ficha: '2612346', program: 'ADSO', team: 'Laura Castillo\nAndrés Vargas\nJulián Rojas', summary: 'Sistema de turnos y recordatorios para centros de salud rurales.' },
    { stand: 4, name: 'EcoRuta Escolar', ficha: '2612346', program: 'ADSO', team: 'Natalia Suárez\nFelipe Herrera', summary: 'Optimización de rutas de transporte escolar con menor huella de carbono.' },
    { stand: 5, name: 'InventarioYa', ficha: '2612347', program: 'ADSO', team: 'Sebastián Peña\nCamila Duarte\nMateo Salazar', summary: 'Control de inventario para tenderos con lectura de código de barras.' },
    { stand: 6, name: 'ManosQueEnseñan', ficha: '2612347', program: 'ADSO', team: 'Isabella Cárdenas\nSantiago Molina', summary: 'Plataforma de tutorías entre pares para aprendices SENA.' },
    { stand: 7, name: 'ReciclApp', ficha: '2612348', program: 'ADSO', team: 'Valeria Jiménez\nTomás Restrepo\nEmma Padilla', summary: 'Gamificación del reciclaje en instituciones educativas.' },
    { stand: 8, name: 'TurnoJusto', ficha: '2612348', program: 'ADSO', team: 'Juan Pablo Gil\nMariana Cortés', summary: 'Fila virtual y priorización justa de atención en trámites públicos.' },
  ];

  const insertProject = db.prepare(
    `INSERT INTO projects (stand_number, name, ficha_code, program_name, team_members, summary, is_active)
     VALUES (@stand_number, @name, @ficha_code, @program_name, @team_members, @summary, 1)`
  );
  for (const p of projects) {
    insertProject.run({
      stand_number: p.stand,
      name: p.name,
      ficha_code: p.ficha,
      program_name: p.program,
      team_members: p.team,
      summary: p.summary,
    });
  }

  const judges = ['Jurado Uno', 'Jurado Dos', 'Jurado Tres'];
  const insertJudge = db.prepare('INSERT INTO judges (name, pin_hash) VALUES (?, ?)');
  const judgePins = [];
  for (const name of judges) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    insertJudge.run(name, hashPin(pin));
    judgePins.push({ name, pin });
  }

  const insertFicha = db.prepare('INSERT INTO visiting_fichas (ficha_code, label) VALUES (?, ?)');
  insertFicha.run('2612345', '2612345 · ficha visitante de demo');
  insertFicha.run('2612349', '2612349 · ficha visitante de demo (sin cruce con expositores)');

  console.log('Datos de demostración creados:');
  console.log(`  ${projects.length} proyectos, stands 1–${projects.length}`);
  console.log('  PINs de jurados (guárdalos, no se vuelven a mostrar):');
  for (const j of judgePins) console.log(`    ${j.name}: ${j.pin}`);
  console.log('  Fichas visitantes: 2612345, 2612349');
  console.log('\nConfigura PULSE_MOCK=true en .env para probar sin Pulse levantado.');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
