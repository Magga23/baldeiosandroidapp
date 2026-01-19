import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerProductRoutes } from './routes/products.js';
import { registerCartRoutes } from './routes/cart.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerPhotoRoutes } from './routes/photos.js';
import { registerGithubRoutes } from './routes/github.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication
app.withAuth();

// Enable storage for file uploads
app.withStorage();

// Register routes
registerProductRoutes(app, app.fastify);
registerCartRoutes(app, app.fastify);
registerOrderRoutes(app, app.fastify);
registerPhotoRoutes(app, app.fastify);
registerGithubRoutes(app, app.fastify);

await app.run();
app.logger.info('Application running');
