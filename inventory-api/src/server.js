const app = require('./app');
const { port } = require('./config');

app.listen(port, () => {
  console.log(`Inventory API corriendo en http://localhost:${port}`);
});
