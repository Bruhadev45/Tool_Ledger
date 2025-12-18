/**
 * Credentials Service
 *
 * Handles credential management including creation, encryption, sharing, and access control.
 * All sensitive data (passwords, API keys, notes) is encrypted using AES-256 before storage.
 * Supports user-based and team-based sharing with permission levels.
 *
 * @module CredentialsService
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../shared/encryption/encryption.service';
import { CredentialPermission, UserRole } from '@prisma/client';
import { CreateCredentialDto, UpdateCredentialDto, ShareCredentialDto } from './dto';

@Injectable()
export class CredentialsService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create a new credential
   *
   * Encrypts all sensitive fields (username, password, API key, notes) using AES-256
   * before storing in database. Credentials are scoped to organization for multi-tenant isolation.
   *
   * @param userId - ID of the user creating the credential (becomes owner)
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param createDto - Credential data (name, username, password, optional API key, notes, tags)
   * @returns Created credential object with encrypted fields
   */
  async create(userId: string, organizationId: string, createDto: CreateCredentialDto) {
    // Encrypt all sensitive fields using AES-256 encryption
    const encryptedUsername = this.encryptionService.encrypt(createDto.username);
    const encryptedPassword = this.encryptionService.encrypt(createDto.password);
    const encryptedApiKey = createDto.apiKey
      ? this.encryptionService.encrypt(createDto.apiKey)
      : null;
    const encryptedNotes = createDto.notes ? this.encryptionService.encrypt(createDto.notes) : null;

    return this.prisma.credential.create({
      data: {
        name: createDto.name,
        username: encryptedUsername,
        password: encryptedPassword,
        apiKey: encryptedApiKey,
        notes: encryptedNotes,
        tags: createDto.tags || [],
        organizationId,
        ownerId: userId,
      },
    });
  }

  /**
   * Get all credentials accessible to the user
   *
   * Returns credentials based on role-based access control:
   * - Admins: All credentials in the organization
   * - Users: Own credentials + credentials shared with them (user-based + team-based)
   *
   * Includes related data: owner, shares, team shares, and linked invoices.
   *
   * @param userId - ID of the user requesting credentials
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param userRole - Role of the user (determines access level)
   * @returns Array of credential objects with decrypted sensitive fields
   */
  async findAll(userId: string, organizationId: string, userRole: UserRole) {
    // Get user's team for team-based sharing queries
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });

    // Role-based access control: Admins can see all organization credentials
    if (userRole === UserRole.ADMIN) {
      return this.prisma.credential.findMany({
        where: { organizationId },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          shares: {
            where: { revokedAt: null },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          teamShares: {
            where: { revokedAt: null },
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          invoiceLinks: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  amount: true,
                  provider: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Regular users see own + shared (user-based) + team-shared
    const [owned, userShared, teamShared] = await Promise.all([
      this.prisma.credential.findMany({
        where: {
          organizationId,
          ownerId: userId,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          invoiceLinks: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  amount: true,
                  provider: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.credential.findMany({
        where: {
          organizationId,
          shares: {
            some: {
              userId,
              revokedAt: null,
            },
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          invoiceLinks: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  amount: true,
                  provider: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      user?.teamId
        ? this.prisma.credential.findMany({
            where: {
              organizationId,
              teamShares: {
                some: {
                  teamId: user.teamId,
                  revokedAt: null,
                },
              },
            },
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              invoiceLinks: {
                include: {
                  invoice: {
                    select: {
                      id: true,
                      invoiceNumber: true,
                      amount: true,
                      provider: true,
                      status: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    // Combine and deduplicate by credential ID
    const allCredentials = [...owned, ...userShared, ...teamShared];
    const uniqueCredentials = Array.from(
      new Map(allCredentials.map((cred) => [cred.id, cred])).values(),
    );

    return uniqueCredentials;
  }

  async findOne(
    id: string,
    userId: string,
    organizationId: string,
    userRole: UserRole,
    includeDecrypted = false,
  ) {
    const credential = await this.prisma.credential.findFirst({
      where: {
        id,
        organizationId, // Multi-tenant isolation
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        shares: {
          where: { revokedAt: null },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        teamShares: {
          where: { revokedAt: null },
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        invoiceLinks: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                amount: true,
                provider: true,
                status: true,
                billingDate: true,
              },
            },
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Check access
    const isOwner = credential.ownerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    const share = credential.shares.find((s) => s.userId === userId && !s.revokedAt);

    if (!isOwner && !isAdmin && !share) {
      throw new ForbiddenException('You do not have access to this credential');
    }

    // Decrypt if requested and user has access
    if (includeDecrypted) {
      return {
        ...credential,
        username: this.encryptionService.decrypt(credential.username),
        password: this.encryptionService.decrypt(credential.password),
        apiKey: credential.apiKey ? this.encryptionService.decrypt(credential.apiKey) : null,
        notes: credential.notes ? this.encryptionService.decrypt(credential.notes) : null,
      };
    }

    return credential;
  }

  async update(
    id: string,
    userId: string,
    organizationId: string,
    userRole: UserRole,
    updateDto: UpdateCredentialDto,
  ) {
    const credential = await this.findOne(id, userId, organizationId, userRole, false);

    // Check edit permission
    const isOwner = credential.ownerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    const share = credential.shares.find((s) => s.userId === userId && !s.revokedAt);
    const canEdit = share?.permission === CredentialPermission.EDIT;

    if (!isOwner && !isAdmin && !canEdit) {
      throw new ForbiddenException('You do not have permission to edit this credential');
    }

    // Encrypt updated fields
    const updateData: any = {};
    if (updateDto.name) updateData.name = updateDto.name;
    if (updateDto.username)
      updateData.username = this.encryptionService.encrypt(updateDto.username);
    if (updateDto.password)
      updateData.password = this.encryptionService.encrypt(updateDto.password);
    if (updateDto.apiKey !== undefined) {
      updateData.apiKey = updateDto.apiKey
        ? this.encryptionService.encrypt(updateDto.apiKey)
        : null;
    }
    if (updateDto.notes !== undefined) {
      updateData.notes = updateDto.notes ? this.encryptionService.encrypt(updateDto.notes) : null;
    }
    if (updateDto.tags) updateData.tags = updateDto.tags;

    return this.prisma.credential.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string, organizationId: string, userRole: UserRole) {
    const credential = await this.findOne(id, userId, organizationId, userRole, false);

    // Only owner or admin can delete
    const isOwner = credential.ownerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this credential');
    }

    return this.prisma.credential.delete({
      where: { id },
    });
  }

  async share(
    id: string,
    userId: string,
    organizationId: string,
    userRole: UserRole,
    shareDto: ShareCredentialDto,
  ) {
    const credential = await this.findOne(id, userId, organizationId, userRole, false);

    // Only owner or admin can share
    const isOwner = credential.ownerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the owner or admin can share credentials');
    }

    // Share with user
    if (shareDto.userId) {
      // Verify user exists in same organization
      const targetUser = await this.prisma.user.findFirst({
        where: {
          id: shareDto.userId,
          organizationId,
        },
      });

      if (!targetUser) {
        throw new BadRequestException('User not found in your organization');
      }

      // Create or update share
      return this.prisma.credentialShare.upsert({
        where: {
          credentialId_userId: {
            credentialId: id,
            userId: shareDto.userId,
          },
        },
        update: {
          permission: shareDto.permission,
          revokedAt: null, // Re-enable if previously revoked
        },
        create: {
          credentialId: id,
          userId: shareDto.userId,
          permission: shareDto.permission,
        },
      });
    }

    // Share with team
    if (shareDto.teamId) {
      // Verify team exists in same organization
      const targetTeam = await this.prisma.team.findFirst({
        where: {
          id: shareDto.teamId,
          organizationId,
        },
      });

      if (!targetTeam) {
        throw new BadRequestException('Team not found in your organization');
      }

      // Create or update team share
      return this.prisma.credentialTeamShare.upsert({
        where: {
          credentialId_teamId: {
            credentialId: id,
            teamId: shareDto.teamId,
          },
        },
        update: {
          permission: shareDto.permission,
          revokedAt: null, // Re-enable if previously revoked
        },
        create: {
          credentialId: id,
          teamId: shareDto.teamId,
          permission: shareDto.permission,
        },
      });
    }

    throw new BadRequestException('Either userId or teamId must be provided');
  }

  async revokeAccess(
    id: string,
    userId: string,
    organizationId: string,
    userRole: UserRole,
    targetUserId: string,
  ) {
    const credential = await this.findOne(id, userId, organizationId, userRole, false);

    // Only owner or admin can revoke
    const isOwner = credential.ownerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the owner or admin can revoke access');
    }

    return this.prisma.credentialShare.updateMany({
      where: {
        credentialId: id,
        userId: targetUserId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeTeamAccess(
    id: string,
    userId: string,
    organizationId: string,
    userRole: UserRole,
    teamId: string,
  ) {
    const credential = await this.findOne(id, userId, organizationId, userRole, false);

    // Only owner or admin can revoke
    const isOwner = credential.ownerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only the owner or admin can revoke access');
    }

    return this.prisma.credentialTeamShare.updateMany({
      where: {
        credentialId: id,
        teamId: teamId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
