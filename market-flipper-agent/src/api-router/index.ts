import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './raindrop.gen';
import { orchestrateScan, getAgentStatus } from './controller';
import type { ScrapeConfig, AgentConfig } from '../types/shared';

/**
 * Helper function to format success responses
 */
function successResponse(data: any) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper function to format error responses
 */
function errorResponse(error: unknown) {
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString(),
  };
}

/**
 * API Router Service - Public HTTP endpoints for the Market Flipper Agent
 * Implements RESTful API with Hono framework
 */
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const app = new Hono();

    // Enable CORS on all routes
    app.use('/*', cors());

    /**
     * POST /scan - Trigger marketplace scan
     * Body: { maxPerMarketplace: number, category: string }
     */
    app.post('/scan', async (c) => {
      try {
        const body = await c.req.json();

        // Validate request body
        if (!body.maxPerMarketplace || !body.category) {
          return c.json(errorResponse('Invalid request body. Required: maxPerMarketplace, category'), 400);
        }

        const config: ScrapeConfig = {
          maxPerMarketplace: body.maxPerMarketplace,
          category: body.category,
        };

        this.env.logger.info('POST /scan - Triggering scan', { config });

        const result = await orchestrateScan(config, this.env);

        return c.json(successResponse(result));
      } catch (error) {
        this.env.logger.error('POST /scan - Error', { error: error instanceof Error ? error.message : String(error) });
        return c.json(errorResponse(error), 500);
      }
    });

    /**
     * GET /status - Get agent status and statistics
     */
    app.get('/status', async (c) => {
      try {
        this.env.logger.info('GET /status - Getting agent status');

        const stats = await getAgentStatus(this.env);

        return c.json(successResponse(stats));
      } catch (error) {
        this.env.logger.error('GET /status - Error', { error: error instanceof Error ? error.message : String(error) });
        return c.json(errorResponse(error), 500);
      }
    });

    /**
     * GET /inventory - View current inventory
     */
    app.get('/inventory', async (c) => {
      try {
        this.env.logger.info('GET /inventory - Getting inventory');

        const inventoryActorId = this.env.INVENTORY_ACTOR.idFromName('default');
        const inventoryActor = this.env.INVENTORY_ACTOR.get(inventoryActorId);
        const result = await inventoryActor.getInventory();

        return c.json(successResponse(result || []));
      } catch (error) {
        this.env.logger.error('GET /inventory - Error', { error: error instanceof Error ? error.message : String(error) });
        return c.json(errorResponse(error), 500);
      }
    });

    /**
     * GET /transactions - View transaction history
     */
    app.get('/transactions', async (c) => {
      try {
        this.env.logger.info('GET /transactions - Getting transactions');

        const transactionActorId = this.env.TRANSACTION_ACTOR.idFromName('default');
        const transactionActor = this.env.TRANSACTION_ACTOR.get(transactionActorId);
        const result = await transactionActor.getTransactions();

        return c.json(successResponse(result || []));
      } catch (error) {
        this.env.logger.error('GET /transactions - Error', { error: error instanceof Error ? error.message : String(error) });
        return c.json(errorResponse(error), 500);
      }
    });

    /**
     * POST /config - Update agent configuration
     * Body: { budget: number, minProfitMargin: number, minProfit: number, maxPerMarketplace: number, category: string }
     */
    app.post('/config', async (c) => {
      try {
        const body = await c.req.json();

        // Validate config structure
        if (
          !body.budget ||
          typeof body.minProfitMargin !== 'number' ||
          !body.minProfit ||
          !body.maxPerMarketplace ||
          !body.category
        ) {
          return c.json(
            errorResponse('Invalid config. Required: budget, minProfitMargin, minProfit, maxPerMarketplace, category'),
            400
          );
        }

        const config: AgentConfig = {
          budget: body.budget,
          minProfitMargin: body.minProfitMargin,
          minProfit: body.minProfit,
          maxPerMarketplace: body.maxPerMarketplace,
          category: body.category,
        };

        this.env.logger.info('POST /config - Updating config', { config });

        const decisionActorId = this.env.DECISION_ACTOR.idFromName('default');
        const decisionActor = this.env.DECISION_ACTOR.get(decisionActorId);
        await decisionActor.updateConfig(config);

        return c.json(successResponse({ message: 'Config updated successfully' }));
      } catch (error) {
        this.env.logger.error('POST /config - Error', { error: error instanceof Error ? error.message : String(error) });
        return c.json(errorResponse(error), 500);
      }
    });

    /**
     * 404 handler for unknown routes
     */
    app.notFound((c) => {
      return c.json(errorResponse('Route not found'), 404);
    });

    return app.fetch(request, this.env);
  }
}
