import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerProductRoutes(app: App, fastify: FastifyInstance) {
  // Get all products or filter by category
  fastify.get('/api/products', {
    schema: {
      description: 'Get all active products, optionally filtered by category',
      tags: ['products'],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  }, async (request) => {
    const { category } = request.query as { category?: string };
    app.logger.info({ category }, 'Fetching products');

    const conditions = [eq(schema.products.active, true)];
    if (category) {
      conditions.push(eq(schema.products.category, category));
    }

    const products = await app.db
      .select()
      .from(schema.products)
      .where(and(...conditions));

    app.logger.info({ count: products.length }, 'Products fetched successfully');
    return products;
  });

  // Get single product details
  fastify.get('/api/products/:id', {
    schema: {
      description: 'Get product details by ID',
      tags: ['products'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: { type: 'object' },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    app.logger.info({ productId: id }, 'Fetching product details');

    const product = await app.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    if (!product.length) {
      app.logger.warn({ productId: id }, 'Product not found');
      return reply.status(404).send({ message: 'Product not found' });
    }

    app.logger.info({ productId: id }, 'Product details fetched successfully');
    return product[0];
  });

  // Get product by QR code
  fastify.get('/api/products/by-qr/:qrCode', {
    schema: {
      description: 'Get product by QR code',
      tags: ['products'],
      params: {
        type: 'object',
        properties: {
          qrCode: { type: 'string' },
        },
        required: ['qrCode'],
      },
      response: {
        200: { type: 'object' },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { qrCode } = request.params as { qrCode: string };
    app.logger.info({ qrCode }, 'Fetching product by QR code');

    const product = await app.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.qrCode, qrCode))
      .limit(1);

    if (!product.length) {
      app.logger.warn({ qrCode }, 'Product with QR code not found');
      return reply.status(404).send({ message: 'Product not found' });
    }

    app.logger.info({ qrCode, productId: product[0].id }, 'Product fetched by QR code successfully');
    return product[0];
  });

  // Get all unique categories
  fastify.get('/api/products/categories', {
    schema: {
      description: 'Get all unique product categories',
      tags: ['products'],
      response: {
        200: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  }, async () => {
    app.logger.info('Fetching product categories');

    const categories = await app.db
      .selectDistinct({ category: schema.products.category })
      .from(schema.products)
      .where(eq(schema.products.active, true));

    const categoryNames = categories.map(c => c.category);
    app.logger.info({ count: categoryNames.length }, 'Categories fetched successfully');
    return categoryNames;
  });
}
