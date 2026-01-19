import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

const GITHUB_API_BASE = 'https://api.github.com';

// Type definitions for GitHub API responses
interface GitHubTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  [key: string]: any;
}

interface GitHubErrorResponse {
  message: string;
  [key: string]: any;
}

export function registerGithubRoutes(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // Helper function to make GitHub API requests
  async function githubApiRequest(
    method: string,
    endpoint: string,
    accessToken: string,
    body?: any
  ): Promise<any> {
    const url = `${GITHUB_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Specular-GitHub-Integration',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      throw new Error('GitHub authentication failed');
    }

    if (response.status === 403) {
      throw new Error('GitHub rate limit exceeded or insufficient permissions');
    }

    if (!response.ok) {
      const error = await response.json() as GitHubErrorResponse;
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  // POST /api/github/oauth/authorize - Exchange OAuth code for access token
  fastify.post('/api/github/oauth/authorize', {
    schema: {
      description: 'Authorize with GitHub OAuth',
      tags: ['github'],
      body: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
        },
        required: ['code'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            username: { type: 'string' },
            connection_id: { type: 'string', format: 'uuid' },
          },
        },
        400: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { code } = request.body as { code: string };

    app.logger.info({ userId }, 'Starting GitHub OAuth authorization');

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: process.env.GITHUB_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        app.logger.warn({ userId }, 'GitHub token exchange failed');
        return reply.status(400).send({ message: 'Failed to exchange code for access token' });
      }

      const tokenData = await tokenResponse.json() as GitHubTokenResponse;
      if (!tokenData.access_token) {
        app.logger.warn({ userId }, 'No access token in GitHub response');
        return reply.status(400).send({ message: 'Invalid GitHub response' });
      }

      // Get user info from GitHub
      const userInfo = await githubApiRequest('GET', '/user', tokenData.access_token);

      // Check if connection already exists and delete it
      const existingConnection = await app.db
        .select()
        .from(schema.githubConnections)
        .where(eq(schema.githubConnections.userId, userId))
        .limit(1);

      if (existingConnection.length) {
        await app.db
          .delete(schema.githubConnections)
          .where(eq(schema.githubConnections.id, existingConnection[0].id));
      }

      // Create new connection
      const [connection] = await app.db
        .insert(schema.githubConnections)
        .values({
          userId,
          githubUsername: userInfo.login,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          tokenExpiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
        })
        .returning();

      app.logger.info(
        { userId, connectionId: connection.id, username: userInfo.login },
        'GitHub connection created successfully'
      );

      return {
        success: true,
        username: userInfo.login,
        connection_id: connection.id,
      };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to authorize GitHub');
      throw error;
    }
  });

  // GET /api/github/connection - Get connection status
  fastify.get('/api/github/connection', {
    schema: {
      description: 'Get GitHub connection status',
      tags: ['github'],
      response: {
        200: {
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
            username: { type: 'string' },
            connection_id: { type: 'string', format: 'uuid' },
            connected_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching GitHub connection status');

    const connection = await app.db
      .select()
      .from(schema.githubConnections)
      .where(eq(schema.githubConnections.userId, userId))
      .limit(1);

    if (!connection.length) {
      app.logger.info({ userId }, 'No GitHub connection found');
      return { connected: false };
    }

    app.logger.info({ userId, connectionId: connection[0].id }, 'GitHub connection status retrieved');
    return {
      connected: true,
      username: connection[0].githubUsername,
      connection_id: connection[0].id,
      connected_at: connection[0].connectedAt,
    };
  });

  // DELETE /api/github/connection - Disconnect GitHub
  fastify.delete('/api/github/connection', {
    schema: {
      description: 'Disconnect GitHub account',
      tags: ['github'],
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Disconnecting GitHub account');

    const connection = await app.db
      .select()
      .from(schema.githubConnections)
      .where(eq(schema.githubConnections.userId, userId))
      .limit(1);

    if (!connection.length) {
      app.logger.warn({ userId }, 'No GitHub connection to disconnect');
      return { success: false };
    }

    // Delete repositories and connection
    await app.db
      .delete(schema.githubRepositories)
      .where(eq(schema.githubRepositories.connectionId, connection[0].id));

    await app.db
      .delete(schema.githubConnections)
      .where(eq(schema.githubConnections.id, connection[0].id));

    app.logger.info({ userId }, 'GitHub account disconnected');
    return { success: true };
  });

  // GET /api/github/repos - Fetch and sync repositories
  fastify.get('/api/github/repos', {
    schema: {
      description: 'Fetch and sync GitHub repositories',
      tags: ['github'],
      response: {
        200: {
          type: 'array',
          items: { type: 'object' },
        },
        401: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching GitHub repositories');

    const connection = await app.db
      .select()
      .from(schema.githubConnections)
      .where(eq(schema.githubConnections.userId, userId))
      .limit(1);

    if (!connection.length) {
      app.logger.warn({ userId }, 'No GitHub connection found');
      return reply.status(401).send({ message: 'GitHub not connected' });
    }

    try {
      // Fetch repos from GitHub API
      const repos = await githubApiRequest(
        'GET',
        '/user/repos?per_page=100&sort=updated',
        connection[0].accessToken
      );

      // Update database with repos
      const dbRepos = await app.db
        .select()
        .from(schema.githubRepositories)
        .where(eq(schema.githubRepositories.connectionId, connection[0].id));

      const repoIds = new Set(dbRepos.map(r => r.repoFullName));
      const githubRepoIds = new Set(repos.map((r: any) => r.full_name));

      // Delete repos no longer in GitHub
      for (const dbRepo of dbRepos) {
        if (!githubRepoIds.has(dbRepo.repoFullName)) {
          await app.db
            .delete(schema.githubRepositories)
            .where(eq(schema.githubRepositories.id, dbRepo.id));
        }
      }

      // Add or update repos
      for (const repo of repos) {
        if (repoIds.has(repo.full_name)) {
          await app.db
            .update(schema.githubRepositories)
            .set({
              description: repo.description,
              isPrivate: repo.private,
              defaultBranch: repo.default_branch,
              updatedAt: new Date(),
            })
            .where(eq(schema.githubRepositories.repoFullName, repo.full_name));
        } else {
          await app.db
            .insert(schema.githubRepositories)
            .values({
              connectionId: connection[0].id,
              repoName: repo.name,
              repoFullName: repo.full_name,
              repoUrl: repo.html_url,
              description: repo.description,
              isPrivate: repo.private,
              defaultBranch: repo.default_branch,
            });
        }
      }

      // Update last synced time
      await app.db
        .update(schema.githubConnections)
        .set({ lastSyncedAt: new Date() })
        .where(eq(schema.githubConnections.id, connection[0].id));

      // Return repos with signed URLs
      const syncedRepos = await app.db
        .select()
        .from(schema.githubRepositories)
        .where(eq(schema.githubRepositories.connectionId, connection[0].id));

      app.logger.info({ userId, count: syncedRepos.length }, 'Repositories synced successfully');

      return syncedRepos.map(repo => ({
        id: repo.id,
        name: repo.repoName,
        full_name: repo.repoFullName,
        url: repo.repoUrl,
        description: repo.description,
        is_private: repo.isPrivate,
        default_branch: repo.defaultBranch,
      }));
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch repositories');
      throw error;
    }
  });

  // POST /api/github/repos - Create new repository
  fastify.post('/api/github/repos', {
    schema: {
      description: 'Create a new GitHub repository',
      tags: ['github'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          private: { type: 'boolean' },
        },
        required: ['name'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            repo: { type: 'object' },
          },
        },
        401: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { name, description, private: isPrivate } = request.body as {
      name: string;
      description?: string;
      private?: boolean;
    };

    app.logger.info({ userId, repoName: name }, 'Creating GitHub repository');

    const connection = await app.db
      .select()
      .from(schema.githubConnections)
      .where(eq(schema.githubConnections.userId, userId))
      .limit(1);

    if (!connection.length) {
      app.logger.warn({ userId }, 'No GitHub connection found');
      return reply.status(401).send({ message: 'GitHub not connected' });
    }

    try {
      // Create repo on GitHub
      const createdRepo = await githubApiRequest(
        'POST',
        '/user/repos',
        connection[0].accessToken,
        {
          name,
          description,
          private: isPrivate || false,
        }
      );

      // Store in database
      const [dbRepo] = await app.db
        .insert(schema.githubRepositories)
        .values({
          connectionId: connection[0].id,
          repoName: createdRepo.name,
          repoFullName: createdRepo.full_name,
          repoUrl: createdRepo.html_url,
          description: createdRepo.description,
          isPrivate: createdRepo.private,
          defaultBranch: createdRepo.default_branch,
        })
        .returning();

      app.logger.info(
        { userId, repoId: dbRepo.id, repoName: name },
        'Repository created successfully'
      );

      return {
        success: true,
        repo: {
          id: dbRepo.id,
          name: dbRepo.repoName,
          full_name: dbRepo.repoFullName,
          url: dbRepo.repoUrl,
          description: dbRepo.description,
          is_private: dbRepo.isPrivate,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId, repoName: name }, 'Failed to create repository');
      throw error;
    }
  });

  // GET /api/github/repos/:repoId - Get repo details
  fastify.get('/api/github/repos/:repoId', {
    schema: {
      description: 'Get GitHub repository details',
      tags: ['github'],
      params: {
        type: 'object',
        properties: {
          repoId: { type: 'string', format: 'uuid' },
        },
        required: ['repoId'],
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
    const { repoId } = request.params as { repoId: string };

    app.logger.info({ userId, repoId }, 'Fetching repository details');

    const connection = await app.db
      .select()
      .from(schema.githubConnections)
      .where(eq(schema.githubConnections.userId, userId))
      .limit(1);

    if (!connection.length) {
      app.logger.warn({ userId }, 'No GitHub connection found');
      return reply.status(401).send({ message: 'GitHub not connected' });
    }

    const repo = await app.db
      .select()
      .from(schema.githubRepositories)
      .where(eq(schema.githubRepositories.id, repoId))
      .limit(1);

    if (!repo.length || repo[0].connectionId !== connection[0].id) {
      app.logger.warn({ userId, repoId }, 'Repository not found');
      return reply.status(404).send({ message: 'Repository not found' });
    }

    app.logger.info({ userId, repoId }, 'Repository details retrieved');
    return {
      id: repo[0].id,
      name: repo[0].repoName,
      full_name: repo[0].repoFullName,
      url: repo[0].repoUrl,
      description: repo[0].description,
      is_private: repo[0].isPrivate,
      default_branch: repo[0].defaultBranch,
      created_at: repo[0].createdAt,
    };
  });

  // DELETE /api/github/repos/:repoId - Delete repository
  fastify.delete('/api/github/repos/:repoId', {
    schema: {
      description: 'Delete GitHub repository',
      tags: ['github'],
      params: {
        type: 'object',
        properties: {
          repoId: { type: 'string', format: 'uuid' },
        },
        required: ['repoId'],
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { repoId } = request.params as { repoId: string };

    app.logger.info({ userId, repoId }, 'Deleting repository');

    const connection = await app.db
      .select()
      .from(schema.githubConnections)
      .where(eq(schema.githubConnections.userId, userId))
      .limit(1);

    if (!connection.length) {
      app.logger.warn({ userId }, 'No GitHub connection found');
      return reply.status(401).send({ message: 'GitHub not connected' });
    }

    const repo = await app.db
      .select()
      .from(schema.githubRepositories)
      .where(eq(schema.githubRepositories.id, repoId))
      .limit(1);

    if (!repo.length || repo[0].connectionId !== connection[0].id) {
      app.logger.warn({ userId, repoId }, 'Repository not found');
      return reply.status(404).send({ message: 'Repository not found' });
    }

    try {
      // Delete from GitHub
      await githubApiRequest(
        'DELETE',
        `/repos/${repo[0].repoFullName}`,
        connection[0].accessToken
      );

      // Delete from database
      await app.db
        .delete(schema.githubRepositories)
        .where(eq(schema.githubRepositories.id, repoId));

      app.logger.info({ userId, repoId }, 'Repository deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId, repoId }, 'Failed to delete repository');
      throw error;
    }
  });

  // POST /api/github/repos/:repoId/push - Push files to repository
  fastify.post('/api/github/repos/:repoId/push', {
    schema: {
      description: 'Push files to GitHub repository',
      tags: ['github'],
      params: {
        type: 'object',
        properties: {
          repoId: { type: 'string', format: 'uuid' },
        },
        required: ['repoId'],
      },
      body: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['path', 'content'],
            },
          },
          message: { type: 'string' },
          branch: { type: 'string' },
        },
        required: ['files', 'message'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            commit_sha: { type: 'string' },
            commit_url: { type: 'string' },
          },
        },
        401: { type: 'object', properties: { message: { type: 'string' } } },
        404: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { repoId } = request.params as { repoId: string };
    const { files, message, branch } = request.body as {
      files: Array<{ path: string; content: string }>;
      message: string;
      branch?: string;
    };

    app.logger.info({ userId, repoId, fileCount: files.length }, 'Pushing files to repository');

    const connection = await app.db
      .select()
      .from(schema.githubConnections)
      .where(eq(schema.githubConnections.userId, userId))
      .limit(1);

    if (!connection.length) {
      app.logger.warn({ userId }, 'No GitHub connection found');
      return reply.status(401).send({ message: 'GitHub not connected' });
    }

    const repo = await app.db
      .select()
      .from(schema.githubRepositories)
      .where(eq(schema.githubRepositories.id, repoId))
      .limit(1);

    if (!repo.length || repo[0].connectionId !== connection[0].id) {
      app.logger.warn({ userId, repoId }, 'Repository not found');
      return reply.status(404).send({ message: 'Repository not found' });
    }

    try {
      const targetBranch = branch || repo[0].defaultBranch;

      // Get the latest commit SHA from the branch
      const branchInfo = await githubApiRequest(
        'GET',
        `/repos/${repo[0].repoFullName}/branches/${targetBranch}`,
        connection[0].accessToken
      );

      const baseTreeSha = branchInfo.commit.commit.tree.sha;

      // Create tree with new files
      const treeItems = files.map((file: any) => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: file.content,
      }));

      const newTree = await githubApiRequest(
        'POST',
        `/repos/${repo[0].repoFullName}/git/trees`,
        connection[0].accessToken,
        {
          base_tree: baseTreeSha,
          tree: treeItems,
        }
      );

      // Create commit
      const commit = await githubApiRequest(
        'POST',
        `/repos/${repo[0].repoFullName}/git/commits`,
        connection[0].accessToken,
        {
          message,
          tree: newTree.sha,
          parents: [branchInfo.commit.sha],
        }
      );

      // Update reference
      await githubApiRequest(
        'PATCH',
        `/repos/${repo[0].repoFullName}/git/refs/heads/${targetBranch}`,
        connection[0].accessToken,
        {
          sha: commit.sha,
        }
      );

      app.logger.info(
        { userId, repoId, commitSha: commit.sha },
        'Files pushed successfully'
      );

      return {
        success: true,
        commit_sha: commit.sha,
        commit_url: `https://github.com/${repo[0].repoFullName}/commit/${commit.sha}`,
      };
    } catch (error) {
      app.logger.error({ err: error, userId, repoId }, 'Failed to push files');
      throw error;
    }
  });
}
