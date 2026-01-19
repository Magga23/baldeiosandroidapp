import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerPhotoRoutes(app: App, fastify: FastifyInstance) {
  // Upload photo
  fastify.post('/api/photos/upload', {
    schema: {
      description: 'Upload project documentation photo',
      tags: ['photos'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            photoUrl: { type: 'string' },
            projectId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Uploading project photo');

    try {
      // Process multipart form data
      const parts = request.parts({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

      let projectId: string | undefined;
      let projectAddress: string | undefined;
      let employeeId: string | undefined;
      let employeeName: string | undefined;
      let notes: string | undefined;
      let fileBuffer: Buffer | undefined;
      let filename: string | undefined;

      // Iterate through form fields and file
      for await (const part of parts) {
        if (part.type === 'field') {
          // Handle text fields
          const value = part.value as string;

          if (part.fieldname === 'projectId') projectId = value;
          else if (part.fieldname === 'projectAddress') projectAddress = value;
          else if (part.fieldname === 'employeeId') employeeId = value;
          else if (part.fieldname === 'employeeName') employeeName = value;
          else if (part.fieldname === 'notes') notes = value;
        } else if (part.type === 'file') {
          // Handle file upload
          filename = part.filename;
          try {
            fileBuffer = await part.toBuffer();
          } catch (err) {
            app.logger.warn('File too large or read error');
            return reply.status(413).send({ message: 'File too large (max 10MB)' });
          }
        }
      }

      if (!projectId) {
        app.logger.warn('projectId is required');
        return reply.status(400).send({ message: 'projectId is required' });
      }

      if (!fileBuffer || !filename) {
        app.logger.warn('No file provided in upload request');
        return reply.status(400).send({ message: 'No file provided' });
      }

      const buffer = fileBuffer;

      // Upload to storage
      const key = `project-photos/${projectId}/${Date.now()}-${filename}`;
      const uploadedKey = await app.storage.upload(key, buffer);

      // Get signed URL for the uploaded file
      const { url: photoUrl } = await app.storage.getSignedUrl(uploadedKey);

      // Save photo metadata to database
      const [photo] = await app.db
        .insert(schema.projectPhotos)
        .values({
          projectId,
          projectAddress: projectAddress || null,
          employeeId: employeeId || null,
          employeeName: employeeName || null,
          photoUrl: uploadedKey, // Store the key for later retrieval
          notes: notes || null,
        })
        .returning();

      app.logger.info(
        { photoId: photo.id, projectId, uploadedKey },
        'Photo uploaded successfully'
      );

      return {
        id: photo.id,
        photoUrl,
        projectId: photo.projectId,
        createdAt: photo.createdAt,
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to upload photo');
      throw error;
    }
  });

  // Get photos by project ID
  fastify.get('/api/photos', {
    schema: {
      description: 'Get project photos',
      tags: ['photos'],
      querystring: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
        },
        required: ['projectId'],
      },
      response: {
        200: {
          type: 'array',
          items: { type: 'object' },
        },
        400: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.query as { projectId?: string };

    if (!projectId) {
      app.logger.warn('projectId query parameter is required');
      return reply.status(400).send({ message: 'projectId query parameter is required' });
    }

    app.logger.info({ projectId }, 'Fetching project photos');

    const photos = await app.db
      .select()
      .from(schema.projectPhotos)
      .where(eq(schema.projectPhotos.projectId, projectId));

    // Generate signed URLs for each photo
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const { url: photoUrl } = await app.storage.getSignedUrl(photo.photoUrl);
        return {
          ...photo,
          photoUrl,
        };
      })
    );

    app.logger.info({ projectId, count: photosWithUrls.length }, 'Photos fetched successfully');
    return photosWithUrls;
  });

  // Get single photo
  fastify.get('/api/photos/:id', {
    schema: {
      description: 'Get single project photo',
      tags: ['photos'],
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
    const { id } = request.params as { id: string };

    app.logger.info({ photoId: id }, 'Fetching photo');

    const photo = await app.db
      .select()
      .from(schema.projectPhotos)
      .where(eq(schema.projectPhotos.id, id))
      .limit(1);

    if (!photo.length) {
      app.logger.warn({ photoId: id }, 'Photo not found');
      return reply.status(404).send({ message: 'Photo not found' });
    }

    // Generate signed URL
    const { url: photoUrl } = await app.storage.getSignedUrl(photo[0].photoUrl);

    app.logger.info({ photoId: id }, 'Photo fetched successfully');
    return {
      ...photo[0],
      photoUrl,
    };
  });

  // Update photo notes
  fastify.put('/api/photos/:id', {
    schema: {
      description: 'Update photo notes',
      tags: ['photos'],
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
          notes: { type: 'string' },
        },
        required: ['notes'],
      },
      response: {
        200: { type: 'object' },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes: string };

    app.logger.info({ photoId: id }, 'Updating photo notes');

    const photo = await app.db
      .select()
      .from(schema.projectPhotos)
      .where(eq(schema.projectPhotos.id, id))
      .limit(1);

    if (!photo.length) {
      app.logger.warn({ photoId: id }, 'Photo not found');
      return reply.status(404).send({ message: 'Photo not found' });
    }

    const [updated] = await app.db
      .update(schema.projectPhotos)
      .set({ notes })
      .where(eq(schema.projectPhotos.id, id))
      .returning();

    // Generate signed URL
    const { url: photoUrl } = await app.storage.getSignedUrl(updated.photoUrl);

    app.logger.info({ photoId: id }, 'Photo notes updated');
    return {
      ...updated,
      photoUrl,
    };
  });

  // Delete photo
  fastify.delete('/api/photos/:id', {
    schema: {
      description: 'Delete project photo',
      tags: ['photos'],
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
    const { id } = request.params as { id: string };

    app.logger.info({ photoId: id }, 'Deleting photo');

    const photo = await app.db
      .select()
      .from(schema.projectPhotos)
      .where(eq(schema.projectPhotos.id, id))
      .limit(1);

    if (!photo.length) {
      app.logger.warn({ photoId: id }, 'Photo not found');
      return reply.status(404).send({ message: 'Photo not found' });
    }

    // Delete file from storage
    try {
      await app.storage.delete(photo[0].photoUrl);
    } catch (error) {
      app.logger.warn({ err: error, photoId: id, key: photo[0].photoUrl }, 'Failed to delete file from storage');
      // Continue with database deletion even if file deletion fails
    }

    // Delete database record
    await app.db
      .delete(schema.projectPhotos)
      .where(eq(schema.projectPhotos.id, id));

    app.logger.info({ photoId: id }, 'Photo deleted successfully');
    return { message: 'Photo deleted successfully' };
  });
}
