import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
}
