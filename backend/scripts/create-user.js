#!/usr/bin/env node
/**
 * MGH Payroll — Script de Creación de Usuarios
 * 
 * Permite registrar usuarios en la base de datos (con contraseña cifrada scrypt y salt).
 * Puede usarse de forma interactiva o pasando argumentos.
 * 
 * Uso interactivo:
 *   node scripts/create-user.js
 * 
 * Uso con argumentos:
 *   node scripts/create-user.js --email=admin@empresa.com --password=MiPasswordSeguro123! --name="Admin Principal" --role=admin
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const db = require('../src/db');
const { generateSalt, hashPassword } = require('../src/utils/crypto');

const VALID_ROLES = ['admin', 'pm', 'supervisor', 'hr', 'finance', 'employee', 'contractor'];

// Parse CLI flags
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      args[key.trim()] = vals.join('=').trim();
    }
  });
  return args;
}

function prompt(rl, question, defaultValue = '') {
  return new Promise(resolve => {
    const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(q, answer => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function run() {
  console.log('\n=============================================================');
  console.log('   MGH Payroll — Registro de Usuario');
  console.log('=============================================================\n');

  const cliArgs = parseArgs();
  let email = cliArgs.email;
  let password = cliArgs.password;
  let name = cliArgs.name;
  let role = cliArgs.role;
  let entity = cliArgs.entity || 'My Global Hub Dominicana SRL';

  if (!email || !password || !name || !role) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      if (!name) name = await prompt(rl, 'Nombre completo', 'Administrador');
      if (!email) email = await prompt(rl, 'Correo electrónico', 'admin@myglobalhub.com');
      if (!password) password = await prompt(rl, 'Contraseña');
      
      console.log(`\nRoles válidos: ${VALID_ROLES.join(', ')}`);
      if (!role) role = await prompt(rl, 'Rol del usuario', 'admin');
      
      entity = await prompt(rl, 'Entidad / Organización', 'My Global Hub Dominicana SRL');
    } finally {
      rl.close();
    }
  }

  // Validaciones
  if (!email || !email.includes('@')) {
    console.error('\n❌ Error: El correo electrónico proporcionado no es válido.');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('\n❌ Error: La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  const normalizedRole = (role || 'employee').toLowerCase().trim();
  if (!VALID_ROLES.includes(normalizedRole)) {
    console.error(`\n❌ Error: El rol '${normalizedRole}' no es válido. Opciones: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  // Verificar si ya existe
  const existing = db.getOne('SELECT id FROM users WHERE LOWER(email) = ?', [email.toLowerCase().trim()]);
  if (existing) {
    console.error(`\n❌ Error: Ya existe un usuario registrado con el correo '${email}'.`);
    process.exit(1);
  }

  // Cifrado y guardado
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  db.transaction(() => {
    db.execute(
      `INSERT INTO users (id, email, password_hash, salt, name, role, entity, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, email.toLowerCase().trim(), passwordHash, salt, name.trim(), normalizedRole, entity.trim()]
    );
  });

  console.log('\n✅ Usuario creado exitosamente:');
  console.log(`   • ID:       ${userId}`);
  console.log(`   • Nombre:   ${name.trim()}`);
  console.log(`   • Email:    ${email.toLowerCase().trim()}`);
  console.log(`   • Rol:      ${normalizedRole}`);
  console.log(`   • Entidad:  ${entity.trim()}`);
  console.log('\nYa puedes iniciar sesión en la aplicación con estas credenciales.\n');
}

run().catch(err => {
  console.error('\n❌ Error inesperado creando usuario:', err.message);
  process.exit(1);
});
