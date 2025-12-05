/**
 * PATRÓN: Singleton
 * SOLID: Single Responsibility Principle (SRP)
 * POR QUÉ: Asegura una única instancia de la conexión a la base de datos
 * para toda la aplicación, evitando conexiones múltiples innecesarias.
 */
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
export { admin, db };