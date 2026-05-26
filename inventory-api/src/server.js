const app = require('./app');
const { port } = require('./config');

app.listen(port, () => {
  console.log(`Backend template corriendo en http://localhost:${port}`);
});
