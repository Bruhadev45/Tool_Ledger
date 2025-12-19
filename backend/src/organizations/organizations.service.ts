import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return organization;
  }

  async findAll() {
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(createDto: CreateOrganizationDto) {
    // Check if domain already exists
    const existing = await this.prisma.organization.findUnique({
      where: { domain: createDto.domain },
    });

    if (existing) {
      throw new ConflictException(`Organization with domain ${createDto.domain} already exists`);
    }

    return this.prisma.organization.create({
      data: {
        name: createDto.name,
        domain: createDto.domain,
      },
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, updateDto: UpdateOrganizationDto) {
    // Check if organization exists
    await this.findOne(id);

    // If updating domain, check if it's already taken by another organization
    if (updateDto.domain) {
      const existing = await this.prisma.organization.findUnique({
        where: { domain: updateDto.domain },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(`Domain ${updateDto.domain} is already taken by another organization`);
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data: updateDto,
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    // Check if organization exists
    await this.findOne(id);

    // Delete organization (cascade will handle related records)
    await this.prisma.organization.delete({
      where: { id },
    });
  }

  async addUser(orgId: string, userId: string) {
    // Verify organization exists
    await this.findOne(orgId);

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, organizationId: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Update user's organization
    return this.prisma.user.update({
      where: { id: userId },
      data: { organizationId: orgId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        organizationId: true,
      },
    });
  }

  async removeUser(orgId: string, userId: string) {
    // Verify organization exists
    await this.findOne(orgId);

    // Verify user exists and belongs to this organization
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found in this organization`);
    }

    // Find a default organization or create one for orphaned users
    // First, try to find any other organization
    const otherOrg = await this.prisma.organization.findFirst({
      where: { id: { not: orgId } },
    });

    if (otherOrg) {
      // Move user to another organization
      return this.prisma.user.update({
        where: { id: userId },
        data: { organizationId: otherOrg.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
        },
      });
    } else {
      // No other organization exists, create a default one
      const defaultOrg = await this.prisma.organization.create({
        data: {
          name: 'Default Organization',
          domain: 'default.local',
        },
      });

      return this.prisma.user.update({
        where: { id: userId },
        data: { organizationId: defaultOrg.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
        },
      });
    }
  }

  async addCredential(orgId: string, credentialId: string) {
    // Verify organization exists
    await this.findOne(orgId);

    // Verify credential exists
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!credential) {
      throw new NotFoundException(`Credential with ID ${credentialId} not found`);
    }

    // Update credential's organization
    return this.prisma.credential.update({
      where: { id: credentialId },
      data: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        ownerId: true,
        createdAt: true,
      },
    });
  }

  async removeCredential(orgId: string, credentialId: string) {
    // Verify organization exists
    await this.findOne(orgId);

    // Verify credential exists and belongs to this organization
    const credential = await this.prisma.credential.findFirst({
      where: { id: credentialId, organizationId: orgId },
    });

    if (!credential) {
      throw new NotFoundException(`Credential with ID ${credentialId} not found in this organization`);
    }

    // Find a default organization or create one for orphaned credentials
    // First, try to find any other organization
    const otherOrg = await this.prisma.organization.findFirst({
      where: { id: { not: orgId } },
    });

    if (otherOrg) {
      // Move credential to another organization
      return this.prisma.credential.update({
        where: { id: credentialId },
        data: { organizationId: otherOrg.id },
        select: {
          id: true,
          name: true,
          organizationId: true,
          ownerId: true,
        },
      });
    } else {
      // No other organization exists, create a default one
      const defaultOrg = await this.prisma.organization.create({
        data: {
          name: 'Default Organization',
          domain: 'default.local',
        },
      });

      return this.prisma.credential.update({
        where: { id: credentialId },
        data: { organizationId: defaultOrg.id },
        select: {
          id: true,
          name: true,
          organizationId: true,
          ownerId: true,
        },
      });
    }
  }
}
