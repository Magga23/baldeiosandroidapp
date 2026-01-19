import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerOrderRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // Get user's order history
  fastify.get('/api/orders', {
    schema: {
      description: "Get user's order history",
      tags: ['orders'],
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
    app.logger.info({ userId }, 'Fetching user orders');

    const orders = await app.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.userId, userId));

    app.logger.info({ userId, count: orders.length }, 'Orders fetched successfully');
    return orders;
  });

  // Get order details with items
  fastify.get('/api/orders/:id', {
    schema: {
      description: 'Get order details with items',
      tags: ['orders'],
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params as { id: string };

    app.logger.info({ userId, orderId: id }, 'Fetching order details');

    const order = await app.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);

    if (!order.length) {
      app.logger.warn({ userId, orderId: id }, 'Order not found');
      return reply.status(404).send({ message: 'Order not found' });
    }

    if (order[0].userId !== userId) {
      app.logger.warn({ userId, orderId: id, ownerId: order[0].userId }, 'Unauthorized order access');
      return reply.status(403).send({ message: 'Unauthorized' });
    }

    const items = await app.db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, id));

    app.logger.info({ userId, orderId: id, itemCount: items.length }, 'Order details fetched');
    return {
      ...order[0],
      items,
    };
  });

  // Create order from cart
  fastify.post('/api/orders', {
    schema: {
      description: 'Create order from cart items',
      tags: ['orders'],
      body: {
        type: 'object',
        properties: {
          shippingAddress: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              zipCode: { type: 'string' },
              country: { type: 'string' },
            },
            required: ['street', 'city', 'state', 'zipCode', 'country'],
          },
        },
        required: ['shippingAddress'],
      },
      response: {
        200: { type: 'object' },
        400: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { shippingAddress } = request.body as {
      shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      };
    };

    app.logger.info({ userId }, 'Creating order from cart');

    // Get all cart items for user
    const cartItems = await app.db
      .select({
        cartItemId: schema.cartItems.id,
        productId: schema.cartItems.productId,
        quantity: schema.cartItems.quantity,
        productName: schema.products.name,
        productPrice: schema.products.price,
        stock: schema.products.stock,
      })
      .from(schema.cartItems)
      .innerJoin(schema.products, eq(schema.cartItems.productId, schema.products.id))
      .where(eq(schema.cartItems.userId, userId));

    if (cartItems.length === 0) {
      app.logger.warn({ userId }, 'Cannot create order - cart is empty');
      return reply.status(400).send({ message: 'Cart is empty' });
    }

    // Validate stock and calculate total
    let totalAmount = 0;
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        app.logger.warn(
          { userId, productId: item.productId, requestedQty: item.quantity, availableStock: item.stock },
          'Insufficient stock for order'
        );
        return reply.status(400).send({ message: `Insufficient stock for ${item.productName}` });
      }
      totalAmount += parseFloat(item.productPrice) * item.quantity;
    }

    try {
      // Create order in transaction
      const [newOrder] = await app.db
        .insert(schema.orders)
        .values({
          userId,
          shippingAddress,
          totalAmount: totalAmount.toString(),
          itemCount: cartItems.length,
          status: 'pending',
        })
        .returning();

      // Create order items
      for (const item of cartItems) {
        await app.db
          .insert(schema.orderItems)
          .values({
            orderId: newOrder.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            priceAtPurchase: item.productPrice,
          });
      }

      // Clear cart
      await app.db
        .delete(schema.cartItems)
        .where(eq(schema.cartItems.userId, userId));

      app.logger.info(
        { userId, orderId: newOrder.id, itemCount: cartItems.length, totalAmount },
        'Order created successfully'
      );

      return newOrder;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to create order');
      throw error;
    }
  });

  // Update order status
  fastify.patch('/api/orders/:id', {
    schema: {
      description: 'Update order status',
      tags: ['orders'],
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
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'cancelled'] },
        },
        required: ['status'],
      },
      response: {
        200: { type: 'object' },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'pending' | 'processing' | 'completed' | 'cancelled' };

    app.logger.info({ userId, orderId: id, newStatus: status }, 'Updating order status');

    const order = await app.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);

    if (!order.length) {
      app.logger.warn({ userId, orderId: id }, 'Order not found');
      return reply.status(404).send({ message: 'Order not found' });
    }

    if (order[0].userId !== userId) {
      app.logger.warn({ userId, orderId: id, ownerId: order[0].userId }, 'Unauthorized order access');
      return reply.status(403).send({ message: 'Unauthorized' });
    }

    const [updated] = await app.db
      .update(schema.orders)
      .set({ status })
      .where(eq(schema.orders.id, id))
      .returning();

    app.logger.info({ userId, orderId: id, status: updated.status }, 'Order status updated');
    return updated;
  });
}
