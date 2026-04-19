import { buildApp } from './app';
import { env } from './config/env';

const app = buildApp();

app.listen(env.PORT, () => {
  console.log(`🌱 Community Garden API`);
  console.log(`   http://localhost:${env.PORT}/food`);
  console.log(`   http://localhost:${env.PORT}/api/v1/listings`);
});
