/**
 * Teams Service
 *
 * Handles team management within organizations. Teams are sub-organizations
 * used for grouping users and enabling team-based credential sharing.
 * Only Admins and Accountants can create/manage teams.
 *
 * @module TeamsService
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all teams in an organization
   *
   * Returns list of teams with member counts. Used for team selection
   * in credential sharing and user management.
   *
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @returns Array of team objects with member counts
   */
  async findAll(organizationId: string) {
    return this.prisma.team.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { users: true }, // Include member count
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a single team by ID
   *
   * Returns team details including all members. Enforces multi-tenant
   * isolation by verifying team belongs to organization.
   *
   * @param id - Team ID
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @returns Team object with members and member count
   * @throws NotFoundException if team not found or not in organization
   */
  async findOne(id: string, organizationId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, organizationId }, // Multi-tenant isolation
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  /**
   * Create a new team
   *
   * Creates a team within an organization. Team names must be unique
   * within the organization. Only Admins and Accountants can create teams.
   *
   * @param organizationId - ID of the organization
   * @param name - Team name (must be unique within organization)
   * @param description - Optional team description
   * @param requesterRole - Role of the user creating the team
   * @returns Created team object with member count
   * @throws ForbiddenException if requester is not Admin or Accountant
   * @throws BadRequestException if team name already exists
   */
  async create(
    organizationId: string,
    name: string,
    description?: string,
    requesterRole?: UserRole,
  ) {
    // Role-based access control: Only Admins and Accountants can create teams
    if (
      requesterRole &&
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.ACCOUNTANT
    ) {
      throw new ForbiddenException('Only admins and accountants can create teams');
    }

    // Check if team with same name already exists in organization
    // Team names must be unique within an organization
    const existing = await this.prisma.team.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Team with this name already exists in your organization');
    }

    return this.prisma.team.create({
      data: {
        name,
        description,
        organizationId,
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async update(
    id: string,
    organizationId: string,
    name?: string,
    description?: string,
    requesterRole?: UserRole,
  ) {
    // Only admins and accountants can update teams
    if (
      requesterRole &&
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.ACCOUNTANT
    ) {
      throw new ForbiddenException('Only admins and accountants can update teams');
    }

    const team = await this.prisma.team.findFirst({
      where: { id, organizationId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // If name is being updated, check for duplicates
    if (name && name !== team.name) {
      const existing = await this.prisma.team.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('Team with this name already exists in your organization');
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async remove(id: string, organizationId: string, requesterRole?: UserRole) {
    // Only admins and accountants can delete teams
    if (
      requesterRole &&
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.ACCOUNTANT
    ) {
      throw new ForbiddenException('Only admins and accountants can delete teams');
    }

    // Admins can delete teams from any organization
    // Accountants can only delete teams from their own organization
    const whereClause: any = { id };
    if (requesterRole !== UserRole.ADMIN) {
      whereClause.organizationId = organizationId;
    }

    const team = await this.prisma.team.findFirst({
      where: whereClause,
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Remove team from all users (set teamId to null)
    await this.prisma.user.updateMany({
      where: { teamId: id },
      data: { teamId: null },
    });

    // Delete team
    await this.prisma.team.delete({
      where: { id },
    });

    return { message: 'Team deleted successfully' };
  }

  async addUser(teamId: string, userId: string, organizationId: string, requesterRole?: UserRole) {
    // Only admins and accountants can add users to teams
    if (
      requesterRole &&
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.ACCOUNTANT
    ) {
      throw new ForbiddenException('Only admins and accountants can add users to teams');
    }

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { teamId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        teamId: true,
      },
    });
  }

  async removeUser(
    teamId: string,
    userId: string,
    organizationId: string,
    requesterRole?: UserRole,
  ) {
    // Only admins and accountants can remove users from teams
    if (
      requesterRole &&
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.ACCOUNTANT
    ) {
      throw new ForbiddenException('Only admins and accountants can remove users from teams');
    }

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, teamId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this team');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { teamId: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        teamId: true,
      },
    });
  }
}
