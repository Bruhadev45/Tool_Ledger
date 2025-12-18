/**
 * AI Assistant Service
 *
 * Provides AI-powered insights and answers questions about credentials, invoices,
 * and spending patterns. Uses OpenAI GPT models to analyze user data and provide
 * actionable recommendations. Has full access to decrypted credentials data.
 *
 * @module AiAssistantService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { AnalyticsService } from '../analytics/analytics.service';
import { CredentialsService } from '../credentials/credentials.service';
import { EncryptionService } from '../shared/encryption/encryption.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private openaiClient: OpenAI | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
    private credentialsService: CredentialsService,
    private encryptionService: EncryptionService,
  ) {
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiApiKey,
      });
      this.logger.log('AI Assistant: OpenAI client initialized');
    } else {
      this.logger.warn('AI Assistant: OpenAI API key not found. AI features will be disabled.');
    }
  }

  async getInsights(
    userId: string,
    organizationId: string,
    userRole: string,
  ): Promise<{
    insights: string[];
    recommendations: string[];
    summary: string;
    keyMetrics: any;
  }> {
    try {
      // Gather comprehensive data
      const data = await this.gatherData(userId, organizationId, userRole);

      if (!this.openaiClient) {
        // Return basic insights without AI
        return this.generateBasicInsights(data, userRole);
      }

      // Generate AI-powered insights
      return await this.generateAIInsights(data, userRole);
    } catch (error) {
      this.logger.error(`Error generating insights: ${error.message}`, error.stack);
      throw error;
    }
  }

  async answerQuestion(
    userId: string,
    organizationId: string,
    userRole: string,
    question: string,
  ): Promise<string> {
    if (!this.openaiClient) {
      return 'AI Assistant is not available. Please configure OPENAI_API_KEY in your environment.';
    }

    try {
      const data = await this.gatherData(userId, organizationId, userRole);
      const context = this.formatDataForAI(data, userRole);

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant for ToolLedger, a credential and invoice management platform. 
            You help users understand their spending, credentials, and provide actionable insights.
            
            IMPORTANT: You have full access to all credential data including:
            - Credential names, usernames, passwords, API keys, and notes
            - Tags and categories
            - Ownership and sharing information
            - Linked invoices
            
            User Role: ${userRole}
            
            When answering questions about credentials:
            - You can reference specific credentials by name
            - You can see usernames and can help identify credentials
            - You can see tags and help organize credentials
            - You can see notes and provide context
            - NEVER expose passwords or API keys in full - only show partial values if needed for identification
            
            Always provide clear, concise, and actionable answers based on the full context provided.`,
          },
          {
            role: 'user',
            content: `Context about the user's data:
${context}

User Question: ${question}

Please provide a helpful answer based on the context above. Use specific credential names, tags, and details when relevant.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000, // Increased to allow more detailed responses about credentials
      });

      return response.choices[0]?.message?.content || 'Unable to generate response.';
    } catch (error) {
      this.logger.error(`Error answering question: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Gather comprehensive data for AI analysis
   *
   * Collects all accessible credentials (with decryption), invoices, users,
   * analytics data, and recent activity. Credentials are decrypted so the AI
   * has full knowledge of credential details.
   *
   * @param userId - ID of the user requesting insights
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param userRole - Role of the user (determines data access)
   * @returns Object containing all relevant data for AI analysis
   */
  private async gatherData(userId: string, organizationId: string, userRole: string) {
    // Get all accessible credentials using CredentialsService (handles RBAC and sharing)
    const credentialsRaw = await this.credentialsService.findAll(
      userId,
      organizationId,
      userRole as UserRole,
    );

    // Decrypt credentials so AI has full knowledge
    const credentials = credentialsRaw.map((cred: any) => {
      try {
        return {
          ...cred,
          username: this.encryptionService.decrypt(cred.username),
          password: this.encryptionService.decrypt(cred.password),
          apiKey: cred.apiKey ? this.encryptionService.decrypt(cred.apiKey) : null,
          notes: cred.notes ? this.encryptionService.decrypt(cred.notes) : null,
        };
      } catch (error: any) {
        this.logger.warn(
          `Failed to decrypt credential ${cred.id}: ${error.message}. This usually means ENCRYPTION_KEY is different from the one used to encrypt this data. Skipping this credential for AI analysis.`,
        );
        // Return credential without decryption if decryption fails
        // AI will skip credentials it can't decrypt
        return {
          ...cred,
          username: '[Encrypted - Decryption Failed]',
          password: '[Encrypted - Decryption Failed]',
          apiKey: cred.apiKey ? '[Encrypted - Decryption Failed]' : null,
          notes: cred.notes ? '[Encrypted - Decryption Failed]' : null,
          _decryptionError: true,
        };
      }
    });

    const [invoices, users, dashboardData, recentActivity] = await Promise.all([
      // Invoices
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          ...(userRole === 'ACCOUNTANT'
            ? { status: 'APPROVED', uploadedBy: { role: 'ADMIN' } }
            : userRole === 'ADMIN'
              ? {}
              : { uploadedById: userId }),
        },
        include: {
          uploadedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { billingDate: 'desc' },
        take: 50,
      }),

      // Users (for admin)
      userRole === 'ADMIN'
        ? this.prisma.user.findMany({
            where: { organizationId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true,
            },
          })
        : [],

      // Dashboard analytics
      userRole === 'ADMIN'
        ? this.analyticsService.getAdminDashboard(organizationId)
        : userRole === 'ACCOUNTANT'
          ? this.analyticsService.getAccountantDashboard(organizationId)
          : this.analyticsService.getUserDashboard(userId, organizationId),

      // Recent audit logs (for admin)
      userRole === 'ADMIN'
        ? this.prisma.auditLog.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : [],
    ]);

    return {
      credentials,
      invoices,
      users,
      dashboardData,
      recentActivity,
      userRole,
      organizationId,
    };
  }

  /**
   * Format data for AI context
   *
   * Creates a comprehensive text context from all gathered data, including
   * detailed credential information (names, usernames, tags, notes) so the AI
   * can answer specific questions about credentials.
   *
   * @param data - Gathered data object
   * @param userRole - Role of the user
   * @returns Formatted context string for AI
   */
  private formatDataForAI(data: any, userRole: string): string {
    const { credentials, invoices, users, dashboardData, recentActivity } = data;

    let context = `# ToolLedger Data Summary\n\n`;

    // Credentials - Full Details
    context += `## Credentials (${credentials.length} total)\n\n`;

    if (credentials.length === 0) {
      context += `No credentials found.\n\n`;
    } else {
      // Group by tags for organization
      const credentialsByTag: Record<string, any[]> = {};
      credentials.forEach((cred: any) => {
        if (cred.tags && cred.tags.length > 0) {
          cred.tags.forEach((tag: string) => {
            if (!credentialsByTag[tag]) {
              credentialsByTag[tag] = [];
            }
            credentialsByTag[tag].push(cred);
          });
        } else {
          if (!credentialsByTag['Untagged']) {
            credentialsByTag['Untagged'] = [];
          }
          credentialsByTag['Untagged'].push(cred);
        }
      });

      // List all credentials with full details
      credentials.forEach((cred: any, index: number) => {
        context += `### Credential ${index + 1}: ${cred.name}\n`;
        context += `- ID: ${cred.id}\n`;
        context += `- Username: ${cred.username || 'N/A'}\n`;
        context += `- Password: ${cred.password ? '***' : 'N/A'}\n`;
        if (cred.apiKey) {
          context += `- API Key: ${cred.apiKey.substring(0, 10)}...\n`;
        }
        if (cred.tags && cred.tags.length > 0) {
          context += `- Tags: ${cred.tags.join(', ')}\n`;
        }
        if (cred.notes) {
          context += `- Notes: ${cred.notes}\n`;
        }
        context += `- Owner: ${cred.owner?.firstName || ''} ${cred.owner?.lastName || ''} (${cred.owner?.email || 'N/A'})\n`;
        context += `- Created: ${new Date(cred.createdAt).toLocaleDateString()}\n`;

        // Share information
        if (cred.shares && cred.shares.length > 0) {
          context += `- Shared with users: ${cred.shares.map((s: any) => s.user?.email || 'N/A').join(', ')}\n`;
        }
        if (cred.teamShares && cred.teamShares.length > 0) {
          context += `- Shared with teams: ${cred.teamShares.map((ts: any) => ts.team?.name || 'N/A').join(', ')}\n`;
        }

        // Linked invoices
        if (cred.invoiceLinks && cred.invoiceLinks.length > 0) {
          context += `- Linked invoices: ${cred.invoiceLinks
            .map(
              (il: any) =>
                `${il.invoice?.invoiceNumber || 'N/A'} (${il.invoice?.provider || 'N/A'})`,
            )
            .join(', ')}\n`;
        }

        context += `\n`;
      });

      // Summary by tags
      if (Object.keys(credentialsByTag).length > 0) {
        context += `### Credentials by Tags:\n`;
        Object.entries(credentialsByTag).forEach(([tag, creds]) => {
          context += `- ${tag}: ${creds.length} credential(s)\n`;
        });
        context += `\n`;
      }
    }

    // Invoices
    context += `## Invoices (${invoices.length} total)\n`;
    const totalSpend = invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);
    const pendingInvoices = invoices.filter((inv: any) => inv.status === 'PENDING').length;
    const approvedInvoices = invoices.filter((inv: any) => inv.status === 'APPROVED').length;
    context += `Total Spend: $${totalSpend.toFixed(2)}\n`;
    context += `Pending: ${pendingInvoices}, Approved: ${approvedInvoices}\n`;

    // Top vendors
    const vendorSpend = invoices.reduce((acc: any, inv: any) => {
      const vendor = inv.provider || 'Unknown';
      acc[vendor] = (acc[vendor] || 0) + Number(inv.amount || 0);
      return acc;
    }, {});
    const topVendors = Object.entries(vendorSpend)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5)
      .map(([vendor, amount]: any) => `${vendor}: $${amount.toFixed(2)}`)
      .join(', ');
    context += `Top Vendors: ${topVendors}\n\n`;

    // Dashboard metrics
    if (dashboardData) {
      context += `## Key Metrics\n`;
      if (dashboardData.totalSpend) {
        context += `Total Organization Spend: $${dashboardData.totalSpend.toFixed(2)}\n`;
      }
      if (dashboardData.credentialCount) {
        context += `Total Credentials: ${dashboardData.credentialCount}\n`;
      }
      if (dashboardData.totalInvoices) {
        context += `Total Invoices: ${dashboardData.totalInvoices}\n`;
      }
      if (dashboardData.pendingInvoices) {
        context += `Pending Invoices: ${dashboardData.pendingInvoices}\n`;
      }
      context += `\n`;
    }

    // Users (for admin)
    if (userRole === 'ADMIN' && users.length > 0) {
      context += `## Users (${users.length} total)\n`;
      const activeUsers = users.filter((u: any) => u.isActive).length;
      context += `Active Users: ${activeUsers}\n`;
      context += `Roles: ${[...new Set(users.map((u: any) => u.role))].join(', ')}\n\n`;
    }

    // Recent activity
    if (recentActivity && recentActivity.length > 0) {
      context += `## Recent Activity\n`;
      context += `Last ${recentActivity.length} activities logged\n\n`;
    }

    return context;
  }

  /**
   * Generate AI-powered insights
   *
   * Uses OpenAI to analyze credentials, invoices, and spending patterns.
   * AI has full access to decrypted credential data for comprehensive analysis.
   *
   * @param data - Gathered data object (with decrypted credentials)
   * @param userRole - Role of the user
   * @returns AI-generated insights, recommendations, summary, and key metrics
   */
  private async generateAIInsights(data: any, userRole: string) {
    const context = this.formatDataForAI(data, userRole);
    const { dashboardData, invoices, credentials } = data;

    const prompt = `Analyze the following ToolLedger data and provide:
1. 3-5 key insights about spending patterns, credential usage, or organizational trends
2. 3-5 actionable recommendations for cost optimization, security, or efficiency
3. A brief summary (2-3 sentences) of the overall status

IMPORTANT: You have full access to all credential data including names, usernames, tags, and notes.
Use this information to provide specific, actionable insights about credential management.

Data:
${context}

Format your response as JSON:
{
  "insights": ["insight 1", "insight 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "summary": "brief summary text"
}`;

    try {
      const response = await this.openaiClient!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial and IT operations analyst. Provide clear, actionable insights and recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);

      return {
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || [],
        summary: parsed.summary || 'Analysis complete.',
        keyMetrics: {
          totalCredentials: credentials.length,
          totalInvoices: invoices.length,
          totalSpend: invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0),
          pendingInvoices: invoices.filter((inv: any) => inv.status === 'PENDING').length,
          ...(dashboardData || {}),
        },
      };
    } catch (error) {
      this.logger.error(`AI insight generation failed: ${error.message}`, error.stack);
      return this.generateBasicInsights(data, userRole);
    }
  }

  /**
   * Generate basic insights without AI
   *
   * Fallback method when OpenAI is not available. Provides basic statistics
   * and recommendations based on credential and invoice data.
   *
   * @param data - Gathered data object
   * @param userRole - Role of the user
   * @returns Basic insights, recommendations, summary, and key metrics
   */
  private generateBasicInsights(data: any, userRole: string) {
    const { credentials, invoices, dashboardData } = data;
    const totalSpend = invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);
    const pendingInvoices = invoices.filter((inv: any) => inv.status === 'PENDING').length;

    // Analyze credentials
    const credentialsWithTags = credentials.filter((c: any) => c.tags && c.tags.length > 0).length;
    const credentialsWithNotes = credentials.filter((c: any) => c.notes && c.notes.trim()).length;

    const insights = [
      `You have ${credentials.length} credential${credentials.length !== 1 ? 's' : ''} managed in the system.`,
      credentialsWithTags > 0
        ? `${credentialsWithTags} credential${credentialsWithTags !== 1 ? 's' : ''} are tagged for organization.`
        : 'Consider adding tags to your credentials for better organization.',
      `Total spending across ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}: $${totalSpend.toFixed(2)}.`,
      pendingInvoices > 0
        ? `You have ${pendingInvoices} pending invoice${pendingInvoices !== 1 ? 's' : ''} awaiting approval.`
        : 'All invoices are processed.',
    ];

    const recommendations = [
      credentialsWithTags < credentials.length
        ? 'Add tags to your credentials for better organization and searchability.'
        : 'Review and update credential tags regularly.',
      credentialsWithNotes < credentials.length
        ? 'Add notes to credentials to provide context and usage information.'
        : 'Keep credential notes up to date with relevant information.',
      'Set up spending alerts for budget management.',
      'Regularly audit credential access and permissions.',
    ];

    return {
      insights,
      recommendations,
      summary: `Your ToolLedger account shows ${credentials.length} credential${credentials.length !== 1 ? 's' : ''} and $${totalSpend.toFixed(2)} in total spending.`,
      keyMetrics: {
        totalCredentials: credentials.length,
        totalInvoices: invoices.length,
        totalSpend,
        pendingInvoices,
        ...(dashboardData || {}),
      },
    };
  }
}
