import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerCartRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // Get user's cart
  fastify.get('/api/cart', {
    schema: {
      description: "Get current user's shopping cart",
      tags: ['cart'],
      response: {
        200: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user cart');

    const cartItems = await app.db
      .select({
        id: schema.cartItems.id,
        quantity: schema.cartItems.quantity,
        productId: schema.cartItems.productId,
        productName: schema.products.name,
        productDescription: schema.products.description,
        productPrice: schema.products.price,
        productImage: schema.products.image,
        productStock: schema.products.stock,
      })
      .from(schema.cartItems)
      .innerJoin(schema.products, eq(schema.cartItems.productId, schema.products.id))
      .where(eq(schema.cartItems.userId, userId));

    app.logger.info({ userId, count: cartItems.length }, 'Cart fetched successfully');
    return cartItems;
  });

  // Add item to cart
  fastify.post('/api/cart', {
    schema: {
      description: 'Add product to cart',
      tags: ['cart'],
      body: {
        type: 'object',
        properties: {
          productId: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1 },
        },
        required: ['productId', 'quantity'],
      },
      response: {
        200: { type: 'object' },
        400: { type: 'object', properties: { message: { type: 'string' } } },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { productId, quantity } = request.body as { productId: string; quantity: number };

    app.logger.info({ userId, productId, quantity }, 'Adding item to cart');

    if (quantity < 1) {
      app.logger.warn({ userId, productId, quantity }, 'Invalid quantity');
      return reply.status(400).send({ message: 'Quantity must be at least 1' });
    }

    // Check product exists and has stock
    const product = await app.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!product.length) {
      app.logger.warn({ userId, productId }, 'Product not found');
      return reply.status(404).send({ message: 'Product not found' });
    }

    if (product[0].stock < quantity) {
      app.logger.warn({ userId, productId, requestedQty: quantity, availableStock: product[0].stock }, 'Insufficient stock');
      return reply.status(400).send({ message: 'Insufficient stock available' });
    }

    // Check if product already in cart
    const existingItem = await app.db
      .select()
      .from(schema.cartItems)
      .where(
        and(
          eq(schema.cartItems.userId, userId),
          eq(schema.cartItems.productId, productId)
        )
      )
      .limit(1);

    let cartItem;
    if (existingItem.length) {
      // Update quantity
      const newQuantity = existingItem[0].quantity + quantity;
      if (product[0].stock < newQuantity) {
        app.logger.warn({ userId, productId, newQty: newQuantity, availableStock: product[0].stock }, 'Insufficient stock for update');
        return reply.status(400).send({ message: 'Insufficient stock available' });
      }

      [cartItem] = await app.db
        .update(schema.cartItems)
        .set({ quantity: newQuantity })
        .where(eq(schema.cartItems.id, existingItem[0].id))
        .returning();
    } else {
      // Create new cart item
      [cartItem] = await app.db
        .insert(schema.cartItems)
        .values({ userId, productId, quantity })
        .returning();
    }

    app.logger.info({ userId, cartItemId: cartItem.id, productId, quantity: cartItem.quantity }, 'Item added to cart');
    return cartItem;
  });

  // Update cart item quantity
  fastify.put('/api/cart/:id', {
    schema: {
      description: 'Update cart item quantity',
      tags: ['cart'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          quantity: { type: 'integer', minimum: 1 },
        },
        required: ['quantity'],
      },
      response: {
        200: { type: 'object' },
        400: { type: 'object', properties: { message: { type: 'string' } } },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params as { id: string };
    const { quantity } = request.body as { quantity: number };

    app.logger.info({ userId, cartItemId: id, newQuantity: quantity }, 'Updating cart item');

    if (quantity < 1) {
      app.logger.warn({ userId, cartItemId: id, quantity }, 'Invalid quantity');
      return reply.status(400).send({ message: 'Quantity must be at least 1' });
    }

    // Get cart item and verify ownership
    const cartItem = await app.db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.id, id))
      .limit(1);

    if (!cartItem.length) {
      app.logger.warn({ userId, cartItemId: id }, 'Cart item not found');
      return reply.status(404).send({ message: 'Cart item not found' });
    }

    if (cartItem[0].userId !== userId) {
      app.logger.warn({ userId, cartItemId: id, ownerId: cartItem[0].userId }, 'Unauthorized cart access');
      return reply.status(403).send({ message: 'Unauthorized' });
    }

    // Check stock
    const product = await app.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, cartItem[0].productId))
      .limit(1);

    if (!product.length) {
      app.logger.warn({ userId, cartItemId: id, productId: cartItem[0].productId }, 'Product not found');
      return reply.status(404).send({ message: 'Product not found' });
    }

    if (product[0].stock < quantity) {
      app.logger.warn({ userId, cartItemId: id, requestedQty: quantity, availableStock: product[0].stock }, 'Insufficient stock');
      return reply.status(400).send({ message: 'Insufficient stock available' });
    }

    const [updated] = await app.db
      .update(schema.cartItems)
      .set({ quantity })
      .where(eq(schema.cartItems.id, id))
      .returning();

    app.logger.info({ userId, cartItemId: id, quantity: updated.quantity }, 'Cart item updated');
    return updated;
  });

  // Remove item from cart
  fastify.delete('/api/cart/:id', {
    schema: {
      description: 'Remove item from cart',
      tags: ['cart'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params as { id: string };

    app.logger.info({ userId, cartItemId: id }, 'Removing item from cart');

    const cartItem = await app.db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.id, id))
      .limit(1);

    if (!cartItem.length) {
      app.logger.warn({ userId, cartItemId: id }, 'Cart item not found');
      return reply.status(404).send({ message: 'Cart item not found' });
    }

    if (cartItem[0].userId !== userId) {
      app.logger.warn({ userId, cartItemId: id, ownerId: cartItem[0].userId }, 'Unauthorized cart access');
      return reply.status(403).send({ message: 'Unauthorized' });
    }

    await app.db.delete(schema.cartItems).where(eq(schema.cartItems.id, id));

    app.logger.info({ userId, cartItemId: id }, 'Item removed from cart');
    return { message: 'Item removed from cart' };
  });

  // Clear entire cart
  fastify.delete('/api/cart', {
    schema: {
      description: "Clear user's entire shopping cart",
      tags: ['cart'],
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Clearing cart');

    await app.db
      .delete(schema.cartItems)
      .where(eq(schema.cartItems.userId, userId));

    app.logger.info({ userId }, 'Cart cleared');
    return { message: 'Cart cleared successfully' };
  });
}
