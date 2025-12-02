import express from 'express'; // Usa import en lugar de require
const app = express();

const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('¡Hola! Mi servidor Node.js está corriendo en Firebase App Hosting.');
});

app.get('/api/dato', (req, res) => {
  res.json({ mensaje: 'Esto es un JSON', fecha: new Date() });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
